import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ContactForm } from "@/components/ContactForm";
import { getSettings } from "@/lib/site";

export const metadata: Metadata = {
  title: "Say hello",
  description: "Send a note about learning opportunities, collaborations or just a kind hello.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const settings = await getSettings();
  return (
    <section className="section" style={{ paddingTop: 32 }}>
      <div className="container">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Contact" }]} />
        <div className="contact-panel" style={{ marginTop: 28 }}>
          <div>
            <h1 style={{ color: "var(--cherry)", fontSize: "clamp(2.25rem,5vw,3.5rem)" }}>Something good starts with a hello</h1>
            <p style={{ fontSize: "1.1rem" }}>{settings.contactIntro}</p>
            <div className="note-block" id="contact-privacy">
              <strong className="note-label">Who reads this?</strong>
              <p style={{ margin: 0 }}>
                {settings.contactManagedBy} We only use your name and email to reply — no newsletters, no sharing. Messages are kept for up to
                90 days. <Link href="/privacy">Privacy details</Link>.
              </p>
            </div>
          </div>
          <ContactForm alternativeEmail={settings.alternativeEmail || undefined} />
        </div>
      </div>
    </section>
  );
}
