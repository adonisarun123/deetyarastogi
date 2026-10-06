import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { q, q1 } from "../db";
import { randomToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "bakes_session";
const SESSION_DAYS = 14;

export type Role = "owner" | "author";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  totpEnabled: boolean;
  sessionId: string;
  mfaPending: boolean;
}

export async function createSession(userId: string, mfaPending: boolean) {
  const token = randomToken();
  const h = await headers();
  await q(
    `INSERT INTO sessions (id, user_id, mfa_pending, expires_at, user_agent)
     VALUES ($1, $2, $3, now() + ($4 || ' days')::interval, $5)`,
    [sha256(token), userId, mfaPending, String(SESSION_DAYS), (h.get("user-agent") ?? "").slice(0, 300)],
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await q(`DELETE FROM sessions WHERE id = $1`, [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Returns the signed-in user, or null. Revoked users and expired sessions resolve to null. */
export async function getSessionUser(opts: { allowMfaPending?: boolean } = {}): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await q1<{
    id: string;
    email: string;
    display_name: string;
    role: Role;
    totp_enabled: boolean;
    session_id: string;
    mfa_pending: boolean;
    last_seen_at: string;
  }>(
    `SELECT u.id, u.email, u.display_name, u.role, u.totp_enabled, s.id AS session_id, s.mfa_pending, s.last_seen_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now() AND u.status = 'active'`,
    [sha256(token)],
  );
  if (!row) return null;
  if (row.mfa_pending && !opts.allowMfaPending) return null;
  // Touch at most every 10 minutes.
  if (Date.now() - new Date(row.last_seen_at).getTime() > 10 * 60 * 1000) {
    q(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [row.session_id]).catch(() => {});
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    totpEnabled: row.totp_enabled,
    sessionId: row.session_id,
    mfaPending: row.mfa_pending,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/dashboard/login");
  return u;
}

export async function requireOwner(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "owner") redirect("/dashboard?denied=1");
  return u;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** For route handlers: throws 401/403 instead of redirecting. Also enforces same-origin (CSRF). */
export async function apiUser(req: Request, role?: Role): Promise<SessionUser> {
  assertSameOrigin(req);
  const u = await getSessionUser();
  if (!u) throw new HttpError(401, "Please sign in again.");
  if (role === "owner" && u.role !== "owner") throw new HttpError(403, "Only the owner can do that.");
  return u;
}

export function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new HttpError(403, "Missing origin.");
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, "Cross-site request blocked.");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "Bad origin.");
  }
}

export async function revokeUserSessions(userId: string) {
  await q(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}
