import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getSettings } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How this site handles messages, videos and visitor information.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const s = await getSettings();
  return (
    <section className="section" style={{ paddingTop: 32 }}>
      <div className="container narrow">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Privacy" }]} />
        <h1 style={{ color: "var(--cherry)", marginTop: 24 }}>Privacy, in plain words</h1>
        <div className="prose">
          <p>
            {s.brandName} is a personal baking scrapbook. It is run by a young baker with the support of her parent, who manages the site’s
            accounts and inbox.
          </p>
          <h2>Messages you send</h2>
          <p>
            When you use the contact form we store your name, email, optional reason and message in a private inbox that only the site owner
            (her parent) can read. We use these details only to reply. We don’t add you to any mailing list and we never publish or share your
            message. Messages are deleted after 90 days unless we need to keep a conversation going.
          </p>
          <h2>YouTube videos</h2>
          <p>
            Videos are hosted on YouTube. Nothing is loaded from YouTube until you press “Load YouTube video”. When you do, the video plays in
            YouTube’s privacy-enhanced mode (youtube-nocookie.com), and YouTube (Google) receives information such as your IP address and the
            page you’re on, under Google’s own privacy policy.
          </p>
          <h2>Photos</h2>
          <p>
            Location and camera information is removed from every photo before it appears here. Photos show work she made or helped with; any
            other photographer or collaborator is credited.
          </p>
          <h2>Cookies and analytics</h2>
          <p>
            Public pages don’t set cookies. A single sign-in cookie is used only on the private studio pages. We don’t run advertising or
            visitor-tracking analytics. If simple, privacy-friendly page counts are ever switched on, this page will say so first.
          </p>
          <p>
            Recipe checkboxes (“Mark step as done”) are remembered only in your own browser tab and disappear when you close it.
          </p>
          <h2>Removing content</h2>
          <p>
            When something is unpublished it disappears from this site within about a minute. Copies already saved elsewhere — screenshots,
            other websites or YouTube — have their own lifecycles.
          </p>
          <h2>Questions</h2>
          <p>Use the contact form and the site owner will reply.</p>
        </div>
      </div>
    </section>
  );
}
