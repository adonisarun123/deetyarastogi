import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listEntries } from "@/lib/content/repo";
import { ENTRY_TYPES, TYPE_LABEL, entryPath } from "@/lib/content/types";
import { formatDateTime } from "@/lib/text";
import { StateBadge } from "@/components/dashboard/StateBadge";
import { EntryRowActions } from "@/components/dashboard/EntryRowActions";
import { NewEntryButtons } from "@/components/dashboard/NewEntryButtons";

export const metadata = { title: "Entries" };

type SP = Promise<{ q?: string; type?: string; state?: string; page?: string }>;

export default async function EntriesPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { items, total } = await listEntries(user, { q: sp.q, type: sp.type, state: sp.state, limit: 30, offset: (page - 1) * 30 });
  const pages = Math.max(1, Math.ceil(total / 30));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (sp.q) u.set("q", sp.q);
    if (sp.type) u.set("type", sp.type);
    if (sp.state) u.set("state", sp.state);
    if (p > 1) u.set("page", String(p));
    return `/dashboard/entries${u.toString() ? `?${u}` : ""}`;
  };

  return (
    <>
      <h1>Entries</h1>
      <details className="s-panel">
        <summary>New entry</summary>
        <div style={{ marginTop: 12 }}>
          <NewEntryButtons />
        </div>
      </details>

      <form className="s-panel row" style={{ alignItems: "flex-end" }} method="get">
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="q">Search titles</label>
          <input id="q" name="q" type="search" defaultValue={sp.q ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue={sp.type ?? ""}>
            <option value="">All types</option>
            {ENTRY_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="state">Status</label>
          <select id="state" name="state" defaultValue={sp.state ?? ""}>
            <option value="">All (not trash)</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
            <option value="trashed">Trash</option>
          </select>
        </div>
        <button className="btn" type="submit">
          Filter
        </button>
      </form>

      <section className="s-panel" aria-label="Entry list">
        <p className="muted" role="status" style={{ marginTop: 0 }}>
          {total} {total === 1 ? "entry" : "entries"}
          {sp.state === "trashed" ? " in trash — entries are permanently removed after 30 days." : ""}
        </p>
        {items.length ? (
          <table className="s-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Last edited</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.state === "trashed" ? <span style={{ fontWeight: 600 }}>{e.title}</span> : <Link href={`/dashboard/entries/${e.id}`}>{e.title}</Link>}
                    {e.state === "published" ? (
                      <>
                        {" "}
                        <a href={entryPath(e.type, e.slug)} target="_blank" rel="noopener" style={{ fontWeight: 400, fontSize: "0.875rem" }}>
                          view live
                        </a>
                      </>
                    ) : null}
                  </td>
                  <td>{TYPE_LABEL[e.type]}</td>
                  <td>
                    <StateBadge state={e.state} changes={e.has_unpublished_changes} />
                  </td>
                  <td>{formatDateTime(e.updated_at)}</td>
                  <td>
                    <EntryRowActions id={e.id} state={e.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No entries match. {sp.q || sp.type || sp.state ? <Link href="/dashboard/entries">Clear filters</Link> : null}</p>
        )}
        {pages > 1 ? (
          <nav className="row" aria-label="Pages" style={{ marginTop: 16 }}>
            {page > 1 ? <Link href={qs(page - 1)}>← Previous</Link> : null}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages ? <Link href={qs(page + 1)}>Next →</Link> : null}
          </nav>
        ) : null}
      </section>
    </>
  );
}
