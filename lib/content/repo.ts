import "server-only";
import type { PoolClient } from "pg";
import { pool, q, q1, tx, type Queryable } from "../db";
import { HttpError, type SessionUser } from "../auth/session";
import { audit, opsEvent } from "../ops";
import { slugify, stripInline } from "../text";
import { referencedAssetIds, sanitizeContent, isUuid } from "./sanitize";
import { validateForPublish, type Problem } from "./validate";
import { type EntryContent, type EntryState, type EntryType, ENTRY_TYPES, emptyContent, entryPath } from "./types";
import { variantsFor } from "../media";

export interface EntryRow {
  id: string;
  type: EntryType;
  slug: string;
  state: EntryState;
  working_revision_id: string;
  published_revision_id: string | null;
  working_version: number;
  has_unpublished_changes: boolean;
  first_published_at: string | null;
  last_published_at: string | null;
  trashed_at: string | null;
  last_publish_request: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function canEdit(user: SessionUser, entry: Pick<EntryRow, "created_by">) {
  return user.role === "owner" || entry.created_by === user.id;
}

async function loadEntry(id: string, db: Queryable, lock = false): Promise<EntryRow> {
  if (!isUuid(id)) throw new HttpError(404, "Entry not found.");
  const row = await q1<EntryRow>(`SELECT * FROM entries WHERE id = $1 ${lock ? "FOR UPDATE" : ""}`, [id], db);
  if (!row) throw new HttpError(404, "Entry not found.");
  return row;
}

async function loadForWrite(user: SessionUser, id: string, db: Queryable) {
  const e = await loadEntry(id, db, true);
  if (!canEdit(user, e)) throw new HttpError(403, "You can only change your own entries.");
  return e;
}

async function workingContent(e: EntryRow, db: Queryable): Promise<EntryContent> {
  const r = await q1<{ content: EntryContent }>(`SELECT content FROM entry_revisions WHERE id = $1`, [e.working_revision_id], db);
  return sanitizeContent(e.type, r?.content ?? emptyContent(e.type));
}

async function uniqueSlug(type: EntryType, desired: string, selfId: string, db: Queryable) {
  const base = slugify(desired) || "untitled";
  let slug = base;
  let n = 2;
  while (await q1(`SELECT 1 FROM entries WHERE type = $1 AND slug = $2 AND id <> $3`, [type, slug, selfId], db)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

async function rebuildUsage(entryId: string, draft: string[], published: string[] | null, db: Queryable) {
  // `published === null` keeps the currently-live media set untouched (draft save).
  const live =
    published ??
    (
      await q<{ asset_id: string }>(
        `SELECT asset_id FROM media_usage WHERE owner_kind = 'entry' AND owner_id = $1 AND in_published`,
        [entryId],
        db,
      )
    ).map((r) => r.asset_id);
  await q(`DELETE FROM media_usage WHERE owner_kind = 'entry' AND owner_id = $1`, [entryId], db);
  const all = Array.from(new Set([...draft, ...live]));
  for (const a of all) {
    await q(
      `INSERT INTO media_usage (asset_id, owner_kind, owner_id, in_draft, in_published)
       SELECT $1, 'entry', $2, $3, $4 WHERE EXISTS (SELECT 1 FROM media_assets WHERE id = $1)`,
      [a, entryId, draft.includes(a), live.includes(a)],
      db,
    );
  }
}

// ───────────────────────── Create / read ─────────────────────────

export async function createEntry(user: SessionUser, type: EntryType): Promise<string> {
  if (!ENTRY_TYPES.includes(type)) throw new HttpError(400, "Unknown entry type.");
  return tx(async (db) => {
    const tmpSlug = `draft-${Math.random().toString(36).slice(2, 10)}`;
    const e = await q1<{ id: string }>(
      `INSERT INTO entries (type, slug, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [type, tmpSlug, user.id],
      db,
    );
    const rev = await q1<{ id: string }>(
      `INSERT INTO entry_revisions (entry_id, kind, content, created_by) VALUES ($1, 'working', $2, $3) RETURNING id`,
      [e!.id, JSON.stringify(emptyContent(type)), user.id],
      db,
    );
    await q(`UPDATE entries SET working_revision_id = $2 WHERE id = $1`, [e!.id, rev!.id], db);
    await audit(user.id, "entry.create", "entry", e!.id, { type }, db);
    return e!.id;
  });
}

export async function getEntryForEdit(user: SessionUser, id: string) {
  const e = await loadEntry(id, pool());
  if (!canEdit(user, e)) throw new HttpError(403, "You can only open your own entries.");
  const content = await workingContent(e, pool());
  return { entry: e, content };
}

// ───────────────────────── Save draft (E02, E03) ─────────────────────────

export async function saveDraft(user: SessionUser, id: string, input: unknown, expectedVersion: number, opts: { snapshot?: boolean } = {}) {
  return tx(async (db) => {
    const e = await loadForWrite(user, id, db);
    if (e.state === "trashed") throw new HttpError(409, "This entry is in the trash. Restore it first.");
    if (e.working_version !== expectedVersion) {
      const server = await workingContent(e, db);
      throw new HttpError(409, "This draft was changed in another window.", {
        conflict: true,
        serverVersion: e.working_version,
        serverContent: server,
        serverUpdatedAt: e.updated_at,
      });
    }
    const content = sanitizeContent(e.type, input);

    // Keep a draft snapshot at most every 30 minutes (E08 recovery).
    const lastSnap = await q1<{ created_at: string }>(
      `SELECT created_at FROM entry_revisions WHERE entry_id = $1 AND kind = 'snapshot' ORDER BY created_at DESC LIMIT 1`,
      [id],
      db,
    );
    if (opts.snapshot || !lastSnap || Date.now() - new Date(lastSnap.created_at).getTime() > 30 * 60 * 1000) {
      await q(
        `INSERT INTO entry_revisions (entry_id, kind, content, created_by, note)
         SELECT entry_id, 'snapshot', content, $2, 'Autosaved draft' FROM entry_revisions WHERE id = $1`,
        [e.working_revision_id, user.id],
        db,
      );
    }

    await q(`UPDATE entry_revisions SET content = $2, created_by = $3, created_at = now() WHERE id = $1`, [
      e.working_revision_id,
      JSON.stringify(content),
      user.id,
    ], db);
    const updated = await q1<{ working_version: number; updated_at: string }>(
      `UPDATE entries SET working_version = working_version + 1, has_unpublished_changes = true, updated_at = now()
        WHERE id = $1 RETURNING working_version, updated_at`,
      [id],
      db,
    );
    await rebuildUsage(id, referencedAssetIds(content), null, db);
    return { version: updated!.working_version, savedAt: updated!.updated_at };
  });
}

// ───────────────────────── Publish (E05, E06, idempotent) ─────────────────────────

async function mediaStates(ids: string[], db: Queryable) {
  const rows = ids.length
    ? await q<{ id: string; state: string }>(
        `SELECT id, state FROM media_assets WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
        [ids],
        db,
      )
    : [];
  const m = new Map(rows.map((r) => [r.id, r.state]));
  return (id: string) => (m.get(id) ?? "missing") as "ready" | "processing" | "uploading" | "failed" | "missing";
}

export async function checkPublish(user: SessionUser, id: string): Promise<{ problems: Problem[]; content: EntryContent; entry: EntryRow }> {
  const e = await loadEntry(id, pool());
  if (!canEdit(user, e)) throw new HttpError(403, "You can only publish your own entries.");
  const content = await workingContent(e, pool());
  const problems = validateForPublish(e.type, content, await mediaStates(referencedAssetIds(content), pool()));
  return { problems, content, entry: e };
}

function searchFields(c: EntryContent, termNames: Map<string, string>) {
  const body: string[] = [];
  for (const b of c.blocks) {
    if ("text" in b && typeof b.text === "string") body.push(stripInline(b.text));
    if (b.type === "list") body.push(...b.items.map(stripInline));
  }
  if (c.learningNote) body.push(c.learningNote);
  if (c.recipe) {
    body.push(...c.recipe.steps.map((s) => stripInline(s.text)));
    body.push(...Object.values(c.recipe.notes));
  }
  if (c.video?.transcript) body.push(c.video.transcript);
  const terms: string[] = [];
  if (c.categoryId && termNames.get(c.categoryId)) terms.push(termNames.get(c.categoryId)!);
  for (const t of c.tagIds) if (termNames.get(t)) terms.push(termNames.get(t)!);
  if (c.recipe) for (const g of c.recipe.groups) for (const i of g.items) if (i.name) terms.push(i.name);
  return {
    title: c.title.toLowerCase(),
    terms: terms.join(" | ").toLowerCase(),
    body: body.join("\n").toLowerCase().slice(0, 200_000),
  };
}

async function writePublicRow(e: EntryRow, revisionId: string, c: EntryContent, firstPublishedAt: string, db: Queryable) {
  const termIds = [c.categoryId, ...c.tagIds].filter(Boolean) as string[];
  const terms = termIds.length
    ? await q<{ id: string; name: string }>(`SELECT id, name FROM terms WHERE id = ANY($1::uuid[])`, [termIds], db)
    : [];
  const names = new Map(terms.map((t) => [t.id, t.name]));
  const s = searchFields(c, names);
  const coverPl = c.cover ?? c.gallery[0] ?? c.video?.cover ?? null;
  let cover = null;
  if (coverPl) {
    const v = (await variantsFor([coverPl.assetId])).get(coverPl.assetId);
    if (v) cover = { ...coverPl, width: v.width, height: v.height, widths: v.widths, jpeg: v.jpeg ?? null };
  }
  await q(
    `INSERT INTO public_entries (entry_id, revision_id, type, slug, title, summary, cover, category_id, tag_ids,
        difficulty, total_minutes, search_title, search_terms, search_body, first_published_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
     ON CONFLICT (entry_id) DO UPDATE SET revision_id = EXCLUDED.revision_id, slug = EXCLUDED.slug, title = EXCLUDED.title,
        summary = EXCLUDED.summary, cover = EXCLUDED.cover, category_id = EXCLUDED.category_id, tag_ids = EXCLUDED.tag_ids,
        difficulty = EXCLUDED.difficulty, total_minutes = EXCLUDED.total_minutes, search_title = EXCLUDED.search_title,
        search_terms = EXCLUDED.search_terms, search_body = EXCLUDED.search_body, updated_at = now()`,
    [
      e.id,
      revisionId,
      e.type,
      e.slug,
      c.title,
      c.summary || c.video?.description?.slice(0, 280) || "",
      cover ? JSON.stringify(cover) : null,
      c.categoryId,
      c.tagIds,
      c.recipe?.difficulty || null,
      c.recipe?.totalMinutes ?? null,
      s.title,
      s.terms,
      s.body,
      firstPublishedAt,
    ],
    db,
  );
}

export async function publishEntry(user: SessionUser, id: string, expectedVersion: number, requestId: string) {
  try {
    return await tx(async (db) => {
      const e = await loadForWrite(user, id, db);
      if (requestId && e.last_publish_request === requestId) {
        return { ok: true as const, path: entryPath(e.type, e.slug), repeated: true };
      }
      if (e.state === "trashed") throw new HttpError(409, "Restore this entry before publishing.");
      if (e.working_version !== expectedVersion) {
        throw new HttpError(409, "This draft changed in another window. Reload before publishing.", { conflict: true });
      }
      const content = await workingContent(e, db);
      const problems = validateForPublish(e.type, content, await mediaStates(referencedAssetIds(content), db));
      if (problems.length) throw new HttpError(422, "Some details need attention before publishing.", { problems });

      // Category must still exist.
      if (content.categoryId && !(await q1(`SELECT 1 FROM terms WHERE id = $1 AND kind = 'category'`, [content.categoryId], db))) {
        throw new HttpError(422, "The chosen category no longer exists.", { problems: [{ field: "categoryId", message: "Choose a category again." }] });
      }

      const oldPath = e.published_revision_id ? entryPath(e.type, e.slug) : null;
      const slug = await uniqueSlug(e.type, content.slug || content.title, e.id, db);
      const rev = await q1<{ id: string; created_at: string }>(
        `INSERT INTO entry_revisions (entry_id, kind, content, created_by, note) VALUES ($1, 'published', $2, $3, 'Published') RETURNING id, created_at`,
        [e.id, JSON.stringify({ ...content, slug }), user.id],
        db,
      );
      const updated = await q1<EntryRow>(
        `UPDATE entries SET slug = $2, state = 'published', published_revision_id = $3,
            first_published_at = COALESCE(first_published_at, now()), last_published_at = now(),
            has_unpublished_changes = false, last_publish_request = $4, updated_at = now()
          WHERE id = $1 RETURNING *`,
        [e.id, slug, rev!.id, requestId || null],
        db,
      );
      // Keep the working copy's slug in sync with what went live.
      await q(`UPDATE entry_revisions SET content = jsonb_set(content, '{slug}', to_jsonb($2::text)) WHERE id = $1`, [e.working_revision_id, slug], db);

      const newPath = entryPath(e.type, slug);
      if (oldPath && oldPath !== newPath) {
        await q(`INSERT INTO redirects (from_path, to_path) VALUES ($1,$2) ON CONFLICT (from_path) DO UPDATE SET to_path = EXCLUDED.to_path`, [oldPath, newPath], db);
        // Collapse chains so an old URL redirects once.
        await q(`UPDATE redirects SET to_path = $2 WHERE to_path = $1`, [oldPath, newPath], db);
      }
      await q(`DELETE FROM redirects WHERE from_path = $1`, [newPath], db);

      await writePublicRow(updated!, rev!.id, content, updated!.first_published_at!, db);
      const ids = referencedAssetIds(content);
      await rebuildUsage(e.id, ids, ids, db);
      await audit(user.id, e.published_revision_id ? "entry.update_published" : "entry.publish", "entry", e.id, { slug }, db);
      return { ok: true as const, path: newPath, repeated: false };
    });
  } catch (err) {
    if (!(err instanceof HttpError)) await opsEvent("publish_failed", id, (err as Error).message);
    throw err;
  }
}

// ───────────────────── Unpublish / trash / restore (E07, E08) ─────────────────────

async function removePublic(e: EntryRow, db: PoolClient) {
  await q(`DELETE FROM public_entries WHERE entry_id = $1`, [e.id], db);
  await q(`UPDATE media_usage SET in_published = false WHERE owner_kind = 'entry' AND owner_id = $1`, [e.id], db);
  await q(`DELETE FROM media_usage WHERE owner_kind = 'entry' AND owner_id = $1 AND NOT in_draft AND NOT in_published`, [e.id], db);
}

export async function unpublishEntry(user: SessionUser, id: string) {
  return tx(async (db) => {
    const e = await loadForWrite(user, id, db);
    if (e.state !== "published") return { ok: true };
    await removePublic(e, db);
    await q(
      `UPDATE entries SET state = 'unpublished', published_revision_id = NULL, has_unpublished_changes = true, updated_at = now() WHERE id = $1`,
      [id],
      db,
    );
    await audit(user.id, "entry.unpublish", "entry", id, {}, db);
    return { ok: true };
  });
}

export async function trashEntry(user: SessionUser, id: string) {
  return tx(async (db) => {
    const e = await loadForWrite(user, id, db);
    if (e.state === "trashed") return { ok: true };
    await removePublic(e, db);
    await q(
      `UPDATE entries SET pre_trash_state = state, state = 'trashed', published_revision_id = NULL, trashed_at = now(), updated_at = now() WHERE id = $1`,
      [id],
      db,
    );
    await audit(user.id, "entry.trash", "entry", id, {}, db);
    return { ok: true };
  });
}

export async function restoreEntry(user: SessionUser, id: string) {
  return tx(async (db) => {
    const e = await loadForWrite(user, id, db);
    if (e.state !== "trashed") return { ok: true };
    await q(`UPDATE entries SET state = 'draft', trashed_at = NULL, has_unpublished_changes = true, updated_at = now() WHERE id = $1`, [id], db);
    await audit(user.id, "entry.restore", "entry", id, {}, db);
    return { ok: true };
  });
}

export async function duplicateEntry(user: SessionUser, id: string) {
  const e = await loadEntry(id, pool());
  if (!canEdit(user, e)) throw new HttpError(403, "You can only duplicate your own entries.");
  const content = await workingContent(e, pool());
  const newId = await createEntry(user, e.type);
  const ne = await loadEntry(newId, pool());
  await saveDraft(user, newId, { ...content, title: `Copy of ${content.title || "untitled"}`, slug: "" }, ne.working_version);
  await audit(user.id, "entry.duplicate", "entry", newId, { from: id });
  return newId;
}

export async function listRevisions(user: SessionUser, id: string) {
  const e = await loadEntry(id, pool());
  if (!canEdit(user, e)) throw new HttpError(403, "Not allowed.");
  return q<{ id: string; kind: string; created_at: string; note: string | null; title: string; is_live: boolean }>(
    `SELECT r.id, r.kind, r.created_at, r.note, r.content->>'title' AS title, (r.id = e.published_revision_id) AS is_live
       FROM entry_revisions r JOIN entries e ON e.id = r.entry_id
      WHERE r.entry_id = $1 AND r.kind IN ('published', 'snapshot')
      ORDER BY r.created_at DESC LIMIT 60`,
    [id],
  );
}

/** Restore an older revision AS A DRAFT (never straight to live). */
export async function restoreRevision(user: SessionUser, id: string, revisionId: string) {
  if (!isUuid(revisionId)) throw new HttpError(404, "Revision not found.");
  return tx(async (db) => {
    const e = await loadForWrite(user, id, db);
    const r = await q1<{ content: unknown }>(`SELECT content FROM entry_revisions WHERE id = $1 AND entry_id = $2`, [revisionId, id], db);
    if (!r) throw new HttpError(404, "Revision not found.");
    await q(
      `INSERT INTO entry_revisions (entry_id, kind, content, created_by, note)
       SELECT entry_id, 'snapshot', content, $2, 'Before restoring an older version' FROM entry_revisions WHERE id = $1`,
      [e.working_revision_id, user.id],
      db,
    );
    const content = sanitizeContent(e.type, r.content);
    await q(`UPDATE entry_revisions SET content = $2, created_at = now() WHERE id = $1`, [e.working_revision_id, JSON.stringify(content)], db);
    await q(
      `UPDATE entries SET working_version = working_version + 1, has_unpublished_changes = true,
          state = CASE WHEN state = 'trashed' THEN 'draft' ELSE state END, updated_at = now() WHERE id = $1`,
      [id],
      db,
    );
    await rebuildUsage(id, referencedAssetIds(content), null, db);
    await audit(user.id, "entry.restore_revision", "entry", id, { revisionId }, db);
    return { ok: true };
  });
}

// ───────────────────────── Dashboard listings ─────────────────────────

export interface DashEntry {
  id: string;
  type: EntryType;
  slug: string;
  state: EntryState;
  title: string;
  has_unpublished_changes: boolean;
  first_published_at: string | null;
  updated_at: string;
  created_by: string | null;
}

export async function listEntries(
  user: SessionUser,
  opts: { type?: string; state?: string; q?: string; limit?: number; offset?: number },
) {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (user.role !== "owner") where.push(`e.created_by = ${p(user.id)}`);
  if (opts.type && ENTRY_TYPES.includes(opts.type as EntryType)) where.push(`e.type = ${p(opts.type)}`);
  if (opts.state === "trashed") where.push(`e.state = 'trashed'`);
  else if (opts.state && ["draft", "published", "unpublished"].includes(opts.state)) where.push(`e.state = ${p(opts.state)}`);
  else where.push(`e.state <> 'trashed'`);
  if (opts.q && opts.q.trim()) where.push(`(r.content->>'title') ILIKE ${p(`%${opts.q.trim().replace(/[%_\\]/g, "\\$&")}%`)}`);
  const sql = `SELECT e.id, e.type, e.slug, e.state, COALESCE(NULLIF(r.content->>'title',''), 'Untitled') AS title,
                      e.has_unpublished_changes, e.first_published_at, e.updated_at, e.created_by, count(*) OVER() AS total
                 FROM entries e JOIN entry_revisions r ON r.id = e.working_revision_id
                ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
                ORDER BY e.updated_at DESC
                LIMIT ${Math.min(opts.limit ?? 30, 100)} OFFSET ${Math.max(0, opts.offset ?? 0)}`;
  const rows = await q<DashEntry & { total: string }>(sql, params);
  return { items: rows as DashEntry[], total: Number(rows[0]?.total ?? 0) };
}

// ───────────────────────── Taxonomy (F01, F06) ─────────────────────────

export interface Term {
  id: string;
  kind: "category" | "tag";
  name: string;
  slug: string;
}

export async function listTerms(kind?: "category" | "tag"): Promise<Term[]> {
  return q<Term>(
    `SELECT id, kind, name, slug FROM terms WHERE merged_into IS NULL ${kind ? "AND kind = $1" : ""} ORDER BY name`,
    kind ? [kind] : [],
  );
}

export async function createTerm(user: SessionUser, kind: "category" | "tag", name: string): Promise<Term> {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!clean) throw new HttpError(400, "Enter a name.");
  const slug = slugify(clean);
  if (!slug) throw new HttpError(400, "Use letters or numbers in the name.");
  const existing = await q1<Term>(`SELECT id, kind, name, slug FROM terms WHERE kind = $1 AND slug = $2`, [kind, slug]);
  if (existing) return existing;
  const t = await q1<Term>(`INSERT INTO terms (kind, name, slug) VALUES ($1,$2,$3) RETURNING id, kind, name, slug`, [kind, clean, slug]);
  await audit(user.id, "term.create", "term", t!.id, { kind, name: clean });
  return t!;
}

export async function renameTerm(user: SessionUser, id: string, name: string) {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  const slug = slugify(clean);
  if (!clean || !slug) throw new HttpError(400, "Enter a name.");
  const t = await q1<Term>(`SELECT id, kind, name, slug FROM terms WHERE id = $1`, [id]);
  if (!t) throw new HttpError(404, "Not found.");
  const clash = await q1(`SELECT 1 FROM terms WHERE kind = $1 AND slug = $2 AND id <> $3`, [t.kind, slug, id]);
  if (clash) throw new HttpError(409, "Another term already uses that name. Merge them instead.");
  await q(`UPDATE terms SET name = $2, slug = $3 WHERE id = $1`, [id, clean, slug]);
  await audit(user.id, "term.rename", "term", id, { from: t.name, to: clean });
}

/** Merge `fromId` into `toId` without losing entry relationships. */
export async function mergeTerms(user: SessionUser, fromId: string, toId: string) {
  if (fromId === toId) return;
  await tx(async (db) => {
    const from = await q1<Term>(`SELECT id, kind, name FROM terms WHERE id = $1`, [fromId], db);
    const to = await q1<Term>(`SELECT id, kind, name FROM terms WHERE id = $1`, [toId], db);
    if (!from || !to || from.kind !== to.kind) throw new HttpError(400, "Choose two terms of the same kind.");
    const key = from.kind === "category" ? "categoryId" : "tagIds";
    const revs = await q<{ id: string; content: EntryContent }>(
      from.kind === "category"
        ? `SELECT id, content FROM entry_revisions WHERE content->>'categoryId' = $1`
        : `SELECT id, content FROM entry_revisions WHERE content->'tagIds' ? $1`,
      [fromId],
      db,
    );
    for (const r of revs) {
      const c = r.content;
      if (key === "categoryId") c.categoryId = toId;
      else c.tagIds = Array.from(new Set(c.tagIds.map((t) => (t === fromId ? toId : t))));
      await q(`UPDATE entry_revisions SET content = $2 WHERE id = $1`, [r.id, JSON.stringify(c)], db);
    }
    if (from.kind === "category") await q(`UPDATE public_entries SET category_id = $2 WHERE category_id = $1`, [fromId, toId], db);
    else
      await q(
        `UPDATE public_entries SET tag_ids = (SELECT array_agg(DISTINCT x) FROM unnest(array_replace(tag_ids, $1::uuid, $2::uuid)) x) WHERE $1::uuid = ANY(tag_ids)`,
        [fromId, toId],
        db,
      );
    await q(`UPDATE terms SET merged_into = $2 WHERE id = $1`, [fromId, toId], db);
    await audit(user.id, "term.merge", "term", fromId, { into: toId, from: from.name, to: to.name }, db);
  });
}

export async function termUsage(id: string) {
  const r = await q1<{ n: string }>(
    `SELECT count(*) AS n FROM entries e JOIN entry_revisions r ON r.id = e.working_revision_id
      WHERE e.state <> 'trashed' AND (r.content->>'categoryId' = $1 OR r.content->'tagIds' ? $1)`,
    [id],
  );
  return Number(r?.n ?? 0);
}

/** Delete a tag (relationships removed) or a category (requires reassignment when used). */
export async function deleteTerm(user: SessionUser, id: string, reassignTo?: string) {
  const t = await q1<Term>(`SELECT id, kind, name FROM terms WHERE id = $1`, [id]);
  if (!t) return;
  if (t.kind === "category") {
    const n = await termUsage(id);
    if (n > 0) {
      if (!reassignTo || !isUuid(reassignTo)) throw new HttpError(409, `This category is used by ${n} entr${n === 1 ? "y" : "ies"}. Choose a category to move them to.`);
      await mergeTerms(user, id, reassignTo);
      return;
    }
  } else {
    await tx(async (db) => {
      const revs = await q<{ id: string; content: EntryContent }>(`SELECT id, content FROM entry_revisions WHERE content->'tagIds' ? $1`, [id], db);
      for (const r of revs) {
        r.content.tagIds = r.content.tagIds.filter((x) => x !== id);
        await q(`UPDATE entry_revisions SET content = $2 WHERE id = $1`, [r.id, JSON.stringify(r.content)], db);
      }
      await q(`UPDATE public_entries SET tag_ids = array_remove(tag_ids, $1::uuid) WHERE $1::uuid = ANY(tag_ids)`, [id], db);
    });
  }
  await q(`DELETE FROM terms WHERE id = $1`, [id]);
  await audit(user.id, "term.delete", "term", id, { name: t.name });
}
