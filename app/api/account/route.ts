import { NextResponse } from "next/server";
import { apiUser, HttpError } from "@/lib/auth/session";
import { q, q1 } from "@/lib/db";
import { audit, handle, noStore, readJson } from "@/lib/ops";
import { hashPassword, newTotpSecret, totpUri, verifyPassword, verifyTotp } from "@/lib/auth/crypto";

export const POST = handle(async (req: Request) => {
  const user = await apiUser(req);
  const b = await readJson(req, 5000);
  const action = String(b.action ?? "");
  const row = await q1<{ password_hash: string; totp_secret: string | null; totp_enabled: boolean }>(
    `SELECT password_hash, totp_secret, totp_enabled FROM users WHERE id = $1`,
    [user.id],
  );
  if (!row) throw new HttpError(404, "Account not found.");

  if (action === "password") {
    if (!(await verifyPassword(String(b.current ?? ""), row.password_hash))) throw new HttpError(400, "Your current password isn’t right.");
    const next = String(b.next ?? "");
    if (next.length < 10) throw new HttpError(400, "Use at least 10 characters.");
    await q(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [user.id, await hashPassword(next)]);
    // Sign out other sessions.
    await q(`DELETE FROM sessions WHERE user_id = $1 AND id <> $2`, [user.id, user.sessionId]);
    await audit(user.id, "account.password_changed", "user", user.id);
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  if (action === "mfa-start") {
    if (row.totp_enabled) throw new HttpError(400, "Two-step sign-in is already on.");
    const secret = newTotpSecret();
    await q(`UPDATE users SET totp_secret = $2 WHERE id = $1`, [user.id, secret]);
    return NextResponse.json({ secret, uri: totpUri(secret, user.email, "Baking Scrapbook") }, { headers: noStore });
  }

  if (action === "mfa-enable") {
    if (!row.totp_secret || !verifyTotp(row.totp_secret, String(b.code ?? ""))) throw new HttpError(400, "That code didn’t match. Try the newest code.");
    await q(`UPDATE users SET totp_enabled = true, updated_at = now() WHERE id = $1`, [user.id]);
    await audit(user.id, "account.mfa_enabled", "user", user.id);
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  if (action === "mfa-disable") {
    if (!(await verifyPassword(String(b.current ?? ""), row.password_hash))) throw new HttpError(400, "Your password isn’t right.");
    if (!row.totp_secret || !verifyTotp(row.totp_secret, String(b.code ?? ""))) throw new HttpError(400, "That code didn’t match.");
    await q(`UPDATE users SET totp_enabled = false, totp_secret = NULL, updated_at = now() WHERE id = $1`, [user.id]);
    await audit(user.id, "account.mfa_disabled", "user", user.id);
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  if (action === "name") {
    const name = String(b.displayName ?? "").trim().slice(0, 80);
    if (!name) throw new HttpError(400, "Enter a name.");
    await q(`UPDATE users SET display_name = $2 WHERE id = $1`, [user.id, name]);
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  throw new HttpError(400, "Unknown action.");
});
