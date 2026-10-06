import type { MetadataRoute } from "next";
import { sitemapEntries, typeCounts } from "@/lib/content/public";
import { entryPath, TYPE_PATH } from "@/lib/content/types";
import { getSettings, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Only published URLs. Unpublished entries disappear immediately (generated per request).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [entries, counts, settings] = await Promise.all([sitemapEntries(), typeCounts(), getSettings()]);
  const base = siteUrl(settings);
  const fixed = ["/", "/scrapbook", "/about", "/contact", "/privacy"].map((p) => ({ url: `${base}${p}` }));
  const collections = (Object.keys(counts) as (keyof typeof counts)[])
    .filter((t) => counts[t] > 0)
    .map((t) => ({ url: `${base}/${TYPE_PATH[t]}` }));
  return [
    ...fixed,
    ...collections,
    ...entries.map((e) => ({ url: `${base}${entryPath(e.type, e.slug)}`, lastModified: e.updated_at })),
  ];
}
