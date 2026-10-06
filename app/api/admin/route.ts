import { NextResponse } from "next/server";
import { HttpError, revokeUserSessions } from "@/lib/auth/session";
import { apiOwner } from "@/lib/auth/owner";
import { q, q1 } from "@/lib/db";
import { audit, handle, noStore, readJson } from "@/lib/ops";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { isUuid } from "@/lib/content/sanitize";

// Owner tools: invites, access revocation, password-reset links, inbox management.

export const POST = handle(async (req: Request) => {
  const owner = await apiOwner(req);
  const b = await readJson(req, 10_000);
  const action = String(b.action ?? "");

  if (action === "invite" || action === "reset-link") {
    const email = String(b.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email.");
    const role = b.role === "owner" ? "owner" : "author";
    if (action === "reset-link" && !(await q1(`SELECT 1 FROM users WHERE email = $1`, [email]))) throw new HttpError(404, "No account with that email.");
    const token = randomToken();
    await q(
      `INSERT INTO invites (token_hash, email, role, purpose, created_by, expires_at) VALUES ($1,$2,$3,$4,$5, now() + interval '72 hours')`,
      [sha256(token), email, role, action === "invite" ? "invite" : "reset", owner.id],
    );
    await audit(owner.id, action === "invite" ? "user.invite" : "user.reset_link", "user", email, { role });
    // Shown once to the owner, who sends it to the person directly.
    return NextResponse.json({ url: `/invite/${token}`, expiresInHours: 72 }, { headers: noStore });
  }

  if (action === "revoke" || action === "reactivate") {
    const id = String(b.userId ?? "");
    if (!isUuid(id)) throw new HttpError(400, "Choose a user.");
    if (id === owner.id) throw new HttpError(400, "You can’t revoke your own access.");
    await q(`UPDATE users SET status = $2, updated_at = now() WHERE id = $1`, [id, action === "revoke" ? "revoked" : "active"]);
    if (action === "revoke") await revokeUserSessions(id);
    await audit(owner.id, `user.${action}`, "user", id);
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  if (action === "sign-out-everywhere") {
    const id = String(b.userId ?? "");
    if (!isUuid(id)) throw new HttpError(400, "Choose a user.");
    await revokeUserSessions(id);
    await audit(owner.id, "user.sessions_revoked", "user", id);
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  if (action === "cancel-invite") {
    const id = String(b.inviteId ?? "");
    if (!isUuid(id)) throw new HttpError(400, "Choose an invite.");
    await q(`DELETE FROM invites WHERE id = $1 AND used_at IS NULL`, [id]);
    await audit(owner.id, "user.invite_cancelled", "invite", id);
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  if (action === "message") {
    const id = String(b.messageId ?? "");
    if (!isUuid(id)) throw new HttpError(400, "Choose a message.");
    const op = String(b.op ?? "");
    if (op === "read" || op === "archived" || op === "new") await q(`UPDATE contact_requests SET status = $2 WHERE id = $1`, [id, op]);
    else if (op === "keep" || op === "unkeep") await q(`UPDATE contact_requests SET keep = $2 WHERE id = $1`, [id, op === "keep"]);
    else if (op === "delete") await q(`DELETE FROM contact_requests WHERE id = $1`, [id]);
    else throw new HttpError(400, "Unknown message action.");
    await audit(owner.id, `inbox.${op}`, "message", id);
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  if (action === "resolve-ops") {
    await q(`UPDATE ops_events SET resolved = true WHERE NOT resolved`);
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  throw new HttpError(400, "Unknown action.");
});
