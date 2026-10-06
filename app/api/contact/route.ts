import { NextResponse, after } from "next/server";
import { q1 } from "@/lib/db";
import { clientKey, handle, rateLimit, readJson } from "@/lib/ops";
import { deliverEnquiry } from "@/lib/notify";
import { assertSameOrigin } from "@/lib/auth/session";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REASONS = new Set(["Learning opportunity", "Collaboration", "General message"]);

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJson(req, 20_000);
  const s = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  const name = s("name", 100);
  const email = s("email", 200);
  const reasonRaw = s("reason", 60);
  const message = s("message", 3200);
  const requestKey = s("requestKey", 80);

  // Spam trap & too-fast submissions: accept silently, store nothing.
  if (s("website", 200) || Number(body.elapsed ?? 9999) < 1500) {
    return NextResponse.json({ ok: true });
  }

  const fields: Record<string, string> = {};
  if (!name) fields.name = "Please tell us your name.";
  if (!email || !EMAIL.test(email)) fields.email = "That email doesn’t look right — please check it.";
  if (!message) fields.message = "Please write a message.";
  else if (message.length > 3000) fields.message = "Please keep the message under 3000 characters.";
  if (Object.keys(fields).length) return NextResponse.json({ error: "Please check the highlighted fields.", fields }, { status: 400 });

  const ok = await rateLimit(`contact:${clientKey(req)}`, 5, 600);
  if (!ok) return NextResponse.json({ error: "Too many notes in a short time. Please wait a few minutes." }, { status: 429 });

  // Durable acceptance first; idempotent on requestKey (double-click / retry → one enquiry).
  const row = await q1<{ id: string; inserted: boolean }>(
    `WITH ins AS (
       INSERT INTO contact_requests (name, email, reason, message, request_key)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (request_key) DO NOTHING RETURNING id)
     SELECT id, true AS inserted FROM ins
     UNION ALL SELECT id, false FROM contact_requests WHERE request_key = $5 AND NOT EXISTS (SELECT 1 FROM ins)`,
    [name, email, REASONS.has(reasonRaw) ? reasonRaw : null, message, requestKey || null],
  );

  if (row?.inserted) {
    const id = row.id;
    after(() => deliverEnquiry(id, { name, email, reason: REASONS.has(reasonRaw) ? reasonRaw : null, message }));
  }
  return NextResponse.json({ ok: true });
});
