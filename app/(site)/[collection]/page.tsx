import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Feed, hasFilters } from "@/components/Feed";
import { collectionFor } from "@/lib/content/collections";
import { listPublic, parseFilters, publicTerms } from "@/lib/content/public";

type SP = Promise<Record<string, string | string[] | undefined>>;
type P = Promise<{ collection: string }>;

export async function generateMetadata({ params, searchParams }: { params: P; searchParams: SP }): Promise<Metadata> {
  const { collection } = await params;
  const col = collectionFor(collection);
  if (!col) return { title: "Not found" };
  const f = parseFilters(await searchParams, col.type);
  return {
    title: col.title,
    description: col.intro,
    alternates: { canonical: f.page && f.page > 1 ? `/${collection}?page=${f.page}` : `/${collection}` },
    robots: hasFilters(f, col.type) ? { index: false, follow: true } : undefined,
  };
}

export default async function CollectionPage({ params, searchParams }: { params: P; searchParams: SP }) {
  const { collection } = await params;
  const col = collectionFor(collection);
  if (!col) notFound();
  const f = parseFilters(await searchParams, col.type);
  const [result, categories, tags] = await Promise.all([
    listPublic(f),
    publicTerms("category", col.type),
    publicTerms("tag", col.type),
  ]);
  return (
    <section className="section" style={{ paddingTop: 40 }}>
      <div className="container">
        <header className="section-head" style={{ marginBottom: 28 }}>
          <div>
            <p className="hand" style={{ fontSize: "1.8rem", margin: "0 0 4px", transform: "rotate(-2deg)", display: "inline-block" }} aria-hidden="true">
              {col.handwriting}
            </p>
            <h1 style={{ color: "var(--cherry)", margin: 0 }}>{col.title}</h1>
          </div>
          <p>{col.intro}</p>
        </header>
        <Feed
          base={`/${collection}`}
          filters={f}
          fixedType={col.type}
          categories={categories}
          tags={tags}
          showDifficulty={col.type === "recipe"}
          result={result}
          searchLabel={`Search ${col.title.toLowerCase()}`}
          emptyTitle={`No ${col.title.toLowerCase()} yet`}
        />
      </div>
    </section>
  );
}
