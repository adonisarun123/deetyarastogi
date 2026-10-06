import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntryView } from "@/components/EntryView";
import { getSessionUser } from "@/lib/auth/session";
import { canEdit } from "@/lib/content/repo";
import { q, q1 } from "@/lib/db";
import { sha256 } from "@/lib/auth/crypto";
import { isUuid, referencedAssetIds, sanitizeContent } from "@/lib/content/sanitize";
import { variantsFor } from "@/lib/media";
import { cardsByIds } from "@/lib/content/public";
import { getProfile, getSettings, siteUrl } from "@/lib/site";
import { cookies } from "next/headers";
import type { EntryType } from "@/lib/content/types";

// E04: unpublished preview. Requires a signed-in editor, or an expiring owner/author-created token.
// Never indexed, never cached publicly.

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false, nocache: true } };
export const dynamic = "force-dynamic";

export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get("bakes_pv")?.value;
  if (!isUuid(id)) notFound();
  const entry = await q1<{ id: string; type: EntryType; slug: string; created_by: string | null; working_revision_id: string; first_published_at: string | null; last_published_at: string | null }>(
    `SELECT id, type, slug, created_by, working_revision_id, first_published_at, last_published_at FROM entries WHERE id = $1 AND state <> 'trashed'`,
    [id],
  );
  if (!entry) notFound();

  let allowed = false;
  const user = await getSessionUser();
  if (user && canEdit(user, entry)) allowed = true;
  if (!allowed && token) {
    allowed = Boolean(await q1(`SELECT 1 FROM preview_tokens WHERE token_hash = $1 AND entry_id = $2 AND expires_at > now()`, [sha256(token), id]));
  }
  if (!allowed) notFound();

  const rev = await q1<{ content: unknown }>(`SELECT content FROM entry_revisions WHERE id = $1`, [entry.working_revision_id]);
  const content = sanitizeContent(entry.type, rev?.content);
  const [media, profile, settings] = await Promise.all([variantsFor(referencedAssetIds(content)), getProfile(), getSettings()]);
  const terms = await q<{ id: string; name: string; slug: string; kind: string }>(
    `SELECT id, name, slug, kind FROM terms WHERE id = ANY($1::uuid[])`,
    [[content.categoryId, ...content.tagIds].filter(Boolean)],
  );
  const cat = terms.find((t) => t.id === content.categoryId);
  const related = await cardsByIds(content.relatedIds);

  return (
    <>
      <div style={{ background: "var(--butter)", padding: "10px 0", fontWeight: 600 }} role="status">
        <div className="container">Preview — this is not public yet. Links and sharing are disabled in preview.</div>
      </div>
      <EntryView
        type={entry.type}
        slug={content.slug || entry.slug}
        content={content}
        media={media}
        authorName={profile.publicName}
        firstPublishedAt={entry.first_published_at ? new Date(entry.first_published_at).toISOString() : null}
        updatedAt={entry.last_published_at ? new Date(entry.last_published_at).toISOString() : null}
        categoryName={cat?.name ?? null}
        categorySlug={cat?.slug ?? null}
        tags={terms.filter((t) => t.kind === "tag")}
        related={related}
        siteUrl={siteUrl(settings)}
        preview
      />
    </>
  );
}
