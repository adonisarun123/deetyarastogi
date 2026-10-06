import Link from "next/link";
import { CardGrid } from "./Card";
import type { Card, FeedFilters } from "@/lib/content/public";
import { ENTRY_TYPES, TYPE_PLURAL, type EntryType } from "@/lib/content/types";

interface TermOpt {
  name: string;
  slug: string;
  n: string | number;
}

export function buildHref(base: string, f: FeedFilters, patch: Partial<FeedFilters>, fixedType?: EntryType) {
  const next = { ...f, ...patch };
  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.type && !fixedType) sp.set("type", next.type);
  if (next.category) sp.set("category", next.category);
  for (const t of next.tags ?? []) sp.append("tag", t);
  if (next.difficulty) sp.set("difficulty", next.difficulty);
  if (next.page && next.page > 1) sp.set("page", String(next.page));
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

export function hasFilters(f: FeedFilters, fixedType?: EntryType) {
  return Boolean(f.q || (!fixedType && f.type) || f.category || f.tags?.length || f.difficulty);
}

export function Feed({
  base,
  filters: f,
  fixedType,
  showTypes,
  categories,
  tags,
  showDifficulty,
  result,
  searchLabel = "Search",
  emptyTitle = "Nothing here yet",
  emptyText,
}: {
  base: string;
  filters: FeedFilters;
  fixedType?: EntryType;
  showTypes?: boolean;
  categories: TermOpt[];
  tags: TermOpt[];
  showDifficulty?: boolean;
  result: { items: Card[]; total: number; page: number; pages: number };
  searchLabel?: string;
  emptyTitle?: string;
  emptyText?: string;
}) {
  const filtered = hasFilters(f, fixedType);
  const clear = buildHref(base, {}, {}, fixedType);
  const toggleTag = (slug: string) => {
    const has = f.tags?.includes(slug);
    return buildHref(base, f, { tags: has ? f.tags!.filter((t) => t !== slug) : [...(f.tags ?? []), slug], page: 1 }, fixedType);
  };

  return (
    <div>
      <div className="filter-bar">
        <form action={base} method="get" role="search" className="filter-row">
          <div className="field" style={{ flex: "1 1 260px" }}>
            <label htmlFor="feed-q">{searchLabel}</label>
            <input id="feed-q" type="search" name="q" defaultValue={f.q ?? ""} minLength={2} maxLength={100} placeholder="Try ‘sourdough’ or ‘butter’" />
          </div>
          {f.type && !fixedType ? <input type="hidden" name="type" value={f.type} /> : null}
          {f.category ? <input type="hidden" name="category" value={f.category} /> : null}
          {(f.tags ?? []).map((t) => (
            <input key={t} type="hidden" name="tag" value={t} />
          ))}
          {f.difficulty ? <input type="hidden" name="difficulty" value={f.difficulty} /> : null}
          <button type="submit" className="btn">
            Search
          </button>
        </form>

        {showTypes ? (
          <nav aria-label="Filter by type">
            <div className="filters">
              <Link className="chip" href={buildHref(base, f, { type: null, page: 1 })} aria-current={!f.type ? "true" : undefined}>
                All
              </Link>
              {ENTRY_TYPES.map((t) => (
                <Link key={t} className="chip" href={buildHref(base, f, { type: t, page: 1 })} aria-current={f.type === t ? "true" : undefined}>
                  {TYPE_PLURAL[t]}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}

        {categories.length ? (
          <nav aria-label="Filter by category">
            <div className="filters">
              <span className="muted" style={{ alignSelf: "center", marginRight: 4, fontSize: "0.95rem" }}>
                Category:
              </span>
              <Link className="chip" href={buildHref(base, f, { category: null, page: 1 }, fixedType)} aria-current={!f.category ? "true" : undefined}>
                Any
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  className="chip"
                  href={buildHref(base, f, { category: f.category === c.slug ? null : c.slug, page: 1 }, fixedType)}
                  aria-current={f.category === c.slug ? "true" : undefined}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}

        {showDifficulty ? (
          <nav aria-label="Filter by difficulty">
            <div className="filters">
              <span className="muted" style={{ alignSelf: "center", marginRight: 4, fontSize: "0.95rem" }}>
                Level:
              </span>
              {["Beginner", "Intermediate", "Advanced"].map((d) => (
                <Link
                  key={d}
                  className="chip"
                  href={buildHref(base, f, { difficulty: f.difficulty === d ? null : d, page: 1 }, fixedType)}
                  aria-current={f.difficulty === d ? "true" : undefined}
                >
                  {d}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}

        {tags.length ? (
          <details open={Boolean(f.tags?.length)}>
            <summary style={{ cursor: "pointer", minHeight: 44, display: "inline-flex", alignItems: "center", fontWeight: 600 }}>
              Techniques &amp; themes{f.tags?.length ? ` (${f.tags.length} selected)` : ""}
            </summary>
            <div className="filters" style={{ marginTop: 10 }}>
              {tags.map((t) => (
                <Link key={t.slug} className="chip" href={toggleTag(t.slug)} aria-current={f.tags?.includes(t.slug) ? "true" : undefined}>
                  #{t.name}
                </Link>
              ))}
            </div>
          </details>
        ) : null}

        <div className="result-line" role="status" aria-live="polite">
          <span>
            <strong style={{ color: "var(--cocoa)" }}>{result.total}</strong> {result.total === 1 ? "entry" : "entries"}
            {f.q ? (
              <>
                {" "}
                for “<strong style={{ color: "var(--cocoa)" }}>{f.q}</strong>”
              </>
            ) : null}
            {result.pages > 1 ? ` · page ${result.page} of ${result.pages}` : ""}
          </span>
          {filtered ? (
            <Link href={clear} className="btn btn-quiet btn-small">
              Clear all
            </Link>
          ) : null}
        </div>
      </div>

      {result.items.length ? (
        <CardGrid cards={result.items} priorityCount={3} />
      ) : (
        <div className="empty-state">
          <h2 style={{ fontSize: "1.75rem" }}>{filtered ? "No matches" : emptyTitle}</h2>
          <p className="muted" style={{ maxWidth: "46ch", margin: "0 auto 20px" }}>
            {filtered ? "Nothing matches those filters. Try fewer filters or a different word." : (emptyText ?? "New entries will appear here as soon as they’re published.")}
          </p>
          {filtered ? (
            <Link href={clear} className="btn">
              Clear filters
            </Link>
          ) : (
            <Link href="/" className="btn btn-secondary">
              Back to home
            </Link>
          )}
        </div>
      )}

      {result.pages > 1 ? (
        <nav className="pagination" aria-label="Pages">
          {result.page > 1 ? (
            <Link href={buildHref(base, f, { page: result.page - 1 }, fixedType)} rel="prev">
              ← Newer
            </Link>
          ) : null}
          {Array.from({ length: result.pages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === result.pages || Math.abs(n - result.page) <= 2)
            .map((n, i, arr) => (
              <span key={n} style={{ display: "contents" }}>
                {i > 0 && n - arr[i - 1] > 1 ? <span aria-hidden="true">…</span> : null}
                {n === result.page ? (
                  <span aria-current="page">{n}</span>
                ) : (
                  <Link href={buildHref(base, f, { page: n }, fixedType)} aria-label={`Page ${n}`}>
                    {n}
                  </Link>
                )}
              </span>
            ))}
          {result.page < result.pages ? (
            <Link href={buildHref(base, f, { page: result.page + 1 }, fixedType)} rel="next">
              Older →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
