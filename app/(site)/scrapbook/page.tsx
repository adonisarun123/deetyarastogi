import type { Metadata } from "next";
import { Feed, hasFilters } from "@/components/Feed";
import { listPublic, parseFilters, publicTerms } from "@/lib/content/public";

type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  return {
    title: "The scrapbook",
    description: "Every bake, recipe, video, tip and journal entry in one place.",
    alternates: { canonical: f.page && f.page > 1 ? `/scrapbook?page=${f.page}` : "/scrapbook" },
    // Filter combinations stay out of search indexes; the main collection stays indexable.
    robots: hasFilters(f) ? { index: false, follow: true } : undefined,
  };
}

export default async function ScrapbookPage({ searchParams }: { searchParams: SP }) {
  const f = parseFilters(await searchParams);
  const [result, categories, tags] = await Promise.all([listPublic(f), publicTerms("category"), publicTerms("tag")]);
  return (
    <section className="section" style={{ paddingTop: 40 }}>
      <div className="container">
        <header className="section-head" style={{ marginBottom: 28 }}>
          <div>
            <p className="eyebrow">Everything so far</p>
            <h1 style={{ color: "var(--cherry)", margin: 0 }}>
              The <span className="piped">scrapbook</span>
            </h1>
          </div>
          <p>Photo stories, recipes, videos, tips and journal notes — newest first.</p>
        </header>
        <Feed
          base="/scrapbook"
          filters={f}
          showTypes
          categories={categories}
          tags={tags}
          result={result}
          searchLabel="Search the scrapbook"
          emptyTitle="The scrapbook is just getting started"
          emptyText="The first bakes are on their way. Check back soon."
        />
      </div>
    </section>
  );
}
