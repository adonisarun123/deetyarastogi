// Focused unit coverage: URL parsing (V01), recipe/publish validation (R01), sanitisation, inline markup safety.
// Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYouTubeUrl } from "../lib/youtube";
import { sanitizeContent, referencedAssetIds } from "../lib/content/sanitize";
import { validateForPublish } from "../lib/content/validate";
import { emptyContent, emptyRecipe } from "../lib/content/types";
import { parseInline, slugify } from "../lib/text";

const A = "11111111-1111-4111-8111-111111111111";
const ready = () => "ready" as const;

test("YouTube: watch, youtu.be and Shorts links resolve to the right ID", () => {
  const w = parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42");
  assert.ok(w.ok && w.id === "dQw4w9WgXcQ" && w.format === "landscape" && w.startSeconds === 42);
  const s = parseYouTubeUrl("youtu.be/dQw4w9WgXcQ");
  assert.ok(s.ok && s.id === "dQw4w9WgXcQ");
  const sh = parseYouTubeUrl("https://youtube.com/shorts/abcdefghijk?feature=share");
  assert.ok(sh.ok && sh.id === "abcdefghijk" && sh.format === "portrait");
  const m = parseYouTubeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.ok(m.ok);
});

test("YouTube: rejects other hosts, iframe code and malformed IDs", () => {
  assert.equal(parseYouTubeUrl("https://vimeo.com/12345").ok, false);
  assert.equal(parseYouTubeUrl('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>').ok, false);
  assert.equal(parseYouTubeUrl("https://www.youtube.com/watch?v=short").ok, false);
  assert.equal(parseYouTubeUrl("https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ").ok, false);
  assert.equal(parseYouTubeUrl("javascript:alert(1)").ok, false);
  assert.equal(parseYouTubeUrl("").ok, false);
});

test("Sanitise: drops unknown blocks, bad IDs and unsafe links; keeps quantities as typed", () => {
  const c = sanitizeContent("recipe", {
    title: "Lemon tart",
    blocks: [{ type: "script", text: "x" }, { type: "paragraph", text: "ok" }, { type: "youtube", video: { youtubeId: "not-valid" } }],
    cover: { assetId: "nope", alt: "x" },
    recipe: { groups: [{ name: "Base", items: [{ name: "salt", quantity: "to taste", unit: "" }, { name: "flour", quantity: "1–2", unit: "cups" }] }] },
    tagIds: [A, A, "bad"],
  });
  assert.equal(c.blocks.length, 2);
  assert.equal(c.blocks[1].type, "youtube");
  assert.equal((c.blocks[1] as { video: unknown }).video, null);
  assert.equal(c.cover, null);
  assert.deepEqual(c.tagIds, [A]);
  assert.equal(c.recipe!.groups[0].items[0].quantity, "to taste");
  assert.equal(c.recipe!.groups[0].items[1].quantity, "1–2");
});

test("Inline markup never produces javascript: links", () => {
  const nodes = parseInline("[click](javascript:alert(1)) and [ok](https://example.com) **bold**");
  const links = nodes.filter((n) => n.t === "a");
  assert.equal(links.length, 1);
  assert.equal((links[0] as { href: string }).href, "https://example.com");
});

test("Recipe validation highlights exact missing fields and never deletes content", () => {
  const c = emptyContent("recipe");
  c.title = "Banana bread";
  const before = JSON.stringify(c);
  const problems = validateForPublish("recipe", c, ready);
  const fields = problems.map((p) => p.field);
  for (const f of ["summary", "cover", "categoryId", "recipe.difficulty", "recipe.yieldAmount", "recipe.totalMinutes", "recipe.steps", "recipe.readyToShare"]) {
    assert.ok(fields.includes(f), `expected problem for ${f}`);
  }
  assert.equal(JSON.stringify(c), before);
});

test("Complete recipe passes; heat step needs a unit", () => {
  const c = emptyContent("recipe");
  Object.assign(c, { title: "Banana bread", summary: "Moist loaf", categoryId: A, cover: { assetId: A, alt: "Sliced loaf" } });
  const r = emptyRecipe();
  Object.assign(r, { difficulty: "Beginner", yieldAmount: "1", yieldUnit: "loaf", prepMinutes: 15, cookMinutes: 55, totalMinutes: 90, readyToShare: true });
  r.groups[0].items[0].name = "ripe bananas";
  r.steps[0].text = "Bake.";
  r.steps[0].temperature = "180";
  c.recipe = r;
  assert.deepEqual(validateForPublish("recipe", c, ready).map((p) => p.field), ["recipe.steps.0.temperatureUnit"]);
  r.steps[0].temperatureUnit = "C";
  assert.equal(validateForPublish("recipe", c, ready).length, 0);
});

test("Photo story needs a ready image; processing media blocks publication", () => {
  const c = emptyContent("story");
  Object.assign(c, { title: "Croissants", summary: "First lamination", gallery: [{ assetId: A, alt: "Croissants" }] });
  assert.equal(validateForPublish("story", c, ready).length, 0);
  assert.ok(validateForPublish("story", c, () => "processing").some((p) => p.field === "gallery"));
  assert.deepEqual(referencedAssetIds(c), [A]);
});

test("Tips and journal entries can publish without photos", () => {
  const tip = emptyContent("tip");
  Object.assign(tip, { title: "Cold butter", blocks: [{ id: "a", type: "paragraph", text: "Keep butter cold for flaky pastry." }] });
  assert.equal(validateForPublish("tip", tip, ready).length, 0);
  const j = emptyContent("journal");
  Object.assign(j, { title: "Week one", summary: "What I learnt", blocks: [{ id: "b", type: "paragraph", text: "Lots." }] });
  assert.equal(validateForPublish("journal", j, ready).length, 0);
});

test("Slugs are URL-safe", () => {
  assert.equal(slugify("Crème Brûlée & Friends!"), "creme-brulee-and-friends");
});
