import { NextResponse } from "next/server";
import { q, q1 } from "@/lib/db";
import { assertSameOrigin, createSession, HttpError } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/crypto";
import { audit, clientKey, handle, rateLimit, readJson } from "@/lib/ops";

const GENERIC = "That email and password don’t match. Please try again.";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJson(req, 5000);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(body.password ?? "").slice(0, 200);
  if (!email || !password) throw new HttpError(400, "Enter your email and password.");

  if (!(await rateLimit(`login:${clientKey(req)}`, 10, 900)) || !(await rateLimit(`login-email:${email}`, 8, 900))) {
    throw new HttpError(429, "Too many sign-in attempts. Please wait 15 minutes.");
  }

  const u = await q1<{ id: string; password_hash: string; status: string; totp_enabled: boolean; locked_until: string | null }>(
    `SELECT id, password_hash, status, totp_enabled, locked_until FROM users WHERE email = $1`,
    [email],
  );
  if (!u || u.status !== "active") {
    // Spend similar time to avoid user enumeration.
    await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    throw new HttpError(401, GENERIC);
  }
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    throw new HttpError(429, "This account is temporarily locked after several failed attempts. Try again later.");
  }
  if (!(await verifyPassword(password, u.password_hash))) {
    await q(
      `UPDATE users SET failed_logins = failed_logins + 1,
          locked_until = CASE WHEN failed_logins + 1 >= 8 THEN now() + interval '15 minutes' ELSE locked_until END
        WHERE id = $1`,
      [u.id],
    );
    throw new HttpError(401, GENERIC);
  }
  await q(`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1`, [u.id]);
  await createSession(u.id, u.totp_enabled);
  await audit(u.id, "auth.login", "user", u.id, { mfa: u.totp_enabled });
  return NextResponse.json({ ok: true, mfa: u.totp_enabled });
});
