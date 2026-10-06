import "server-only";
import { NextResponse } from "next/server";
import { q, q1, type Queryable } from "./db";
import { HttpError } from "./auth/session";
import { sha256 } from "./auth/crypto";

export async function audit(
  actorId: string | null,
  action: string,
  objectType: string,
  objectId: string | null,
  detail: Record<string, unknown> = {},
  db?: Queryable,
) {
  await q(
    `INSERT INTO audit_events (actor_id, action, object_type, object_id, detail) VALUES ($1,$2,$3,$4,$5)`,
    [actorId, action, objectType, objectId, JSON.stringify(detail)],
    db,
  );
}

export async function opsEvent(kind: string, objectId: string | null, message: string) {
  // Safe diagnostic context only — never message bodies, tokens or drafts.
  console.error(`[ops] ${kind} ${objectId ?? ""}: ${message}`);
  await q(`INSERT INTO ops_events (kind, object_id, message) VALUES ($1,$2,$3)`, [kind, objectId, message.slice(0, 500)]).catch(
    () => {},
  );
}

/** Fixed-window rate limiter backed by Postgres. Returns true when allowed. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const row = await q1<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start < now() - ($2 || ' seconds')::interval THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start < now() - ($2 || ' seconds')::interval THEN now() ELSE rate_limits.window_start END
     RETURNING count`,
    [key, String(windowSeconds)],
  );
  return (row?.count ?? 0) <= limit;
}

export function clientKey(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  return sha256(`${ip}|${process.env.RATE_LIMIT_SALT ?? "bakes"}`).slice(0, 24);
}

/** Wraps a route handler with uniform JSON error handling and safe logging. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message, ...(err.extra ?? {}) }, { status: err.status });
      }
      const e = err as Error;
      console.error(`[api] ${e?.name ?? "Error"}: ${e?.message ?? String(err)}`);
      return NextResponse.json({ error: "Something went wrong on the server. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request, maxBytes = 2_000_000): Promise<Record<string, unknown>> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "That request is too large.");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "That request is too large.");
  try {
    const v = JSON.parse(text || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Invalid request body.");
  }
}

export const noStore = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };
