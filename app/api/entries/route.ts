import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/session";
import { createEntry, listEntries } from "@/lib/content/repo";
import { handle, noStore, readJson } from "@/lib/ops";
import { ENTRY_TYPES, type EntryType } from "@/lib/content/types";
import { HttpError } from "@/lib/auth/session";

export const POST = handle(async (req: Request) => {
  const user = await apiUser(req);
  const body = await readJson(req, 2000);
  const type = String(body.type ?? "") as EntryType;
  if (!ENTRY_TYPES.includes(type)) throw new HttpError(400, "Choose an entry type.");
  const id = await createEntry(user, type);
  return NextResponse.json({ id }, { headers: noStore });
});

// Lightweight lookup used by the "related entries" and "featured" pickers.
export const GET = handle(async (req: Request) => {
  const user = await apiUser(req);
  const url = new URL(req.url);
  const res = await listEntries(user, {
    q: url.searchParams.get("q") ?? "",
    state: url.searchParams.get("state") ?? "published",
    type: url.searchParams.get("type") ?? undefined,
    limit: 20,
  });
  return NextResponse.json(res, { headers: noStore });
});
