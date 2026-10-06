import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { putObject, storageDriver, verifyLocalUpload } from "@/lib/storage";
import { MAX_BYTES } from "@/lib/media";

// Development-only stand-in for a presigned object-storage PUT.
export async function PUT(req: Request) {
  if (storageDriver() !== "local") return NextResponse.json({ error: "Not available" }, { status: 404 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const expires = Number(url.searchParams.get("expires") ?? 0);
  const sig = url.searchParams.get("sig") ?? "";
  if (!key.startsWith("originals/") || !verifyLocalUpload(key, expires, sig)) {
    return NextResponse.json({ error: "Upload link expired." }, { status: 403 });
  }
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  await putObject(key, buf, req.headers.get("content-type") ?? "application/octet-stream");
  return new NextResponse(null, { status: 200 });
}
