import { Header, type NavItem } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { getSettings } from "@/lib/site";
import { typeCounts } from "@/lib/content/public";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, counts] = await Promise.all([getSettings(), typeCounts()]);

  // Empty collections are hidden from public navigation (they stay available in the editor).
  const primary: NavItem[] = [
    { href: "/", label: "Home" },
    { href: "/scrapbook", label: "Scrapbook" },
    ...(counts.recipe ? [{ href: "/recipes", label: "Recipes" }] : []),
    ...(counts.video ? [{ href: "/videos", label: "Videos" }] : []),
    { href: "/about", label: "About" },
  ];
  const more: NavItem[] = [
    ...(counts.story ? [{ href: "/bakes", label: "Photo stories" }] : []),
    ...(counts.tip ? [{ href: "/tips", label: "Tips" }] : []),
    ...(counts.journal ? [{ href: "/journal", label: "Journal" }] : []),
    { href: "/contact", label: "Contact" },
  ];

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header brand={settings.brandName} primary={primary} more={more} />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <Footer settings={settings} nav={[...primary, ...more.filter((m) => m.href !== "/contact")]} />
    </>
  );
}
