import Link from "next/link";
import { HeartIcon } from "../Icons";
import type { SiteSettings } from "@/lib/site";
import type { NavItem } from "./Header";

export function Footer({ settings, nav }: { settings: SiteSettings; nav: NavItem[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link href="/" className="wordmark">
              <span>{settings.brandName}</span>
              <HeartIcon />
            </Link>
            {settings.footerLine ? <p style={{ marginTop: 12, maxWidth: "36ch" }}>{settings.footerLine}.</p> : null}
          </div>
          <div>
            <h2>Explore</h2>
            <ul>
              {nav.map((n) => (
                <li key={n.href}>
                  <Link href={n.href}>{n.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Say hello</h2>
            <ul>
              <li>
                <Link href="/contact">Send a note</Link>
              </li>
              {settings.socialLinks.map((s) => (
                <li key={s.url}>
                  <a href={s.url} rel="me noopener noreferrer" target="_blank">
                    {s.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="fine">
          <span>
            © {year} {settings.brandName}. All photos and words are her own unless credited.
          </span>
          <Link href="/dashboard" rel="nofollow">
            Studio sign-in
          </Link>
        </div>
      </div>
    </footer>
  );
}
