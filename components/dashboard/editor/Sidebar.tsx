"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { EntryContent } from "@/lib/content/types";
import { MAX_RELATED, MAX_TAGS, TYPE_LABEL } from "@/lib/content/types";
import { formatDateTime, slugify } from "@/lib/text";

export interface TermLite {
  id: string;
  kind: "category" | "tag";
  name: string;
  slug: string;
}

export function TaxonomyFields({
  content: c,
  set,
  terms,
  setTerms,
  bad,
}: {
  content: EntryContent;
  set: (p: Partial<EntryContent>) => void;
  terms: TermLite[];
  setTerms: (t: TermLite[]) => void;
  bad: (f: string) => boolean;
}) {
  const [newCat, setNewCat] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [err, setErr] = useState("");
  const cats = terms.filter((t) => t.kind === "category");
  const tags = terms.filter((t) => t.kind === "tag");
  const chosenTags = c.tagIds.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as TermLite[];
  const suggestions = tagInput.trim()
    ? tags.filter((t) => !c.tagIds.includes(t.id) && t.name.toLowerCase().includes(tagInput.trim().toLowerCase())).slice(0, 6)
    : [];

  const create = async (kind: "category" | "tag", name: string) => {
    setErr("");
    try {
      const r = await api<{ term: TermLite }>("/api/terms", { body: { action: "create", kind, name } });
      if (!terms.some((t) => t.id === r.term.id)) setTerms([...terms, r.term]);
      return r.term;
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn’t add that.");
      return null;
    }
  };

  const addTag = async (name: string) => {
    if (c.tagIds.length >= MAX_TAGS) return setErr(`Up to ${MAX_TAGS} tags.`);
    const existing = tags.find((t) => t.slug === slugify(name));
    const t = existing ?? (await create("tag", name));
    if (t && !c.tagIds.includes(t.id)) set({ tagIds: [...c.tagIds, t.id] });
    setTagInput("");
  };

  return (
    <div className="form-grid" style={{ gap: 14 }}>
      <div className="field">
        <label htmlFor="categoryId">Category</label>
        <select id="categoryId" value={c.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value || null })} aria-invalid={bad("categoryId") || undefined}>
          <option value="">Choose…</option>
          {cats.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
          <label htmlFor="new-cat" className="sr-only">
            New category name
          </label>
          <input id="new-cat" value={newCat} placeholder="New category (e.g. Breads)" onChange={(e) => setNewCat(e.target.value)} />
          <button
            type="button"
            className="tool-btn"
            disabled={!newCat.trim()}
            onClick={async () => {
              const t = await create("category", newCat);
              if (t) {
                set({ categoryId: t.id });
                setNewCat("");
              }
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="tag-input">
          Tags ({c.tagIds.length}/{MAX_TAGS})
        </label>
        <div className="chip-input">
          {chosenTags.map((t) => (
            <span key={t.id} className="tag">
              {t.name}
              <button type="button" aria-label={`Remove tag ${t.name}`} onClick={() => set({ tagIds: c.tagIds.filter((x) => x !== t.id) })}>
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          id="tag-input"
          value={tagInput}
          placeholder="Technique or theme, then Enter"
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && tagInput.trim()) {
              e.preventDefault();
              addTag(tagInput.trim());
            }
          }}
          aria-describedby="tag-hint"
        />
        <span id="tag-hint" className="hint">
          Pick an existing tag where possible to avoid spelling variants.
        </span>
        {suggestions.length ? (
          <div className="row" style={{ gap: 6 }}>
            {suggestions.map((t) => (
              <button key={t.id} type="button" className="tool-btn" onClick={() => addTag(t.name)}>
                + {t.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {err ? (
        <p className="error-text" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}

interface EntryLite {
  id: string;
  type: keyof typeof TYPE_LABEL;
  title: string;
}

export function RelatedPicker({ selfId, ids, onChange }: { selfId: string; ids: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<EntryLite[]>([]);
  const [known, setKnown] = useState<Record<string, EntryLite>>({});

  useEffect(() => {
    if (!ids.length) return;
    api<{ items: EntryLite[] }>(`/api/entries?state=published`)
      .then((r) => setKnown((k) => ({ ...k, ...Object.fromEntries(r.items.map((i) => [i.id, i])) })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await api<{ items: EntryLite[] }>(`/api/entries?state=published&q=${encodeURIComponent(q)}`);
        setResults(r.items.filter((i) => i.id !== selfId));
        setKnown((k) => ({ ...k, ...Object.fromEntries(r.items.map((i) => [i.id, i])) }));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [q, selfId]);

  return (
    <div className="field">
      <label htmlFor="rel-q">
        Related entries ({ids.length}/{MAX_RELATED})
      </label>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        {ids.map((id) => (
          <li key={id} style={{ marginBottom: 4 }}>
            {known[id]?.title ?? "Published entry"}{" "}
            <button type="button" className="tool-btn" onClick={() => onChange(ids.filter((x) => x !== id))} aria-label={`Remove related ${known[id]?.title ?? "entry"}`}>
              ✕
            </button>
          </li>
        ))}
      </ol>
      {ids.length < MAX_RELATED ? (
        <>
          <input id="rel-q" type="search" value={q} placeholder="Search published entries" onChange={(e) => setQ(e.target.value)} />
          <div style={{ display: "grid", gap: 4 }}>
            {results
              .filter((r) => !ids.includes(r.id))
              .slice(0, 5)
              .map((r) => (
                <button key={r.id} type="button" className="tool-btn" style={{ textAlign: "left" }} onClick={() => onChange([...ids, r.id])}>
                  + {r.title} <span className="muted">· {TYPE_LABEL[r.type]}</span>
                </button>
              ))}
          </div>
        </>
      ) : null}
      <span className="hint">If you pick fewer than 3, the site fills in others from the same category.</span>
    </div>
  );
}

interface Rev {
  id: string;
  kind: string;
  created_at: string;
  note: string | null;
  title: string;
  is_live: boolean;
}

export function Revisions({ entryId, onRestored }: { entryId: string; onRestored: () => void }) {
  const [revs, setRevs] = useState<Rev[] | null>(null);
  const [err, setErr] = useState("");
  const load = async () => {
    try {
      const r = await api<{ revisions: Rev[] }>(`/api/entries/${entryId}?view=revisions`);
      setRevs(r.revisions);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn’t load history.");
    }
  };
  return (
    <details onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && !revs && load()}>
      <summary>Version history</summary>
      {err ? <p className="error-text">{err}</p> : null}
      {revs ? (
        revs.length ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {revs.map((r) => (
              <li key={r.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>
                  {r.kind === "published" ? "Published version" : r.note ?? "Draft snapshot"} {r.is_live ? <span className="state state-published">Live</span> : null}
                </div>
                <div className="muted" style={{ fontSize: "0.875rem" }}>
                  {formatDateTime(r.created_at)} · “{r.title || "Untitled"}”
                </div>
                <button
                  type="button"
                  className="tool-btn"
                  style={{ marginTop: 6 }}
                  onClick={async () => {
                    if (!window.confirm("Restore this version as your working draft? Your current draft is kept in history. The live page doesn’t change until you publish.")) return;
                    try {
                      await api(`/api/entries/${entryId}`, { body: { action: "restore-revision", revisionId: r.id } });
                      onRestored();
                    } catch (e) {
                      setErr(e instanceof ApiError ? e.message : "Couldn’t restore.");
                    }
                  }}
                >
                  Restore as draft
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No earlier versions yet. Snapshots are kept for 30 days.</p>
        )
      ) : (
        <p className="muted">Loading…</p>
      )}
    </details>
  );
}
