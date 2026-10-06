import "server-only";
import { q, q1 } from "../db";
import type { EntryContent, EntryType, MediaPlacement } from "./types";
import { ENTRY_TYPES, PAGE_SIZE, entryPath } from "./types";
import { sanitizeContent, referencedAssetIds, isUuid } from "./sanitize";
import { variantsFor } from "../media";

// Public reads ONLY touch public_entries and the published revision it points to.

export interface CoverInfo extends MediaPlacement {
  width: number;
  height: number;
  widths: number[];
  jpeg?: number | null;
}

export interface Card {
  id: string;
  type: EntryType;
  slug: string;
  title: string;
  summary: string;
  cover: CoverInfo | null;
  difficulty: string | null;
  totalMinutes: number | null;
  firstPublishedAt: string;
  updatedAt: string;
  categoryName: string | null;
  categorySlug: string | null;
  path: string;
}

const CARD_COLS = `p.entry_id AS id, p.type, p.slug, p.title, p.summary, p.cover, p.difficulty, p.total_minutes,
  p.first_published_at, p.updated_at, c.name AS category_name, c.slug AS category_slug`;

type CardRow = {
  id: string;
  type: EntryType;
  slug: string;
  title: string;
  summary: string;
  cover: CoverInfo | null;
  difficulty: string | null;
  total_minutes: number | null;
  first_published_at: string;
  updated_at: string;
  category_name: string | null;
  category_slug: string | null;
};

const toCard = (r: CardRow): Card => ({
  id: r.id,
  type: r.type,
  slug: r.slug,
  title: r.title,
  summary: r.summary,
  cover: r.cover,
  difficulty: r.difficulty,
  totalMinutes: r.total_minutes,
  firstPublishedAt: r.first_published_at,
  updatedAt: r.updated_at,
  categoryName: r.category_name,
  categorySlug: r.category_slug,
  path: entryPath(r.type, r.slug),
});

export interface FeedFilters {
  type?: EntryType | null;
  category?: string | null; // slug
  tags?: string[]; // slugs (OR within facet)
  difficulty?: string | null;
  q?: string | null;
  page?: number;
}

export function parseFilters(sp: Record<string, string | string[] | undefined>, fixedType?: EntryType): FeedFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? null;
  };
  const many = (k: string) => {
    const v = sp[k];
    const xs = (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split(","));
    return xs.map((x) => x.trim().toLowerCase()).filter((x) => /^[a-z0-9-]{1,80}$/.test(x)).slice(0, 8);
  };
  const t = one("type");
  const page = Math.max(1, Math.min(1000, Number.parseInt(one("page") ?? "1", 10) || 1));
  const cat = one("category");
  const diff = one("difficulty");
  const query = (one("q") ?? "").trim().slice(0, 100);
  return {
    type: fixedType ?? (ENTRY_TYPES.includes(t as EntryType) ? (t as EntryType) : null),
    category: cat && /^[a-z0-9-]{1,80}$/.test(cat) ? cat : null,
    tags: many("tag"),
    difficulty: fixedType === "recipe" && ["Beginner", "Intermediate", "Advanced"].includes(diff ?? "") ? diff : null,
    q: query.length >= 2 ? query : null,
    page,
  };
}

