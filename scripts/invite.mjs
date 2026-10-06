// Create a one-time sign-up link (no password ever passes through this script).
// Usage: node scripts/invite.mjs <email> [owner|author] [--reset]
// Prints a link valid for 72 hours. Open it to choose a password.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
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

const [email, roleArg = "owner", ...flags] = process.argv.slice(2);
if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/invite.mjs <email> [owner|author] [--reset]");
  process.exit(1);
}
const role = roleArg === "author" ? "author" : "owner";
const purpose = flags.includes("--reset") ? "reset" : "invite";
const token = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(token).digest("hex");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
await client.connect();
await client.query(
  `INSERT INTO invites (token_hash, email, role, purpose, expires_at) VALUES ($1, $2, $3, $4, now() + interval '72 hours')`,
  [hash, email.toLowerCase(), role, purpose],
);
await client.end();
const base = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
console.log(`${purpose === "reset" ? "Password reset" : `Invite (${role})`} link for ${email}, valid 72 hours:\n${base}/invite/${token}`);
