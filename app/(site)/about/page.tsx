import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Img } from "@/components/Img";
import { JsonLd } from "@/components/JsonLd";
import { Timeline } from "@/components/Timeline";
import { variantsFor } from "@/lib/media";
import { getProfile, getSettings, listExperiences, siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const p = await getProfile();
  return {
    title: `About ${p.publicName}`,
    description: p.shortBio || `Meet ${p.publicName}: training, internship experience and what’s next in baking.`,
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const [profile, settings, experiences] = await Promise.all([getProfile(), getSettings(), listExperiences(true)]);
  const media = await variantsFor(profile.portrait ? [profile.portrait.assetId] : []);
  const portraitInfo = profile.portrait ? media.get(profile.portrait.assetId) : undefined;
  const base = siteUrl(settings);
  const answers = [
    ["What first drew me to baking", profile.answers.drewMe],
    ["The part I enjoy most", profile.answers.enjoy],
    ["What I’d love to learn next", profile.answers.learnNext],
  ].filter(([, v]) => v.trim());
  const bio = profile.fullBio || profile.shortBio;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: `${base}/about`,
          mainEntity: { "@type": "Person", name: profile.publicName, description: profile.shortBio || undefined, sameAs: settings.socialLinks.map((s) => s.url) },
        }}
      />
      <section className="section surface-pistachio" style={{ paddingTop: 32 }}>
        <div className="container">
          <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "About" }]} />
          <div className="about-grid" style={{ marginTop: 28 }}>
            {profile.portrait && portraitInfo ? (
              <div className="about-photo">
                <Img placement={profile.portrait} info={portraitInfo} sizes="(min-width: 900px) 440px, 90vw" ratio="4 / 5" priority />
              </div>
            ) : null}
            <div style={profile.portrait && portraitInfo ? undefined : { gridColumn: "1 / -1", maxWidth: 780 }}>
              <p className="hand" style={{ fontSize: "2rem", margin: "0 0 6px" }} aria-hidden="true">
                nice to meet you
              </p>
              <h1 style={{ color: "#2f4219" }}>The person behind the piping bag</h1>
              {profile.ageLine ? <p style={{ fontWeight: 600 }}>{profile.ageLine}</p> : null}
              {bio ? (
                bio.split(/\n{2,}/).map((para, i) => (
                  <p key={i} style={{ fontSize: "1.1rem" }}>
                    {para}
                  </p>
                ))
              ) : (
                <p style={{ fontSize: "1.1rem" }}>
                  I’m {profile.publicName}, and baking is something I want to keep learning about and build a career in. This is where I share
                  my work, the things I’m practising and the next steps in my journey.
                </p>
              )}
              {profile.location ? <p className="muted">Based in {profile.location}</p> : null}
              {profile.currentLearning ? (
                <p className="note-block" style={{ display: "inline-block" }}>
                  <strong className="note-label">Currently learning</strong>
                  {profile.currentLearning}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {answers.length ? (
        <section className="section" aria-labelledby="qa-h">
          <div className="container">
            <h2 id="qa-h" style={{ color: "var(--cherry)" }}>
              In my own words
            </h2>
            <div className="kitchen-notes">
              {answers.map(([q, a]) => (
                <div key={q} className="panel">
                  <h3>{q}</h3>
                  <p style={{ margin: 0 }}>{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {experiences.length ? (
        <section className="section surface-cream-deep" aria-labelledby="journey-h" id="journey">
          <div className="container">
            <div className="section-head">
              <h2 id="journey-h">Learning, one bake at a time</h2>
              <p>Training, internship experience and what’s next.</p>
            </div>
            <Timeline items={experiences} />
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="container center">
          <h2 style={{ color: "var(--cherry)" }}>See what I’ve been making</h2>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <Link href="/scrapbook" className="btn">
              Explore my scrapbook
            </Link>
            <Link href="/contact" className="btn btn-secondary">
              Say hello
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
