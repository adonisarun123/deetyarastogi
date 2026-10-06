import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { EntryView } from "@/components/EntryView";
import { collectionFor } from "@/lib/content/collections";
import { findRedirect, getPublicEntry } from "@/lib/content/public";
import { getProfile, getSettings, siteUrl } from "@/lib/site";
import { mediaUrl } from "@/components/Img";

type Params = { collection: string; slug: string };

async function load(params: Params) {
  const col = collectionFor(params.collection);
  if (!col) return null;
  return getPublicEntry(col.type, params.slug);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const e = await load(p).catch(() => null);
  if (!e) return { title: "Not found" };
  const settings = await getSettings();
  const c = e.content;
  const cover = e.card.cover;
  const og = cover?.jpeg ? mediaUrl(cover.assetId, cover.jpeg, "jpg") : undefined;
  return {
    title: c.seoTitle || c.title,
    description: c.seoDescription || c.summary || undefined,
    alternates: { canonical: e.card.path },
    openGraph: {
      type: "article",
      title: c.seoTitle || c.title,
      description: c.seoDescription || c.summary || undefined,
      url: e.card.path,
      siteName: settings.brandName,
      publishedTime: e.card.firstPublishedAt,
      modifiedTime: e.card.updatedAt,
      images: og ? [{ url: og, width: cover!.jpeg!, alt: cover!.alt }] : undefined,
    },
    twitter: { card: og ? "summary_large_image" : "summary" },
  };
}

export default async function EntryPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const col = collectionFor(p.collection);
  if (!col) notFound();
  const e = await getPublicEntry(col.type, p.slug);
  if (!e) {
    const to = await findRedirect(`/${p.collection}/${p.slug}`);
    if (to) permanentRedirect(to);
    notFound();
  }
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
  return (
    <EntryView
      type={col.type}
      slug={e.card.slug}
      content={e.content}
      media={e.media}
      authorName={profile.publicName}
      firstPublishedAt={e.card.firstPublishedAt}
      updatedAt={e.card.updatedAt}
      categoryName={e.card.categoryName}
      categorySlug={e.card.categorySlug}
      tags={e.tags}
      related={e.related}
      siteUrl={siteUrl(settings)}
    />
  );
}
