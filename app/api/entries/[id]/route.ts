import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiUser, HttpError } from "@/lib/auth/session";
import {
  checkPublish,
  duplicateEntry,
  getEntryForEdit,
  listRevisions,
  publishEntry,
  restoreEntry,
  restoreRevision,
  saveDraft,
  trashEntry,
  unpublishEntry,
} from "@/lib/content/repo";
import { audit, handle, noStore, readJson } from "@/lib/ops";
import { q } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/auth/crypto";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const user = await apiUser(req);
  const { id } = await ctx.params;
  const url = new URL(req.url);
  if (url.searchParams.get("view") === "revisions") {
    return NextResponse.json({ revisions: await listRevisions(user, id) }, { headers: noStore });
  }
  if (url.searchParams.get("view") === "check") {
    const { problems } = await checkPublish(user, id);
    return NextResponse.json({ problems }, { headers: noStore });
  }
  const { entry, content } = await getEntryForEdit(user, id);
  return NextResponse.json({ entry, content }, { headers: noStore });
});

// Save draft (autosave and manual). Requires the version the client last saw (E03).
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const user = await apiUser(req);
  const { id } = await ctx.params;
  const body = await readJson(req, 3_000_000);
  const version = Number(body.version);
  if (!Number.isInteger(version)) throw new HttpError(400, "Missing draft version.");
  const res = await saveDraft(user, id, body.content, version, { snapshot: body.snapshot === true });
  return NextResponse.json(res, { headers: noStore });
});

function purgePublic() {
  // E07: public pages are rendered per request; this also clears any route cache.
  revalidatePath("/", "layout");
}

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await apiUser(req);
  const { id } = await ctx.params;
  const body = await readJson(req, 5000);
  const action = String(body.action ?? "");
  switch (action) {
    case "publish": {
      const res = await publishEntry(user, id, Number(body.version), String(body.requestId ?? "").slice(0, 80));
      purgePublic();
      return NextResponse.json(res, { headers: noStore });
    }
    case "unpublish":
      await unpublishEntry(user, id);
      purgePublic();
      return NextResponse.json({ ok: true }, { headers: noStore });
    case "trash":
      await trashEntry(user, id);
      purgePublic();
      return NextResponse.json({ ok: true }, { headers: noStore });
    case "restore":
      await restoreEntry(user, id);
      return NextResponse.json({ ok: true }, { headers: noStore });
    case "duplicate": {
      const newId = await duplicateEntry(user, id);
      return NextResponse.json({ id: newId }, { headers: noStore });
    }
    case "restore-revision":
      await restoreRevision(user, id, String(body.revisionId ?? ""));
      return NextResponse.json({ ok: true }, { headers: noStore });
    case "preview-link": {
      await getEntryForEdit(user, id); // permission check
      const token = randomToken(24);
      const hours = Math.min(Math.max(Number(body.hours) || 48, 1), 168);
      await q(`INSERT INTO preview_tokens (token_hash, entry_id, created_by, expires_at) VALUES ($1,$2,$3, now() + ($4 || ' hours')::interval)`, [
        sha256(token),
        id,
        user.id,
        String(hours),
      ]);
      await audit(user.id, "entry.preview_link", "entry", id, { hours });
      return NextResponse.json({ url: `/api/preview-access?id=${id}&token=${token}`, hours }, { headers: noStore });
    }
    default:
      throw new HttpError(400, "Unknown action.");
  }
});
