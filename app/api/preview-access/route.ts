import { NextResponse } from "next/server";
import { q1 } from "@/lib/db";
import { sha256 } from "@/lib/auth/crypto";
import { isUuid } from "@/lib/content/sanitize";

// Exchanges an expiring preview link for a short-lived, httpOnly cookie so the
// private preview's draft photos can load. The cookie only unlocks that one entry.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const token = url.searchParams.get("token") ?? "";
  if (!isUuid(id) || !token) return new NextResponse("Not found", { status: 404 });
  const row = await q1<{ expires_at: string }>(
    `SELECT expires_at FROM preview_tokens WHERE token_hash = $1 AND entry_id = $2 AND expires_at > now()`,
    [sha256(token), id],
  );
  if (!row) return new NextResponse("This preview link has expired.", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  const res = NextResponse.redirect(new URL(`/preview/${id}`, url.origin), 303);
  res.cookies.set("bakes_pv", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(row.expires_at),
  });
  res.headers.set("X-Robots-Tag", "noindex");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