export async function listPublic(f: FeedFilters, pageSize = PAGE_SIZE) {
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  const where: string[] = [];
  if (f.type) where.push(`p.type = ${p(f.type)}`);
  if (f.category) where.push(`c.slug = ${p(f.category)}`);
  if (f.tags?.length)
    where.push(`p.tag_ids && (SELECT coalesce(array_agg(id), '{}') FROM terms WHERE kind = 'tag' AND slug = ANY(${p(f.tags)}::text[]) AND merged_into IS NULL)`);
  if (f.difficulty) where.push(`p.difficulty = ${p(f.difficulty)}`);

  let order = `p.first_published_at DESC, p.entry_id DESC`;
  let rankSelect = "";
  if (f.q) {
    // F03: case-insensitive; title > ingredient/tag > body; tie-break by publication date.
    const needle = `%${f.q.toLowerCase().replace(/[%_\\]/g, "\\$&")}%`;
    const n = p(needle);
    where.push(`(p.search_title LIKE ${n} OR p.search_terms LIKE ${n} OR p.search_body LIKE ${n} OR lower(p.summary) LIKE ${n})`);
    rankSelect = `, (CASE WHEN p.search_title LIKE ${n} THEN 3 WHEN p.search_terms LIKE ${n} THEN 2 ELSE 1 END) AS rank`;
    order = `rank DESC, ${order}`;
  }
  const page = f.page ?? 1;
  const sql = `SELECT ${CARD_COLS} ${rankSelect}, count(*) OVER() AS total
                 FROM public_entries p LEFT JOIN terms c ON c.id = p.category_id
                ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
                ORDER BY ${order}
                LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
  const rows = await q<CardRow & { total: string }>(sql, params);
  const total = Number(rows[0]?.total ?? 0);
  return { items: rows.map(toCard), total, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function latest(limit = 6, excludeIds: string[] = []) {
  const rows = await q<CardRow>(
    `SELECT ${CARD_COLS} FROM public_entries p LEFT JOIN terms c ON c.id = p.category_id
      WHERE NOT (p.entry_id = ANY($1::uuid[]))
      ORDER BY p.first_published_at DESC, p.entry_id DESC LIMIT $2`,
    [excludeIds, limit],
  );
  return rows.map(toCard);
}

/** H01: featured entries in chosen order; unpublished ones simply drop out. */
export async function cardsByIds(ids: string[]) {
  const valid = ids.filter(isUuid);
  if (!valid.length) return [];
  const rows = await q<CardRow>(
    `SELECT ${CARD_COLS} FROM public_entries p LEFT JOIN terms c ON c.id = p.category_id WHERE p.entry_id = ANY($1::uuid[])`,
    [valid],
  );
  const m = new Map(rows.map((r) => [r.id, toCard(r)]));
  return valid.map((id) => m.get(id)).filter(Boolean) as Card[];
}

export async function typeCounts(): Promise<Record<EntryType, number>> {
  const rows = await q<{ type: EntryType; n: string }>(`SELECT type, count(*) AS n FROM public_entries GROUP BY type`).catch(() => []);
  const out = { story: 0, recipe: 0, video: 0, tip: 0, journal: 0 } as Record<EntryType, number>;
  for (const r of rows) out[r.type] = Number(r.n);
  return out;
}

export async function publicTerms(kind: "category" | "tag", type?: EntryType) {
  const col = kind === "category" ? "p.category_id = t.id" : "t.id = ANY(p.tag_ids)";
  return q<{ id: string; name: string; slug: string; n: string }>(
    `SELECT t.id, t.name, t.slug, count(p.entry_id) AS n FROM terms t JOIN public_entries p ON ${col}
      WHERE t.kind = $1 AND t.merged_into IS NULL ${type ? "AND p.type = $2" : ""}
      GROUP BY t.id ORDER BY t.name`,
    type ? [kind, type] : [kind],
  );
}

export interface PublicEntry {
  card: Card;
  content: EntryContent;
  media: Map<string, { width: number; height: number; widths: number[]; jpeg?: number }>;
  tags: { id: string; name: string; slug: string }[];
  related: Card[];
}

export async function getPublicEntry(type: EntryType, slug: string): Promise<PublicEntry | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const row = await q1<CardRow & { revision_id: string; tag_ids: string[]; category_id: string | null }>(
    `SELECT ${CARD_COLS}, p.revision_id, p.tag_ids, p.category_id
       FROM public_entries p LEFT JOIN terms c ON c.id = p.category_id
      WHERE p.type = $1 AND p.slug = $2`,
    [type, slug],
  );
  if (!row) return null;
  const rev = await q1<{ content: unknown }>(`SELECT content FROM entry_revisions WHERE id = $1`, [row.revision_id]);
  if (!rev) return null;
  const content = sanitizeContent(type, rev.content);
  const media = await variantsFor(referencedAssetIds(content));
  const tags = row.tag_ids.length
    ? await q<{ id: string; name: string; slug: string }>(
        `SELECT id, name, slug FROM terms WHERE id = ANY($1::uuid[]) AND merged_into IS NULL ORDER BY name`,
        [row.tag_ids],
      )
    : [];
  const related = await relatedFor(row.id, content.relatedIds, row.category_id);
  return { card: toCard(row), content, media, tags, related };
}

async function relatedFor(id: string, chosen: string[], categoryId: string | null) {
  const picked = (await cardsByIds(chosen)).filter((c) => c.id !== id).slice(0, 3);
  if (picked.length >= 3 || !categoryId) return picked;
  const exclude = [id, ...picked.map((c) => c.id)];
  const fill = await q<CardRow>(
    `SELECT ${CARD_COLS} FROM public_entries p LEFT JOIN terms c ON c.id = p.category_id
      WHERE p.category_id = $1 AND NOT (p.entry_id = ANY($2::uuid[]))
      ORDER BY p.first_published_at DESC LIMIT $3`,
    [categoryId, exclude, 3 - picked.length],
  );
  return [...picked, ...fill.map(toCard)];
}

export async function findRedirect(path: string) {
  const r = await q1<{ to_path: string }>(`SELECT to_path FROM redirects WHERE from_path = $1`, [path]).catch(() => null);
  return r?.to_path ?? null;
}

export async function sitemapEntries() {
  return q<{ type: EntryType; slug: string; updated_at: string }>(
    `SELECT type, slug, updated_at FROM public_entries ORDER BY first_published_at DESC LIMIT 10000`,
  ).catch(() => []);
}
