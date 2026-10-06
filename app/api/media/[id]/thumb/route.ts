import { q1 } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getObject } from "@/lib/storage";
import { isUuid } from "@/lib/content/sanitize";

// Editor thumbnail: smallest processed variant. Signed-in editors only.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const user = await getSessionUser();
  if (!user) return new Response("Not found", { status: 404 });
  const v = await q1<{ key: string }>(
    `SELECT key FROM media_variants WHERE asset_id = $1 AND format = 'webp' ORDER BY width ASC LIMIT 1`,
    [id],
  );
  if (!v) return new Response("Not ready", { status: 404 });
  const body = await getObject(v.key);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}
