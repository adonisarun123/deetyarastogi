import { pageOwner } from "@/lib/auth/owner";
import { q } from "@/lib/db";
import { getPrivateSettings } from "@/lib/site";
import { formatDateTime } from "@/lib/text";
import { AdminButton } from "@/components/dashboard/AdminButton";
import { InviteForm, PrivateSettingsForm, ResetLinkButton } from "@/components/dashboard/OwnerForms";
import { storageDriver } from "@/lib/storage";

export const metadata = { title: "Owner settings" };

export default async function OwnerSettings() {
  const owner = await pageOwner();
  const [users, invites, priv, audit, ops] = await Promise.all([
    q<{ id: string; email: string; display_name: string; role: string; status: string; totp_enabled: boolean; created_at: string; last_seen: string | null }>(
      `SELECT u.id, u.email, u.display_name, u.role, u.status, u.totp_enabled, u.created_at,
              (SELECT max(last_seen_at) FROM sessions s WHERE s.user_id = u.id) AS last_seen
         FROM users u ORDER BY u.created_at`,
    ),
    q<{ id: string; email: string; role: string; purpose: string; expires_at: string }>(
      `SELECT id, email, role, purpose, expires_at FROM invites WHERE used_at IS NULL AND expires_at > now() ORDER BY created_at DESC`,
    ),
    getPrivateSettings(),
    q<{ action: string; object_type: string; object_id: string | null; created_at: string; actor: string | null }>(
      `SELECT a.action, a.object_type, a.object_id, a.created_at, u.display_name AS actor
         FROM audit_events a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 100`,
    ),
    q<{ kind: string; object_id: string | null; message: string; created_at: string; resolved: boolean }>(
      `SELECT kind, object_id, message, created_at, resolved FROM ops_events ORDER BY created_at DESC LIMIT 30`,
    ),
  ]);

  return (
    <>
      <h1>Owner settings</h1>

      <section className="s-panel">
        <h2>People with access</h2>
        <p className="hint">There is no public sign-up. Revoking access signs the person out everywhere immediately.</p>
        <table className="s-table">
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Last active</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.display_name}</strong>
                  <div className="muted" style={{ fontSize: "0.875rem" }}>
                    {u.email}
                  </div>
                </td>
                <td>{u.role === "owner" ? "Owner" : "Author"}</td>
                <td>
                  <span className={`state ${u.status === "active" ? "state-published" : "state-trashed"}`}>{u.status === "active" ? "Active" : "Revoked"}</span>{" "}
                  {u.totp_enabled ? <span className="state state-changes">2-step on</span> : null}
                </td>
                <td>{u.last_seen ? formatDateTime(u.last_seen) : "—"}</td>
                <td>
                  {u.id !== owner.id ? (
                    <span className="row" style={{ gap: 6 }}>
                      {u.status === "active" ? (
                        <AdminButton body={{ action: "revoke", userId: u.id }} label="Revoke access" danger confirmText={`Revoke ${u.display_name}'s access? They’ll be signed out at once.`} />
                      ) : (
                        <AdminButton body={{ action: "reactivate", userId: u.id }} label="Restore access" />
                      )}
                      <AdminButton body={{ action: "sign-out-everywhere", userId: u.id }} label="Sign out everywhere" />
                      <ResetLinkButton email={u.email} />
                    </span>
                  ) : (
                    <span className="muted">You</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {invites.length ? (
          <>
            <h3 style={{ marginTop: 20 }}>Pending links</h3>
            <ul>
              {invites.map((i) => (
                <li key={i.id}>
                  {i.purpose === "reset" ? "Password reset" : `Invite (${i.role})`} for {i.email} — expires {formatDateTime(i.expires_at)}{" "}
                  <AdminButton body={{ action: "cancel-invite", inviteId: i.id }} label="Cancel" />
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <h3 style={{ marginTop: 20 }}>Invite someone</h3>
        <InviteForm />
      </section>

      <section className="s-panel">
        <h2>Inbox & integrations</h2>
        <PrivateSettingsForm initial={priv} />
      </section>

      <section className="s-panel">
        <h2>Export & backups</h2>
        <p>
          <a className="btn btn-small" href="/api/admin/export" download>
            Download full content export (JSON)
          </a>
        </p>
        <p className="hint">
          Includes every entry, all revisions with structured recipe data, categories, tags, relationships, slugs, redirects, settings, profile and a media manifest.
          Photo files are restored with <span className="kbd">npm run restore -- export.json</span> (see README). Enquiries and account details are excluded.
        </p>
        <p className="hint">
          Database: point-in-time restore is provided by Neon (history window depends on the plan). Photos: {storageDriver() === "s3" ? "Neon Object Storage bucket “media”." : "LOCAL development folder — not for production."}
        </p>
      </section>

      <section className="s-panel">
        <div className="spread">
          <h2 style={{ margin: 0 }}>System problems</h2>
          {ops.some((o) => !o.resolved) ? <AdminButton body={{ action: "resolve-ops" }} label="Mark all resolved" /> : null}
        </div>
        {ops.length ? (
          <ul>
            {ops.map((o, i) => (
              <li key={i} style={{ opacity: o.resolved ? 0.6 : 1 }}>
                <strong>{o.kind.replace(/_/g, " ")}</strong> — {o.message} <span className="muted">({formatDateTime(o.created_at)})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No upload, publishing or delivery failures recorded.</p>
        )}
      </section>

      <section className="s-panel">
        <h2>Audit history (last 100)</h2>
        <table className="s-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Who</th>
              <th scope="col">What</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((a, i) => (
              <tr key={i}>
                <td>{formatDateTime(a.created_at)}</td>
                <td>{a.actor ?? "—"}</td>
                <td>
                  {a.action.replace(/[._]/g, " ")} <span className="muted">{a.object_type}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
