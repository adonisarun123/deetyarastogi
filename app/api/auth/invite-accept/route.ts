import { NextResponse } from "next/server";
import { q1, tx } from "@/lib/db";
import { assertSameOrigin, createSession, HttpError } from "@/lib/auth/session";
import { hashPassword, sha256 } from "@/lib/auth/crypto";
import { audit, clientKey, handle, rateLimit, readJson } from "@/lib/ops";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  if (!(await rateLimit(`invite:${clientKey(req)}`, 10, 900))) throw new HttpError(429, "Too many attempts. Please wait a few minutes.");
  const body = await readJson(req, 5000);
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim().slice(0, 80);
  if (password.length < 10) throw new HttpError(400, "Use at least 10 characters for your password.");
  if (password.length > 200) throw new HttpError(400, "That password is too long.");

  const inv = await q1<{ id: string; email: string; role: "owner" | "author"; purpose: string }>(
    `SELECT id, email, role, purpose FROM invites WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [sha256(token)],
  );
  if (!inv) throw new HttpError(400, "This link has expired or was already used. Ask the site owner for a new one.");

  const hash = await hashPassword(password);
  const userId = await tx(async (db) => {
    await db.query(`UPDATE invites SET used_at = now() WHERE id = $1`, [inv.id]);
    if (inv.purpose === "reset") {
      const r = await db.query<{ id: string }>(
        `UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL, updated_at = now() WHERE email = $1 RETURNING id`,
        [inv.email, hash],
      );
      if (!r.rows[0]) throw new HttpError(400, "That account no longer exists.");
      await db.query(`DELETE FROM sessions WHERE user_id = $1`, [r.rows[0].id]);
      return r.rows[0].id;
    }
    const r = await db.query<{ id: string }>(
      `INSERT INTO users (email, display_name, role, password_hash) VALUES ($1,$2,$3,$4)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active', role = EXCLUDED.role, updated_at = now()
       RETURNING id`,
      [inv.email, displayName || inv.email.split("@")[0], inv.role, hash],
    );
    return r.rows[0].id;
  });
  await audit(userId, inv.purpose === "reset" ? "auth.password_reset" : "auth.invite_accepted", "user", userId, { role: inv.role });
  await createSession(userId, false);
  return NextResponse.json({ ok: true });
});
