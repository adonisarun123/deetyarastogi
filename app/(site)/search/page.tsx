import type { Metadata } from "next";
import { Feed } from "@/components/Feed";
import { listPublic, parseFilters, publicTerms } from "@/lib/content/public";

type SP = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const raw = await searchParams;
  const f = parseFilters(raw);
  const rawQ = (Array.isArray(raw.q) ? raw.q[0] : raw.q) ?? "";
  const tooShort = rawQ.trim().length > 0 && rawQ.trim().length < 2;
  const [result, categories] = await Promise.all([
    f.q ? listPublic(f) : Promise.resolve({ items: [], total: 0, page: 1, pages: 1 }),
    publicTerms("category"),
  ]);
  return (
    <section className="section" style={{ paddingTop: 40 }}>
      <div className="container">
        <h1 style={{ color: "var(--cherry)" }}>Search</h1>
        {tooShort ? (
          <p className="alert alert-info" role="status">
            Type at least 2 characters to search.
          </p>
        ) : null}
        <Feed
          base="/search"
          filters={f}
          showTypes={Boolean(f.q)}
          categories={f.q ? categories : []}
          tags={[]}
          result={result}
          searchLabel="Search recipes, bakes, tips and notes"
          emptyTitle={f.q ? "No matches" : "What are you looking for?"}
          emptyText={f.q ? undefined : "Search by dish, ingredient, technique or tag."}
        />
      </div>
    </section>
  );
}
