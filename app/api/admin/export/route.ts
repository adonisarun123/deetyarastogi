import { apiOwner } from "@/lib/auth/owner";
import { q } from "@/lib/db";
import { audit, handle } from "@/lib/ops";

// Portability: entries, all revisions (with structured recipe data), taxonomy, relationships,
// settings, profile, experiences, redirects and a media manifest (with original download keys
// listed for the owner-run restore script). Account secrets and enquiries are excluded.
export const GET = handle(async (req: Request) => {
  const owner = await apiOwner(req);
  const [entries, revisions, terms, media, variants, usage, settings, profile, experiences, redirects, publicIndex] = await Promise.all([
    q(`SELECT id, type, slug, state, working_revision_id, published_revision_id, first_published_at, last_published_at, trashed_at, created_at, updated_at FROM entries ORDER BY created_at`),
    q(`SELECT id, entry_id, kind, content, created_at, note FROM entry_revisions ORDER BY entry_id, created_at`),
    q(`SELECT id, kind, name, slug, merged_into, created_at FROM terms ORDER BY kind, name`),
    q(`SELECT id, original_key, mime, bytes, width, height, state, default_alt, default_caption, credit, focal_x, focal_y, created_at FROM media_assets WHERE deleted_at IS NULL ORDER BY created_at`),
    q(`SELECT asset_id, width, height, format, key, bytes FROM media_variants ORDER BY asset_id, width`),
    q(`SELECT asset_id, owner_kind, owner_id, in_draft, in_published FROM media_usage`),
    q(`SELECT data - 'private' AS data FROM site_settings WHERE id = 1`),
    q(`SELECT data FROM author_profile WHERE id = 1`),
    q(`SELECT * FROM experiences ORDER BY display_order`),
    q(`SELECT * FROM redirects`),
    q(`SELECT * FROM public_entries`),
  ]);
  await audit(owner.id, "export.download", "site", null, { entries: entries.length, media: media.length });
  const body = JSON.stringify(
    {
      format: "baking-scrapbook-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      entries,
      revisions,
      terms,
      media,
      variants,
      mediaUsage: usage,
      settings: settings[0]?.data ?? {},
      profile: profile[0]?.data ?? {},
      experiences,
      redirects,
      publicIndex,
    },
    null,
    2,
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="scrapbook-export-${stamp}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
});
