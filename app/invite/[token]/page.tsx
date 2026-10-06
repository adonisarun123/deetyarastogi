import "../../dashboard/dashboard.css";
import { q1 } from "@/lib/db";
import { sha256 } from "@/lib/auth/crypto";
import { AcceptForm } from "./AcceptForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set your password", robots: { index: false, follow: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await q1<{ email: string; role: string; purpose: string }>(
    `SELECT email, role, purpose FROM invites WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [sha256(token)],
  ).catch(() => null);
  return (
    <div className="studio">
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
        <div className="s-panel" style={{ width: "min(460px, 100%)", padding: 28 }}>
          {inv ? (
            <>
              <h1>{inv.purpose === "reset" ? "Choose a new password" : "Welcome to the studio"}</h1>
              <p className="muted">
                {inv.purpose === "reset" ? "Resetting the password for " : "You’re joining as "}
                <strong>{inv.purpose === "reset" ? inv.email : inv.role === "owner" ? "the site owner" : "the baker (author)"}</strong>
                {inv.purpose === "reset" ? "." : ` with ${inv.email}.`}
              </p>
              <AcceptForm token={token} needsName={inv.purpose !== "reset"} />
            </>
          ) : (
            <>
              <h1>This link has expired</h1>
              <p className="muted">Invite and reset links work once and last 72 hours. Ask the site owner for a new one.</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
