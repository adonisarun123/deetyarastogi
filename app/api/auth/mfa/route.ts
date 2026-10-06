import { NextResponse } from "next/server";
import { q, q1 } from "@/lib/db";
import { assertSameOrigin, getSessionUser, HttpError } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/crypto";
import { audit, handle, rateLimit, readJson } from "@/lib/ops";

// Second step of sign-in for accounts with MFA enabled.
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const u = await getSessionUser({ allowMfaPending: true });
  if (!u) throw new HttpError(401, "Please sign in again.");
  if (!u.mfaPending) return NextResponse.json({ ok: true });
  if (!(await rateLimit(`mfa:${u.sessionId}`, 6, 600))) throw new HttpError(429, "Too many codes tried. Please sign in again later.");
  const body = await readJson(req, 2000);
  const row = await q1<{ totp_secret: string | null }>(`SELECT totp_secret FROM users WHERE id = $1`, [u.id]);
  if (!row?.totp_secret || !verifyTotp(row.totp_secret, String(body.code ?? ""))) {
    throw new HttpError(401, "That code didn’t work. Check your authenticator app and try again.");
  }
  await q(`UPDATE sessions SET mfa_pending = false WHERE id = $1`, [u.sessionId]);
  await audit(u.id, "auth.mfa_passed", "user", u.id);
  return NextResponse.json({ ok: true });
});
