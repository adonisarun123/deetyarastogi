// Loads .env.local / .env into process.env for the CLI scripts (Next.js does this for the app).
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

export async function s3() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  if (!process.env.AWS_ENDPOINT_URL_S3) throw new Error("AWS_ENDPOINT_URL_S3 missing — run `neon deploy` first.");
  return new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
  });
}

export const BUCKET = process.env.MEDIA_BUCKET || "media";
