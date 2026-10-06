import { NextResponse } from "next/server";
import { apiUser, HttpError } from "@/lib/auth/session";
import { q, q1 } from "@/lib/db";
import { audit, handle, noStore, readJson } from "@/lib/ops";
import { processAsset, purgeAsset } from "@/lib/media";
import { headObject } from "@/lib/storage";
import { isUuid } from "@/lib/content/sanitize";
import { clampText } from "@/lib/text";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

async function idOf(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, "Not found.");
  return id;
}

export const GET = handle(async (req: Request, ctx: Ctx) => {
  await apiUser(req);
  const id = await idOf(ctx);
  const asset = await q1(
    `SELECT a.id, a.state, a.error, a.width, a.height, a.bytes, a.default_alt, a.default_caption, a.credit, a.focal_x, a.focal_y, a.created_at,
            (SELECT coalesce(array_agg(width ORDER BY width), '{}') FROM media_variants v WHERE v.asset_id = a.id AND v.format = 'webp') AS widths
       FROM media_assets a WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [id],
  );
  if (!asset) throw new HttpError(404, "Not found.");
  const usage = await q(
    `SELECT u.owner_kind, u.owner_id, u.in_draft, u.in_published, e.type, e.state,
            COALESCE(NULLIF(r.content->>'title',''), 'Untitled') AS title
       FROM media_usage u
       LEFT JOIN entries e ON u.owner_kind = 'entry' AND e.id::text = u.owner_id
       LEFT JOIN entry_revisions r ON r.id = e.working_revision_id
      WHERE u.asset_id = $1`,
    [id],
  );
  return NextResponse.json({ asset, usage }, { headers: noStore });
});

// Upload completion (idempotent) or retry processing.
export const POST = handle(async (req: Request, ctx: Ctx) => {
  await apiUser(req);
  const id = await idOf(ctx);
  const a = await q1<{ original_key: string; state: string }>(`SELECT original_key, state FROM media_assets WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (!a) throw new HttpError(404, "Not found.");
  if (a.state === "ready") return NextResponse.json({ ok: true, state: "ready" }, { headers: noStore });
  const head = await headObject(a.original_key);
  if (!head) throw new HttpError(409, "The upload hasn’t arrived yet. Please retry.");
  await q(`UPDATE media_assets SET bytes = $2 WHERE id = $1`, [id, head.size]);
  const res = await processAsset(id);
  const state = (await q1<{ state: string; error: string | null }>(`SELECT state, error FROM media_assets WHERE id = $1`, [id]))!;
  if (!res.ok && state.state === "failed") {
    return NextResponse.json({ ok: false, state: "failed", error: state.error }, { status: 422, headers: noStore });
  }
  return NextResponse.json({ ok: true, state: state.state }, { headers: noStore });
});

// Default alt text, caption, credit and focal point.
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await apiUser(req);
  const id = await idOf(ctx);
  const b = await readJson(req, 10_000);
  const fx = Math.min(1, Math.max(0, Number(b.focalX ?? 0.5)));
  const fy = Math.min(1, Math.max(0, Number(b.focalY ?? 0.5)));
  await q(
    `UPDATE media_assets SET default_alt = $2, default_caption = $3, credit = $4, focal_x = $5, focal_y = $6, updated_at = now() WHERE id = $1`,
    [id, clampText(b.alt, 400), clampText(b.caption, 600), clampText(b.credit, 200), Number.isFinite(fx) ? fx : 0.5, Number.isFinite(fy) ? fy : 0.5],
  );
  await audit(user.id, "media.update", "media", id);
  return NextResponse.json({ ok: true }, { headers: noStore });
});

// Permanent delete — blocked while referenced (M06).
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const user = await apiUser(req);
  const id = await idOf(ctx);
  const res = await purgeAsset(id);
  if (!res.ok) throw new HttpError(409, res.error!);
  await audit(user.id, "media.delete", "media", id);
  return NextResponse.json({ ok: true }, { headers: noStore });
});
