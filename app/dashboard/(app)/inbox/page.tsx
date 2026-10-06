import { pageOwner } from "@/lib/auth/owner";
import { q } from "@/lib/db";
import { formatDateTime } from "@/lib/text";
import { AdminButton } from "@/components/dashboard/AdminButton";

export const metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await pageOwner();
  const { show } = await searchParams;
  const archived = show === "archived";
  const msgs = await q<{
    id: string;
    name: string;
    email: string;
    reason: string | null;
    message: string;
    status: string;
    delivery_status: string;
    delivery_error: string | null;
    keep: boolean;
    created_at: string;
  }>(
    `SELECT id, name, email, reason, message, status, delivery_status, delivery_error, keep, created_at
       FROM contact_requests WHERE status ${archived ? "= 'archived'" : "<> 'archived'"} ORDER BY created_at DESC LIMIT 200`,
  );
  return (
    <>
      <div className="spread">
        <h1 style={{ margin: 0 }}>Inbox</h1>
        <a href={archived ? "/dashboard/inbox" : "/dashboard/inbox?show=archived"}>{archived ? "← Current messages" : "Archived messages"}</a>
      </div>
      <p className="muted">Private. Messages are deleted after 90 days unless you choose “Keep”. Reply from your own email — the sender’s address is below.</p>
      {msgs.length ? (
        msgs.map((m) => (
          <article key={m.id} className="s-panel" style={m.status === "new" ? { borderColor: "var(--cherry)" } : undefined}>
            <div className="spread">
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
                {m.name} {m.status === "new" ? <span className="state state-draft">New</span> : null} {m.keep ? <span className="state state-published">Kept</span> : null}
              </h2>
              <span className="muted" style={{ fontSize: "0.9rem" }}>
                {formatDateTime(m.created_at)}
              </span>
            </div>
            <p style={{ margin: "4px 0" }}>
              <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your note")}`}>{m.email}</a>
              {m.reason ? <span className="muted"> · {m.reason}</span> : null}
            </p>
            <p style={{ whiteSpace: "pre-wrap", margin: "10px 0" }}>{m.message}</p>
            {m.delivery_status === "failed" ? (
              <p className="alert alert-error" style={{ fontSize: "0.9rem" }}>
                Email notification failed ({m.delivery_error}). The message is safe here.
              </p>
            ) : null}
            <div className="row" style={{ gap: 6 }}>
              {m.status === "new" ? <AdminButton body={{ action: "message", messageId: m.id, op: "read" }} label="Mark read" /> : null}
              {m.status !== "archived" ? <AdminButton body={{ action: "message", messageId: m.id, op: "archived" }} label="Archive" /> : <AdminButton body={{ action: "message", messageId: m.id, op: "read" }} label="Unarchive" />}
              <AdminButton body={{ action: "message", messageId: m.id, op: m.keep ? "unkeep" : "keep" }} label={m.keep ? "Stop keeping" : "Keep"} />
              <AdminButton body={{ action: "message", messageId: m.id, op: "delete" }} label="Delete" danger confirmText="Delete this message permanently?" />
            </div>
          </article>
        ))
      ) : (
        <p className="s-panel">No messages{archived ? " in the archive" : ""}.</p>
      )}
    </>
  );
}
