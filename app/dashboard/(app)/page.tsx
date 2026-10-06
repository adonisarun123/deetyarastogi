import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listEntries } from "@/lib/content/repo";
import { q } from "@/lib/db";
import { NewEntryButtons } from "@/components/dashboard/NewEntryButtons";
import { StateBadge } from "@/components/dashboard/StateBadge";
import { TYPE_LABEL, entryPath } from "@/lib/content/types";
import { formatDateTime } from "@/lib/text";
import { OWNER_MFA_REQUIRED } from "@/lib/auth/owner";

export const metadata = { title: "Overview" };

export default async function Overview({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [drafts, published, failedUploads, ops, inbox] = await Promise.all([
    listEntries(user, { state: "draft", limit: 6 }),
    listEntries(user, { state: "published", limit: 6 }),
    q<{ id: string; error: string | null; created_at: string }>(
      `SELECT id, error, created_at FROM media_assets WHERE state = 'failed' AND deleted_at IS NULL ${user.role === "owner" ? "" : "AND created_by = $1"} ORDER BY created_at DESC LIMIT 5`,
      user.role === "owner" ? [] : [user.id],
    ),
    user.role === "owner"
      ? q<{ kind: string; message: string; created_at: string }>(`SELECT kind, message, created_at FROM ops_events WHERE NOT resolved ORDER BY created_at DESC LIMIT 5`)
      : Promise.resolve([]),
    user.role === "owner" ? q<{ n: string }>(`SELECT count(*) AS n FROM contact_requests WHERE status = 'new'`) : Promise.resolve([{ n: "0" }]),
  ]);
  const unread = Number(inbox[0]?.n ?? 0);

  return (
    <>
      {sp.denied ? (
        <p className="alert alert-error" role="alert">
          That area is for the site owner.
        </p>
      ) : null}
      {user.role === "owner" && OWNER_MFA_REQUIRED && !user.totpEnabled ? (
        <p className="alert alert-info">
          <strong>Turn on two-step sign-in</strong> to unlock owner tools (accounts, inbox, export). <Link href="/dashboard/account">Set it up now</Link>.
        </p>
      ) : null}

      <h1>Hello, {user.displayName.split(" ")[0]}</h1>
      <section className="s-panel" aria-labelledby="new-h">
        <h2 id="new-h">Start something new</h2>
        <NewEntryButtons />
      </section>

      {failedUploads.length || ops.length ? (
        <section className="s-panel" aria-labelledby="attn-h" style={{ borderColor: "#e7a3b0" }}>
          <h2 id="attn-h">Needs attention</h2>
          <ul>
            {failedUploads.map((f) => (
              <li key={f.id}>
                A photo upload failed: {f.error ?? "unknown reason"} — <Link href="/dashboard/media?filter=failed">retry or replace</Link>
              </li>
            ))}
            {ops.map((o, i) => (
              <li key={i}>
                {o.kind.replace(/_/g, " ")}: {o.message} <span className="muted">({formatDateTime(o.created_at)})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="s-grid cols-2" style={{ marginTop: 16 }}>
        <section className="s-panel" aria-labelledby="drafts-h" style={{ marginTop: 0 }}>
          <div className="spread">
            <h2 id="drafts-h" style={{ margin: 0 }}>
              Recent drafts
            </h2>
            <Link href="/dashboard/entries?state=draft">All drafts</Link>
          </div>
          {drafts.items.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
              {drafts.items.map((e) => (
                <li key={e.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <Link href={`/dashboard/entries/${e.id}`}>{e.title}</Link>
                  <div className="muted" style={{ fontSize: "0.875rem" }}>
                    {TYPE_LABEL[e.type]} · edited {formatDateTime(e.updated_at)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No drafts yet. Start one above.</p>
          )}
        </section>
        <section className="s-panel" aria-labelledby="pub-h" style={{ marginTop: 0 }}>
          <div className="spread">
            <h2 id="pub-h" style={{ margin: 0 }}>
              Recently published
            </h2>
            <Link href="/dashboard/entries?state=published">All published</Link>
          </div>
          {published.items.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
              {published.items.map((e) => (
                <li key={e.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <Link href={`/dashboard/entries/${e.id}`}>{e.title}</Link>{" "}
                  <StateBadge state={e.state} changes={e.has_unpublished_changes} />
                  <div className="muted" style={{ fontSize: "0.875rem" }}>
                    {TYPE_LABEL[e.type]} ·{" "}
                    <a href={entryPath(e.type, e.slug)} target="_blank" rel="noopener">
                      view live
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing published yet.</p>
          )}
        </section>
      </div>

      {user.role === "owner" ? (
        <section className="s-panel" style={{ marginTop: 16 }}>
          <h2>Inbox</h2>
          <p style={{ margin: 0 }}>
            {unread ? (
              <>
                <strong>{unread}</strong> new {unread === 1 ? "note" : "notes"}. <Link href="/dashboard/inbox">Open inbox</Link>
              </>
            ) : (
              "No new notes."
            )}
          </p>
        </section>
      ) : null}
    </>
  );
}
