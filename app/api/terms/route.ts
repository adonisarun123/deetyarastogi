import { NextResponse } from "next/server";
import { apiUser, HttpError } from "@/lib/auth/session";
import { createTerm, deleteTerm, listTerms, mergeTerms, renameTerm, termUsage } from "@/lib/content/repo";
import { handle, noStore, readJson } from "@/lib/ops";
import { isUuid } from "@/lib/content/sanitize";

export const GET = handle(async (req: Request) => {
  await apiUser(req);
  const terms = await listTerms();
  const withUsage = await Promise.all(terms.map(async (t) => ({ ...t, usage: await termUsage(t.id) })));
  return NextResponse.json({ terms: withUsage }, { headers: noStore });
});

export const POST = handle(async (req: Request) => {
  const user = await apiUser(req);
  const b = await readJson(req, 5000);
  const action = String(b.action ?? "create");
  const kind = b.kind === "category" ? "category" : "tag";
  const id = String(b.id ?? "");
  switch (action) {
    case "create":
      return NextResponse.json({ term: await createTerm(user, kind, String(b.name ?? "")) }, { headers: noStore });
    case "rename":
      if (!isUuid(id)) throw new HttpError(400, "Choose a term.");
      await renameTerm(user, id, String(b.name ?? ""));
      return NextResponse.json({ ok: true }, { headers: noStore });
    case "merge":
      if (!isUuid(id) || !isUuid(b.into)) throw new HttpError(400, "Choose two terms to merge.");
      await mergeTerms(user, id, String(b.into));
      return NextResponse.json({ ok: true }, { headers: noStore });
    case "delete":
      if (!isUuid(id)) throw new HttpError(400, "Choose a term.");
      await deleteTerm(user, id, b.reassignTo ? String(b.reassignTo) : undefined);
      return NextResponse.json({ ok: true }, { headers: noStore });
    default:
      throw new HttpError(400, "Unknown action.");
  }
});
