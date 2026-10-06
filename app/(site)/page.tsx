import type { Metadata } from "next";
import Link from "next/link";
import { CardGrid } from "@/components/Card";
import { GiftNote } from "@/components/GiftNote";
import { CakeArt, HeartIcon } from "@/components/Icons";
import { Img } from "@/components/Img";
import { JsonLd } from "@/components/JsonLd";
import { Timeline } from "@/components/Timeline";
import { cardsByIds, latest, listPublic } from "@/lib/content/public";
import { variantsFor } from "@/lib/media";
import { getProfile, getSettings, listExperiences, siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const [s, p] = await Promise.all([getSettings(), getProfile()]);
  return {
    title: { absolute: `${s.brandName} | Baking Portfolio & Journey` },
    description: `Explore ${p.publicName}’s baking portfolio, professional training and internship journey, with selected creations and notes from the kitchen.`,
    alternates: { canonical: "/" },
    openGraph: { type: "website", siteName: s.brandName, title: s.brandName, url: "/" },
  };
}

export default async function Home() {
  const [settings, profile, experiences] = await Promise.all([getSettings(), getProfile(), listExperiences(true)]);
  const featured = (await cardsByIds(settings.featuredIds)).slice(0, 6);
  const [recent, videos] = await Promise.all([
    latest(6, featured.map((f) => f.id)),
    listPublic({ type: "video", page: 1 }, 3),
  ]);
  const media = await variantsFor(
    [settings.hero?.assetId, settings.heroProcess?.assetId, profile.portrait?.assetId].filter(Boolean) as string[],
  );
  const heroInfo = settings.hero ? media.get(settings.hero.assetId) : undefined;
  const processInfo = settings.heroProcess ? media.get(settings.heroProcess.assetId) : undefined;
  const portraitInfo = profile.portrait ? media.get(profile.portrait.assetId) : undefined;
  const base = siteUrl(settings);
  const journey = experiences.slice(0, 4);
  // Keep the last word and the heart together so the heart never wraps alone.
  const words = settings.headline.trim().split(/\s+/);
  const headlineTail = words.pop() ?? "";
  const headlineHead = words.length ? words.join(" ") + " " : "";

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: `${base}/`,
          mainEntity: {
            "@type": "Person",
            name: profile.publicName,
            description: profile.shortBio || undefined,
            url: `${base}/about`,
            sameAs: settings.socialLinks.map((s) => s.url),
          },
        }}
      />

      {/* Hero */}
      <section className="hero" aria-labelledby="hero-h">
        <div className="container hero-grid">
          <div>
            {settings.eyebrow ? <p className="eyebrow">{settings.eyebrow}</p> : null}
            <h1 id="hero-h">
              {headlineHead}
              <span style={{ whiteSpace: "nowrap" }}>
                {headlineTail}
                <HeartIcon className="heart" />
              </span>
            </h1>
            {settings.intro ? <p className="intro">{settings.intro}</p> : null}
            <div className="btn-row">
              <Link href="/scrapbook" className="btn">
                Explore my scrapbook <span className="arrow" aria-hidden="true" />
              </Link>
              <Link href="/about" className="btn btn-secondary">
                Meet the baker
              </Link>
            </div>
            {settings.supportingLine ? (
              <p className="support">
                {settings.supportingLine.split("•").map((s) => (
                  <span key={s}>{s.trim()}</span>
                ))}
              </p>
            ) : null}
          </div>

          {settings.hero && heroInfo ? (
            <div className="hero-stage scallop-edge" style={{ ["--edge" as string]: "var(--cream)" }}>
              <div className="main">
                <Img placement={settings.hero} info={heroInfo} sizes="(min-width: 900px) 58vw, 94vw" priority ratio="auto" className="hero-img" />
              </div>
              {settings.heroProcess && processInfo ? (
                <div className="process tape">
                  <Img placement={settings.heroProcess} info={processInfo} sizes="220px" />
                </div>
              ) : null}
              {settings.heroAnnotation ? (
                <span className="annotation hand" aria-hidden="true">
                  {settings.heroAnnotation} ♡
                </span>
              ) : null}
            </div>
          ) : (
            <div className="hero-stage empty" aria-hidden="true">
              <CakeArt className="placeholder-art" />
              {settings.heroAnnotation ? <span className="annotation hand">{settings.heroAnnotation} ♡</span> : null}
            </div>
          )}
        </div>
      </section>

      <div className="gingham" aria-hidden="true" />

      {/* Featured */}
      {featured.length ? (
        <section className="section surface-pink" aria-labelledby="featured-h">
          <div className="container">
            <div className="section-head">
              <h2 id="featured-h">
                Made with care. Shared with joy.
                <HeartIcon className="heart" />
              </h2>
              <p>A few favourites from the scrapbook.</p>
            </div>
            <CardGrid cards={featured} featureFirst={(featured.length + 1) % 3 === 0} priorityCount={2} />
          </div>
        </section>
      ) : null}

      {/* Latest */}
      {recent.length || !featured.length ? (
      <section className="section" aria-labelledby="latest-h">
        <div className="container">
          <div className="section-head">
            <h2 id="latest-h">Fresh from the scrapbook</h2>
            {recent.length ? (
              <Link href="/scrapbook" className="btn btn-secondary">
                See everything <span className="arrow" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
          {recent.length ? (
            <CardGrid cards={recent} priorityCount={featured.length ? 0 : 2} />
          ) : featured.length ? null : (
            <div className="empty-state">
              <h3 style={{ fontSize: "1.6rem" }}>The first page is still being written</h3>
              <p className="muted" style={{ margin: "0 auto", maxWidth: "44ch" }}>
                Bakes, recipes and kitchen notes will appear here as soon as they’re shared.
              </p>
            </div>
          )}
        </div>
      </section>
      ) : null}

      {/* Watch from the kitchen */}
      {videos.items.length ? (
        <section className="section surface-cream-deep" aria-labelledby="watch-h">
          <div className="container">
            <div className="section-head">
              <h2 id="watch-h">Watch from the kitchen</h2>
              <Link href="/videos" className="btn btn-secondary">
                All videos <span className="arrow" aria-hidden="true" />
              </Link>
            </div>
            <CardGrid cards={videos.items} />
          </div>
        </section>
      ) : null}

      {/* About + journey */}
      <section className="section surface-pistachio" aria-labelledby="about-h">
        <div className="container">
          <div className="about-grid">
            {profile.portrait && portraitInfo ? (
              <div className="about-photo">
                <Img placement={profile.portrait} info={portraitInfo} sizes="(min-width: 900px) 440px, 90vw" ratio="4 / 5" />
              </div>
            ) : null}
            <div style={profile.portrait && portraitInfo ? undefined : { gridColumn: "1 / -1", maxWidth: 760 }}>
              <p className="hand" style={{ fontSize: "1.9rem", margin: "0 0 6px" }} aria-hidden="true">
                hello there!
              </p>
              <h2 id="about-h" style={{ color: "#2f4219" }}>
                The person behind the piping bag
              </h2>
              {profile.shortBio ? (
                <p style={{ fontSize: "1.1rem" }}>{profile.shortBio}</p>
              ) : (
                <p style={{ fontSize: "1.1rem" }}>
                  I’m {profile.publicName}, and baking is something I want to keep learning about and build a career in. This is where I
                  share my work, the things I’m practising and the next steps in my journey.
                </p>
              )}
              {profile.currentLearning ? (
                <p className="note-block" style={{ display: "inline-block", marginTop: 8 }}>
                  <strong className="note-label">Currently learning</strong>
                  {profile.currentLearning}
                </p>
              ) : null}
              <div className="btn-row" style={{ marginTop: 20 }}>
                <Link href="/about" className="btn">
                  Meet the baker
                </Link>
              </div>
            </div>
          </div>

          {journey.length ? (
            <div style={{ marginTop: 56 }}>
              <h2 style={{ fontSize: "clamp(1.6rem,3vw,2.4rem)", color: "#2f4219" }}>Learning, one bake at a time</h2>
              <Timeline items={journey} compact />
            </div>
          ) : null}
        </div>
      </section>

      {/* Contact */}
      <section className="section" aria-labelledby="hello-h">
        <div className="container">
          <div className="contact-panel">
            <div>
              <h2 id="hello-h">Something good starts with a hello</h2>
              <p>{settings.contactIntro}</p>
            </div>
            <div style={{ alignSelf: "center" }}>
              <p className="muted">{settings.contactManagedBy}</p>
              <Link href="/contact" className="btn">
                Send a note <span className="arrow" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {settings.giftNote.enabled && settings.giftNote.text ? <GiftNote text={settings.giftNote.text} from={settings.giftNote.from} /> : null}
    </>
  );
}
