import { notFound, redirect } from "next/navigation";
import { requireUser, HttpError } from "@/lib/auth/session";
import { getEntryForEdit, listTerms } from "@/lib/content/repo";
import { Editor } from "@/components/dashboard/editor/Editor";

export const metadata = { title: "Edit entry" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let data;
  try {
    data = await getEntryForEdit(user, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 403) redirect("/dashboard?denied=1");
    notFound();
  }
  const terms = await listTerms();
  const e = data.entry;
  return (
    <Editor
      key={e.id}
      entry={{
        id: e.id,
        type: e.type,
        slug: e.slug,
        state: e.state,
        working_version: e.working_version,
        has_unpublished_changes: e.has_unpublished_changes,
        first_published_at: e.first_published_at ? new Date(e.first_published_at).toISOString() : null,
        last_published_at: e.last_published_at ? new Date(e.last_published_at).toISOString() : null,
        updated_at: new Date(e.updated_at).toISOString(),
        published: Boolean(e.published_revision_id),
      }}
      content={{ ...data.content, slug: data.content.slug || (e.slug.startsWith("draft-") ? "" : e.slug) }}
      terms={terms}
    />
  );
}
