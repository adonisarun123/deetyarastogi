import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BIRTHDAY, birthdayActive } from "@/lib/birthday";
import { BirthdayRsvp } from "@/components/BirthdayRsvp";
import { HeartIcon } from "@/components/Icons";

const isPlaceholder = (s: string) => /^\[.*\]$/.test(s.trim());

export async function generateMetadata(): Promise<Metadata> {
  if (!birthdayActive()) return { title: "Not found", robots: { index: false, follow: false } };
  return {
    title: `You’re invited: ${BIRTHDAY.name} turns 16`,
    description: `${BIRTHDAY.dateLabel}. Tap to see the details and RSVP.`,
    alternates: { canonical: "/sweet16" },
    // Never indexed, never in the sitemap.
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
    openGraph: {
      title: `You’re invited: ${BIRTHDAY.name} turns 16 ♡`,
      description: `${BIRTHDAY.dateLabel} · RSVP inside`,
      images: [{ url: "/sweet16/photo", width: 900, height: 1600, alt: `${BIRTHDAY.name} in a Birthday Girl sash` }],
    },
  };
}

export default async function Sweet16() {
  if (!birthdayActive()) notFound();
  const b = BIRTHDAY;
  const photo = "/sweet16/photo";

  return (
    <>
      <section className="hero" aria-labelledby="party-h">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">You’re invited</p>
            <h1 id="party-h">
              {b.name} turns{" "}
              <span style={{ whiteSpace: "nowrap" }}>
                sweet 16
                <HeartIcon className="heart" />
              </span>
            </h1>
            <p className="intro">Come celebrate with lots of cake, a little flour and good company as {b.name} turns sixteen.</p>
            <div className="btn-row">
              <a href="#rsvp" className="btn">
                RSVP now <span className="arrow" aria-hidden="true" />
              </a>
              {b.mapsUrl ? (
                <a href={b.mapsUrl} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
                  Get directions
                </a>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ position: "relative", width: "min(100%, 400px)" }}>
              <div className="tape" style={{ background: "var(--white)", padding: "14px 14px 54px", boxShadow: "var(--shadow-lift)", transform: "rotate(2.5deg)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={`${b.name} smiling in a pink Birthday Girl sash`} width={900} height={1600} fetchPriority="high" style={{ display: "block", width: "100%", aspectRatio: "4 / 5", objectFit: "cover", objectPosition: "50% 40%" }} />
                <p className="hand" style={{ position: "absolute", left: 0, right: 0, bottom: 10, margin: 0, textAlign: "center", color: "var(--cocoa)", fontSize: "2.1rem" }}>
                  the birthday girl ♡
                </p>
              </div>
              <div
                aria-hidden="true"
                style={{ position: "absolute", right: -18, top: -34, width: 120, height: 120, borderRadius: "50%", background: "var(--cherry)", color: "var(--cream)", display: "grid", placeItems: "center", textAlign: "center", transform: "rotate(-8deg)", boxShadow: "var(--shadow-lift)" }}
              >
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "4rem", lineHeight: 0.9 }}>
                  16
                  <span className="hand" style={{ display: "block", color: "var(--cream)", fontSize: "1.4rem" }}>
                    now!
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="gingham" aria-hidden="true" />

      <section className="section surface-pink" aria-labelledby="details-h" style={{ paddingTop: 64 }}>
        <div className="container">
          <h2 id="details-h" className="sr-only">
            Party details
          </h2>
          <div className="kitchen-notes">
            <div className="panel tape">
              <p className="eyebrow" style={{ color: "var(--muted-strong)" }}>When</p>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 650, fontSize: "1.9rem", lineHeight: 1.15, margin: 0 }}>{b.dateLabel}</p>
              {!isPlaceholder(b.time) ? <p style={{ margin: "8px 0 0", fontSize: "1.2rem" }}>{b.time}</p> : <p className="muted" style={{ margin: "8px 0 0" }}>Time to be confirmed</p>}
            </div>
            <div className="panel tape">
              <p className="eyebrow" style={{ color: "var(--muted-strong)" }}>Where</p>
              {!isPlaceholder(b.venue) ? (
                <>
                  <p style={{ fontFamily: "var(--font-display)", fontWeight: 650, fontSize: "1.9rem", lineHeight: 1.15, margin: 0 }}>{b.venue}</p>
                  {!isPlaceholder(b.address) ? <p style={{ margin: "8px 0 0", fontSize: "1.2rem" }}>{b.address}</p> : null}
                  {b.mapsUrl ? (
                    <p style={{ margin: "10px 0 0" }}>
                      <a href={b.mapsUrl} target="_blank" rel="noopener noreferrer">
                        Open in Maps<span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="muted" style={{ margin: 0 }}>Venue to be confirmed — we’ll share it on WhatsApp.</p>
              )}
            </div>
            <div className="panel tape">
              <p className="eyebrow" style={{ color: "var(--muted-strong)" }}>Please reply by</p>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 650, fontSize: "1.9rem", lineHeight: 1.15, margin: 0 }}>{b.rsvpBy}</p>
              {b.dressCode ? <p style={{ margin: "8px 0 0", fontSize: "1.2rem" }}>Dress code: {b.dressCode}</p> : <p className="muted" style={{ margin: "8px 0 0" }}>So we bake enough cake for everyone.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="rsvp" aria-labelledby="rsvp-h">
        <div className="container">
          <div className="contact-panel">
            <div>
              <p className="hand" style={{ fontSize: "2.2rem", margin: 0 }} aria-hidden="true">
                kindly reply
              </p>
              <h2 id="rsvp-h">Will you be there?</h2>
              <p>Pick your answer and send it on WhatsApp, or simply call {b.phoneDisplay}.</p>
            </div>
            <BirthdayRsvp whatsapp={b.whatsapp} phoneDisplay={b.phoneDisplay} shortDate={b.shortDate} name={b.name} />
          </div>
        </div>
      </section>
    </>
  );
}
