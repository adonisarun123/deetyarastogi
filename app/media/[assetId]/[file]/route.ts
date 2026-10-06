import { q1 } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getObject } from "@/lib/storage";
import { isUuid } from "@/lib/content/sanitize";
import { sha256 } from "@/lib/auth/crypto";
import { cookies } from "next/headers";

// Serves processed web derivatives only. Originals are never reachable through this route.
// Public access requires the asset to be used by a live entry or a public setting (M07);
// otherwise only signed-in editors (preview) can load it, with private caching.

export async function GET(req: Request, ctx: { params: Promise<{ assetId: string; file: string }> }) {
  const { assetId, file } = await ctx.params;
  const m = file.match(/^(\d{2,4})\.(webp|jpg)$/);
  if (!isUuid(assetId) || !m) return new Response("Not found", { status: 404 });
  const width = Number(m[1]);
  const format = m[2] === "jpg" ? "jpeg" : "webp";

  const v = await q1<{ key: string; public: boolean }>(
    `SELECT v.key,
            EXISTS (SELECT 1 FROM media_usage u WHERE u.asset_id = v.asset_id AND u.in_published) AS public
       FROM media_variants v JOIN media_assets a ON a.id = v.asset_id
      WHERE v.asset_id = $1 AND v.width = $2 AND v.format = $3 AND a.state = 'ready' AND a.deleted_at IS NULL`,
    [assetId, width, format],
  );
  if (!v) return new Response("Not found", { status: 404 });

  let cache = "public, max-age=300, s-maxage=60, stale-while-revalidate=30";
  if (!v.public) {
    const user = await getSessionUser();
    if (!user) {
      // Expiring preview link: only media used by the previewed entry.
      const pv = (await cookies()).get("bakes_pv")?.value;
      const ok = pv
        ? await q1(
            `SELECT 1 FROM preview_tokens t JOIN media_usage u ON u.owner_kind = 'entry' AND u.owner_id = t.entry_id::text
              WHERE t.token_hash = $1 AND t.expires_at > now() AND u.asset_id = $2`,
            [sha256(pv), assetId],
          )
        : null;
      if (!ok) return new Response("Not found", { status: 404 });
    }
    cache = "private, no-store";
  }

  const body = await getObject(v.key);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "jpeg" ? "image/jpeg" : "image/webp",
      "Content-Length": String(body.length),
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${width}.${m[2]}"`,
      ...(v.public ? {} : { "X-Robots-Tag": "noindex" }),
    },
  });
}
