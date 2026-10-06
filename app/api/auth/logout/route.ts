import { NextResponse } from "next/server";
import { assertSameOrigin, destroySession } from "@/lib/auth/session";
import { handle } from "@/lib/ops";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  await destroySession();
  return NextResponse.json({ ok: true });
});
