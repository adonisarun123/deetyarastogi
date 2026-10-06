// Applies SQL migrations in db/migrations in filename order. Idempotent.
// Usage: node scripts/migrate.mjs   (reads DATABASE_URL from env, .env.local or .env)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
const dir = join(root, "db", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
let applied = 0;
for (const file of files) {
  if (done.has(file)) continue;
  const sql = readFileSync(join(dir, file), "utf8");
  process.stdout.write(`Applying ${file}… `);
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    await client.query("COMMIT");
    applied++;
    console.log("done");
  } catch (err) {
    await client.query("ROLLBACK");
    console.log("FAILED");
    console.error(err.message);
    process.exit(1);
  }
}
console.log(applied ? `${applied} migration(s) applied.` : "Database is up to date.");
await client.end();
