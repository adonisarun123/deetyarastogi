import type { MetadataRoute } from "next";
import { getSettings, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = siteUrl(await getSettings());
  // Staging/preview deployments: keep everything out of search until ALLOW_INDEXING=true.
  if (process.env.ALLOW_INDEXING !== "true") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/", "/preview/", "/search", "/invite/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
