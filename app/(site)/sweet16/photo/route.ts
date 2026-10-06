import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { birthdayActive } from "@/lib/birthday";

// Serves the invite photo while the invite is active (metadata already stripped).
export async function GET() {
  if (!birthdayActive()) return new Response("Not found", { status: 404 });
  const body = await readFile(join(process.cwd(), "assets", "celebrate", "deetya-16.jpg"));
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex, noimageindex",
    },
  });
}
