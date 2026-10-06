// Downloads every stored photo (private originals + web derivatives) to a local folder.
// Pair with the JSON export from Owner settings for an editor-friendly, portable backup.
// Usage: node scripts/backup-media.mjs ./backup/media
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import pg from "pg";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET } from "./_env.mjs";

const out = process.argv[2] || "./backup/media";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
await db.connect();
const keys = (
  await db.query(`SELECT original_key AS key FROM media_assets WHERE deleted_at IS NULL UNION SELECT key FROM media_variants`)
).rows.map((r) => r.key);
await db.end();
const client = await s3();
let n = 0;
for (const key of keys) {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const p = join(out, key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, Buffer.from(await res.Body.transformToByteArray()));
    n++;
  } catch (e) {
    console.warn(`skip ${key}: ${e.name}`);
  }
}
console.log(`Saved ${n}/${keys.length} files to ${out}`);
