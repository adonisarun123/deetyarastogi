// Restores a content export into a SEPARATE, freshly migrated database (e.g. a new Neon branch).
// Usage: node scripts/restore.mjs export.json [--media-dir ./backup/media]
// Accounts are not restored — create them again with scripts/invite.mjs.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET } from "./_env.mjs";

const file = process.argv[2];
const mediaDirIdx = process.argv.indexOf("--media-dir");
const mediaDir = mediaDirIdx > 0 ? process.argv[mediaDirIdx + 1] : null;
if (!file) {
  console.error("Usage: node scripts/restore.mjs export.json [--media-dir ./backup/media]");
  process.exit(1);
}
const data = JSON.parse(await readFile(file, "utf8"));
if (data.format !== "baking-scrapbook-export") throw new Error("Not a scrapbook export file.");

const db = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
await db.connect();
const existing = (await db.query(`SELECT count(*)::int AS n FROM entries`)).rows[0].n;
if (existing > 0) {
  console.error("Target database already has entries. Restore into an empty, migrated database.");
  process.exit(1);
}

const insert = async (table, rows, cols) => {
  for (const r of rows) {
    const vals = cols.map((c) => (r[c] !== null && typeof r[c] === "object" && !Array.isArray(r[c]) ? JSON.stringify(r[c]) : Array.isArray(r[c]) && c !== "tag_ids" ? JSON.stringify(r[c]) : r[c]));
    await db.query(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}) ON CONFLICT DO NOTHING`, vals);
  }
};

await db.query("BEGIN");
try {
  await db.query(`UPDATE site_settings SET data = $1 WHERE id = 1`, [JSON.stringify(data.settings ?? {})]);
  await db.query(`UPDATE author_profile SET data = $1 WHERE id = 1`, [JSON.stringify(data.profile ?? {})]);
  await insert("terms", data.terms.map((t) => ({ ...t, merged_into: null })), ["id", "kind", "name", "slug", "merged_into", "created_at"]);
  for (const t of data.terms.filter((t) => t.merged_into)) await db.query(`UPDATE terms SET merged_into = $2 WHERE id = $1`, [t.id, t.merged_into]);
  await insert("media_assets", data.media, ["id", "original_key", "mime", "bytes", "width", "height", "state", "default_alt", "default_caption", "credit", "focal_x", "focal_y", "created_at"]);
  await insert("media_variants", data.variants, ["asset_id", "width", "height", "format", "key", "bytes"]);
  await insert(
    "entries",
    data.entries.map((e) => ({ ...e, working_revision_id: null, published_revision_id: null })),
    ["id", "type", "slug", "state", "first_published_at", "last_published_at", "trashed_at", "created_at", "updated_at"],
  );
  await insert("entry_revisions", data.revisions, ["id", "entry_id", "kind", "content", "created_at", "note"]);
  for (const e of data.entries)
    await db.query(`UPDATE entries SET working_revision_id = $2, published_revision_id = $3 WHERE id = $1`, [e.id, e.working_revision_id, e.published_revision_id]);
  await insert("media_usage", data.mediaUsage, ["asset_id", "owner_kind", "owner_id", "in_draft", "in_published"]);
  await insert("experiences", data.experiences, ["id", "kind", "title", "organisation", "role", "period", "description", "details", "is_public", "display_order"]);
  await insert("redirects", data.redirects, ["from_path", "to_path", "created_at"]);
  await insert("public_entries", data.publicIndex ?? [], ["entry_id", "revision_id", "type", "slug", "title", "summary", "cover", "category_id", "tag_ids", "difficulty", "total_minutes", "search_title", "search_terms", "search_body", "first_published_at", "updated_at"]);
  await db.query("COMMIT");
} catch (e) {
  await db.query("ROLLBACK");
  throw e;
}
console.log(`Restored ${data.entries.length} entries, ${data.revisions.length} revisions, ${data.media.length} photos.`);

if (mediaDir) {
  const client = await s3();
  let n = 0;
  const keys = [...data.media.map((m) => m.original_key), ...data.variants.map((v) => v.key)];
  for (const key of keys) {
    try {
      const body = await readFile(join(mediaDir, key));
      await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body }));
      n++;
    } catch {
      console.warn(`missing ${key}`);
    }
  }
  console.log(`Uploaded ${n}/${keys.length} media files.`);
}
await db.end();
