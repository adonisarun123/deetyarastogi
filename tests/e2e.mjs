// End-to-end checks against a running server (staging or local), covering the PRD
// acceptance tests that can be automated: publishing isolation, permissions, media, recipes,
// conflicts, idempotency, unpublish, redirects, contact and search.
//
// Usage: BASE_URL=http://localhost:3000 IMG_DIR=./tests/fixtures node tests/e2e.mjs
// Needs DATABASE_URL (from .env.local) to create test invites. DO NOT run against production.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const IMG = process.env.IMG_DIR || join(root, "tests", "fixtures");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

let pass = 0;
let fail = 0;
const results = [];
function check(name, cond, extra = "") {
  if (cond) pass++;
  else fail++;
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra && !cond ? `  — ${extra}` : ""}`);
}

class Client {
  constructor() {
    this.cookies = new Map();
  }
  async req(path, { method = "GET", body, raw, headers = {}, redirect = "manual" } = {}) {
    const h = { Origin: BASE, ...headers };
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    if (body !== undefined) h["Content-Type"] = "application/json";
    const res = await fetch(path.startsWith("http") ? path : BASE + path, { method, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined), redirect });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const [k, ...v] = kv.split("=");
      const val = v.join("=");
      if (!val || /max-age=0|expires=thu, 01 jan 1970/i.test(c)) this.cookies.delete(k.trim());
      else this.cookies.set(k.trim(), val);
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text, headers: res.headers };
  }
}

async function invite(email, role) {
  const token = randomBytes(24).toString("base64url");
  await db.query(`INSERT INTO invites (token_hash, email, role, expires_at) VALUES ($1,$2,$3, now() + interval '1 hour')`, [createHash("sha256").update(token).digest("hex"), email, role]);
  return token;
}

async function upload(c, file, type) {
  const buf = readFileSync(join(IMG, file));
  const requestId = randomBytes(8).toString("hex");
  const init = await c.req("/api/media", { method: "POST", body: { files: [{ name: file, size: buf.length, type, requestId }] } });
  const r = init.json?.results?.[0];
  if (!r || r.error) return { error: r?.error ?? init.json?.error, status: init.status };
  const put = await c.req(r.uploadUrl, { method: "PUT", raw: buf, headers: { "Content-Type": r.contentType } });
  if (put.status >= 300) return { error: `put ${put.status}` };
  const done = await c.req(`/api/media/${r.assetId}`, { method: "POST", body: {} });
  return { id: r.assetId, status: done.status, json: done.json, requestId };
}

const stamp = Date.now().toString(36);
const owner = new Client();
const author = new Client();
const visitor = new Client();

// ── Accounts ──
const ownerTok = await invite(`owner-${stamp}@example.com`, "owner");
let r = await owner.req("/api/auth/invite-accept", { method: "POST", body: { token: ownerTok, password: "correct horse battery", displayName: "Owner" } });
check("Owner accepts invite and gets a session", r.status === 200 && owner.cookies.has("bakes_session"), r.text);
r = await owner.req("/api/auth/invite-accept", { method: "POST", body: { token: ownerTok, password: "correct horse battery" } });
check("Invite link works only once", r.status === 400);
const authTok = await invite(`baker-${stamp}@example.com`, "author");
r = await author.req("/api/auth/invite-accept", { method: "POST", body: { token: authTok, password: "flour power 12345", displayName: "Baker" } });
check("Author accepts invite", r.status === 200);
r = await visitor.req("/api/auth/login", { method: "POST", body: { email: `baker-${stamp}@example.com`, password: "wrong password here" } });
check("Wrong password is rejected", r.status === 401);
r = await visitor.req("/api/entries", { method: "POST", body: { type: "story" } });
check("Signed-out visitor cannot create entries (AT15)", r.status === 401);
r = await visitor.req("/api/entries", { method: "POST", body: { type: "story" }, headers: { Origin: "https://evil.example" } });
check("Cross-site POST is blocked (CSRF)", r.status === 403 || r.status === 401);

// ── Media (AT02, AT03) ──
const jpg = await upload(author, "cake.jpg", "image/jpeg");
check("JPEG upload processes to ready", jpg.json?.state === "ready", JSON.stringify(jpg));
const png = await upload(author, "tart.png", "image/png");
check("PNG upload processes", png.json?.state === "ready", JSON.stringify(png));
const webp = await upload(author, "bread.webp", "image/webp");
check("WebP upload processes", webp.json?.state === "ready", JSON.stringify(webp));
const heic = existsSync(join(IMG, "phone.heic")) ? await upload(author, "phone.heic", "image/heic") : null;
if (heic) check("HEIC upload is converted server-side", heic.json?.state === "ready", JSON.stringify(heic));
const bad = await upload(author, "notimage.jpg", "image/jpeg");
check("Non-image disguised as .jpg fails with a reason", bad.status === 422 && /JPEG, PNG, WebP or HEIC/.test(bad.json?.error ?? ""), JSON.stringify(bad));
const hugeSize = 21 * 1024 * 1024;
r = await author.req("/api/media", { method: "POST", body: { files: [{ name: "huge.jpg", size: hugeSize, type: "image/jpeg", requestId: "x" + stamp }] } });
check("Oversized file is rejected with a reason", /20 MB/.test(r.json?.results?.[0]?.error ?? ""));
const replay = await author.req(`/api/media/${jpg.id}`, { method: "POST", body: {} });
check("Upload completion replay is idempotent (AT24)", replay.status === 200 && replay.json?.state === "ready");
const { rows: varRows } = await db.query(`SELECT key FROM media_variants WHERE asset_id = $1 ORDER BY width LIMIT 1`, [jpg.id]);
const { rows: dimRows } = await db.query(`SELECT width, height FROM media_assets WHERE id = $1`, [jpg.id]);
check("EXIF orientation applied (1600×1200 rotated → 1200×1600)", dimRows[0]?.width === 1200 && dimRows[0]?.height === 1600, JSON.stringify(dimRows[0]));
const thumb = await author.req(`/api/media/${jpg.id}/thumb`);
const meta = thumb.status === 200 ? await sharp(Buffer.from(await (await fetch(BASE + `/api/media/${jpg.id}/thumb`, { headers: { Cookie: [...author.cookies].map(([k, v]) => `${k}=${v}`).join("; ") } })).arrayBuffer())).metadata() : null;
check("Public derivatives carry no EXIF/GPS metadata", meta && !meta.exif, JSON.stringify(meta?.exif ? "has exif" : meta ? "ok" : "no thumb"));
r = await visitor.req(`/media/${jpg.id}/480.webp`);
check("Draft media is private to signed-out visitors (M07)", r.status === 404);
check("Original storage keys are not exposed", !JSON.stringify(jpg).includes("originals/"));

// ── Taxonomy ──
r = await author.req("/api/terms", { method: "POST", body: { action: "create", kind: "category", name: `Cakes ${stamp}` } });
const cat = r.json?.term;
r = await author.req("/api/terms", { method: "POST", body: { action: "create", kind: "tag", name: `Piping ${stamp}` } });
const tag = r.json?.term;
check("Author creates category and tag", Boolean(cat?.id && tag?.id));

// ── Photo story (AT01) ──
r = await author.req("/api/entries", { method: "POST", body: { type: "story" } });
const storyId = r.json?.id;
let ent = await author.req(`/api/entries/${storyId}`);
let ver = ent.json.entry.working_version;
const storyContent = {
  ...ent.json.content,
  title: `Strawberry celebration cake ${stamp}`,
  summary: "Three layers of sponge with strawberry buttercream.",
  gallery: [
    { assetId: jpg.id, alt: "Finished cake on a pink stand" },
    { assetId: png.id, alt: "Piping the buttercream" },
    { assetId: webp.id, alt: "Slice showing the layers" },
  ],
  cover: { assetId: jpg.id, alt: "Finished cake on a pink stand" },
  categoryId: cat.id,
  tagIds: [tag.id],
  learningNote: "Chill the layers before stacking.",
};
r = await author.req(`/api/entries/${storyId}`, { method: "PUT", body: { content: storyContent, version: ver } });
check("Draft saves and returns a new version (E02)", r.status === 200 && r.json.version === ver + 1, r.text);
const staleVer = ver;
ver = r.json.version;
r = await author.req(`/api/entries/${storyId}`, { method: "PUT", body: { content: { ...storyContent, title: "Other window" }, version: staleVer } });
check("Stale save is a visible conflict, not an overwrite (AT11)", r.status === 409 && r.json?.conflict === true && r.json?.serverContent?.title === storyContent.title);
r = await visitor.req(`/preview/${storyId}`);
check("Unpublished preview is not public (E04)", r.status === 404);
r = await author.req(`/preview/${storyId}`);
check("Author can preview the draft with real components", r.status === 200 && r.text.includes(storyContent.title));
const reqId = "pub-" + stamp;
r = await author.req(`/api/entries/${storyId}`, { method: "POST", body: { action: "publish", version: ver, requestId: reqId } });
check("Photo story publishes", r.status === 200 && r.json?.path?.startsWith("/bakes/"), r.text);
const storyPath = r.json?.path;
r = await author.req(`/api/entries/${storyId}`, { method: "POST", body: { action: "publish", version: ver, requestId: reqId } });
check("Double-submitted publish is idempotent (AT24)", r.status === 200 && r.json?.repeated === true);
const { rows: pubRevs } = await db.query(`SELECT count(*)::int AS n FROM entry_revisions WHERE entry_id = $1 AND kind = 'published'`, [storyId]);
check("…and creates exactly one published revision", pubRevs[0].n === 1, String(pubRevs[0].n));
r = await visitor.req(storyPath);
check("Published story readable without login", r.status === 200 && r.text.includes(storyContent.title) && r.text.includes("What I learnt"));
check("Detail page shows breadcrumbs, author and date (H06)", r.text.includes('aria-label="Breadcrumb"') && r.text.includes("Published"));
r = await visitor.req(`/media/${jpg.id}/480.webp`);
check("Published media becomes public", r.status === 200 && /public/.test(r.headers.get("cache-control") ?? ""));

// ── Editing a live entry keeps live content (AT12, E06) ──
ent = await author.req(`/api/entries/${storyId}`);
ver = ent.json.entry.working_version;
r = await author.req(`/api/entries/${storyId}`, { method: "PUT", body: { content: { ...ent.json.content, title: `Edited title ${stamp}` }, version: ver } });
ver = r.json.version;
r = await visitor.req(storyPath);
check("Working draft edits don't change the live page until Update", r.text.includes(storyContent.title) && !r.text.includes(`Edited title ${stamp}`));

// ── Recipe validation & publish (AT07) ──
r = await author.req("/api/entries", { method: "POST", body: { type: "recipe" } });
const recipeId = r.json.id;
ent = await author.req(`/api/entries/${recipeId}`);
let rver = ent.json.entry.working_version;
const rc = { ...ent.json.content, title: `Lemon drizzle loaf ${stamp}` };
r = await author.req(`/api/entries/${recipeId}`, { method: "PUT", body: { content: rc, version: rver } });
rver = r.json.version;
r = await author.req(`/api/entries/${recipeId}`, { method: "POST", body: { action: "publish", version: rver, requestId: "r1" + stamp } });
const fields = (r.json?.problems ?? []).map((p) => p.field);
check("Incomplete recipe is blocked with exact fields (R01)", r.status === 422 && fields.includes("recipe.difficulty") && fields.includes("cover"), r.text);
ent = await author.req(`/api/entries/${recipeId}`);
check("…and the draft is not lost", ent.json.content.title === rc.title);
const recipe = {
  ...ent.json.content.recipe,
  difficulty: "Beginner",
  yieldAmount: "1",
  yieldUnit: "loaf (900 g tin)",
  prepMinutes: 15,
  cookMinutes: 45,
  coolMinutes: 30,
  totalMinutes: 90,
  equipment: ["Oven (fan)", "900 g loaf tin"],
  groups: [
    { id: "g1", name: "For the loaf", items: [{ id: "i1", name: "self-raising flour", quantity: "225", unit: "g", note: "sifted" }, { id: "i2", name: "salt", quantity: "to taste", unit: "", note: "" }] },
    { id: "g2", name: "For the drizzle", items: [{ id: "i3", name: "lemons", quantity: "1–2", unit: "", note: "juiced" }] },
  ],
  steps: [
    { id: "s1", text: "Heat the oven and line the tin.", temperature: "160", temperatureUnit: "C", appliance: "Oven, fan" },
    { id: "s2", text: "Mix, pour and bake.", durationMinutes: 45 },
  ],
  notes: { ...ent.json.content.recipe.notes, storage: "Keeps 3 days in a tin." },
  video: { youtubeId: "dQw4w9WgXcQ", format: "landscape" },
  readyToShare: true,
};
r = await author.req(`/api/entries/${recipeId}`, {
  method: "PUT",
  body: { content: { ...ent.json.content, summary: "A zingy loaf.", cover: { assetId: webp.id, alt: "Sliced lemon loaf" }, categoryId: cat.id, recipe, relatedIds: [storyId] }, version: ent.json.entry.working_version },
});
rver = r.json.version;
r = await author.req(`/api/entries/${recipeId}`, { method: "POST", body: { action: "publish", version: rver, requestId: "r2" + stamp } });
check("Complete recipe publishes", r.status === 200, r.text);
const recipePath = r.json?.path;
r = await visitor.req(recipePath);
check("Recipe page shows ingredients, method, print and jump actions (R05)", r.text.includes("Ingredients") && r.text.includes("Method") && r.text.includes("Print recipe") && r.text.includes("Jump to recipe"));
check("Quantities kept exactly as typed (R03)", r.text.includes("to taste") && r.text.includes("1–2"));
check("Recipe structured data uses HowToStep from the same fields", r.text.includes('"@type":"Recipe"') && r.text.includes('"HowToStep"') && r.text.includes("self-raising flour"));
check("No YouTube request before interaction (V04)", !/youtube(-nocookie)?\.com\/embed/.test(r.text.replace(/"embedUrl":"[^"]+"/g, "")) && !r.text.includes("i.ytimg.com"));
check("No fabricated ratings or nutrition", !r.text.includes("aggregateRating") && !r.text.includes("nutrition"));
check("Video without known upload date gets no VideoObject", !r.text.includes('"VideoObject"'));
check("Related entry links to the photo story", r.text.includes(storyPath));

// ── Tip and journal without images (AT09) ──
for (const [type, extra] of [
  ["tip", {}],
  ["journal", { summary: "My first week" }],
]) {
  r = await author.req("/api/entries", { method: "POST", body: { type } });
  const id = r.json.id;
  ent = await author.req(`/api/entries/${id}`);
  const c = { ...ent.json.content, ...extra, title: `${type} ${stamp}`, blocks: [{ id: "h", type: "heading", level: 2, text: "Why" }, { id: "p", type: "paragraph", text: "Keep **butter** cold. [Source](https://example.com)" }] };
  r = await author.req(`/api/entries/${id}`, { method: "PUT", body: { content: c, version: ent.json.entry.working_version } });
  r = await author.req(`/api/entries/${id}`, { method: "POST", body: { action: "publish", version: r.json.version, requestId: type + stamp } });
  check(`${type} without photos publishes`, r.status === 200, r.text);
  const page = await visitor.req(r.json.path);
  check(`${type} renders a clean page with safe inline markup`, page.status === 200 && page.text.includes("<strong>butter</strong>") && page.text.includes('rel="noopener noreferrer nofollow"'));
}

// ── Discovery (AT13) ──
r = await visitor.req(`/scrapbook?type=recipe`);
check("Scrapbook type filter", r.text.includes(`Lemon drizzle loaf ${stamp}`) && !r.text.includes(`Strawberry celebration cake ${stamp}`));
r = await visitor.req(`/search?q=${encodeURIComponent("self-raising")}`);
check("Search finds recipes by ingredient", r.text.includes(`Lemon drizzle loaf ${stamp}`));
r = await visitor.req(`/search?q=${encodeURIComponent("Other window")}`);
check("Search never includes draft text", !r.text.includes(`Edited title ${stamp}`) && !r.text.includes("Other window</a>"));
r = await visitor.req(`/scrapbook?category=${cat.slug}&tag=${tag.slug}`);
check("Category AND tag filter combine", r.text.includes(`Strawberry celebration cake ${stamp}`) && !r.text.includes(`Lemon drizzle loaf ${stamp}`));
check("Filtered combinations are noindex", /<meta name="robots" content="noindex/.test(r.text));
r = await visitor.req(`/sitemap.xml`);
check("Sitemap lists published entries", r.text.includes(storyPath) && r.text.includes(recipePath));

// ── Permissions (AT15, AT23) ──
r = await owner.req(`/api/entries/${storyId}`);
check("Owner can open any entry", r.status === 200);
r = await owner.req("/api/entries", { method: "POST", body: { type: "tip" } });
const ownerTipId = r.json.id;
r = await author.req(`/api/entries/${ownerTipId}`);
check("Author cannot open the owner's entry", r.status === 403);
r = await author.req("/api/admin", { method: "POST", body: { action: "invite", email: "x@example.com" } });
check("Author cannot use owner tools", r.status === 403);
r = await author.req("/api/admin/export");
check("Author cannot export", r.status === 403);
r = await visitor.req("/api/admin/export");
check("Visitor cannot export", r.status === 401 || r.status === 403);

// ── Media in use cannot be deleted (AT16) ──
r = await author.req(`/api/media/${jpg.id}`, { method: "DELETE" });
check("Deleting media used by a published entry is blocked", r.status === 409, r.text);

// ── Slug change redirects once (AT17) ──
ent = await author.req(`/api/entries/${storyId}`);
r = await author.req(`/api/entries/${storyId}`, { method: "PUT", body: { content: { ...ent.json.content, slug: `renamed-cake-${stamp}` }, version: ent.json.entry.working_version } });
r = await author.req(`/api/entries/${storyId}`, { method: "POST", body: { action: "publish", version: r.json.version, requestId: "slug" + stamp } });
const newPath = r.json?.path;
r = await visitor.req(storyPath);
check("Old slug redirects to the canonical URL", (r.status === 308 || r.status === 301) && (r.headers.get("location") ?? "").endsWith(newPath), `${r.status} ${r.headers.get("location")}`);

// ── Unpublish removes everywhere (AT14, E07) ──
r = await author.req(`/api/entries/${storyId}`, { method: "POST", body: { action: "unpublish" } });
r = await visitor.req(newPath);
check("Unpublished entry is gone from its page", r.status === 404);
r = await visitor.req(`/sitemap.xml`);
check("…and from the sitemap", !r.text.includes(newPath));
r = await visitor.req(`/search?q=${encodeURIComponent("Strawberry celebration")}`);
check("…and from search", !r.text.includes(`Strawberry celebration cake ${stamp}`));
r = await visitor.req(recipePath);
check("…and from related entries", !r.text.includes(newPath));
r = await visitor.req(`/media/${png.id}/480.webp`);
check("…and its photos stop being public", r.status === 404);

// ── Trash & restore (AT17, E08) ──
r = await author.req(`/api/entries/${storyId}`, { method: "POST", body: { action: "trash" } });
r = await author.req(`/api/entries/${storyId}`, { method: "POST", body: { action: "restore" } });
ent = await author.req(`/api/entries/${storyId}`);
check("Trash then restore returns as a draft", ent.json.entry.state === "draft");

// ── Contact (AT19) ──
const key = "contact-" + stamp;
const msg = { name: "Chef Asha", email: "asha@example.com", reason: "Learning opportunity", message: "Loved the loaf!", requestKey: key, elapsed: 5000 };
const [c1, c2] = await Promise.all([visitor.req("/api/contact", { method: "POST", body: msg }), visitor.req("/api/contact", { method: "POST", body: msg })]);
const { rows: cRows } = await db.query(`SELECT count(*)::int AS n FROM contact_requests WHERE request_key = $1`, [key]);
check("Double-submitted contact stores one enquiry", c1.status === 200 && c2.status === 200 && cRows[0].n === 1, `${c1.status}/${c2.status}/${cRows[0].n}`);
r = await visitor.req("/api/contact", { method: "POST", body: { ...msg, email: "not-an-email", requestKey: key + "b" } });
check("Invalid email gets a useful field error", r.status === 400 && Boolean(r.json?.fields?.email));

// ── Revoke (AT23) ──
const { rows: au } = await db.query(`SELECT id FROM users WHERE email = $1`, [`baker-${stamp}@example.com`]);
await db.query(`UPDATE users SET totp_enabled = true WHERE email = $1`, [`owner-${stamp}@example.com`]); // simulate owner MFA for owner-only tools
await owner.req("/api/auth/logout", { method: "POST", body: {} });
// Re-login owner (MFA flag now on → pending), so use DB to clear pending for the test session.
r = await owner.req("/api/auth/login", { method: "POST", body: { email: `owner-${stamp}@example.com`, password: "correct horse battery" } });
await db.query(`UPDATE sessions SET mfa_pending = false WHERE user_id = (SELECT id FROM users WHERE email = $1)`, [`owner-${stamp}@example.com`]);
r = await owner.req("/api/admin", { method: "POST", body: { action: "revoke", userId: au[0].id } });
check("Owner revokes the author", r.status === 200, r.text);
r = await author.req(`/api/entries/${recipeId}`, { method: "PUT", body: { content: {}, version: 1 } });
check("Revoked author's writes fail", r.status === 401);
const { rows: auditRows } = await db.query(`SELECT count(*)::int AS n FROM audit_events WHERE action = 'user.revoke' AND object_id = $1`, [au[0].id]);
check("Audit log records the revocation", auditRows[0].n === 1);
r = await owner.req("/api/admin/export");
check("Owner export includes entries, revisions and media manifest (AT21)", r.status === 200 && Array.isArray(r.json?.revisions) && Array.isArray(r.json?.media) && r.json.entries.some((e) => e.id === recipeId));

await db.end();
console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
