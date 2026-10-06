"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/client/api";

export function StudioNav({ brand, user }: { brand: string; user: { name: string; role: "owner" | "author" } }) {
  const path = usePathname() ?? "";
  const items = [
    { href: "/dashboard", label: "Overview", exact: true },
    { href: "/dashboard/entries", label: "Entries" },
    { href: "/dashboard/media", label: "Photos" },
    { href: "/dashboard/home", label: "Homepage" },
    { href: "/dashboard/profile", label: "Profile & journey" },
    { href: "/dashboard/taxonomy", label: "Categories & tags" },
    ...(user.role === "owner"
      ? [
          { href: "/dashboard/inbox", label: "Inbox" },
          { href: "/dashboard/settings", label: "Owner settings" },
        ]
      : []),
    { href: "/dashboard/account", label: "Account" },
  ];
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));
  return (
    <aside className="studio-nav">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="spread" style={{ flexWrap: "nowrap" }}>
        <Link href="/dashboard" className="brand">
          {brand} <small>Studio</small>
        </Link>
        <a href="/" className="btn btn-small" style={{ background: "transparent", borderColor: "rgba(255,247,232,.4)" }} target="_blank" rel="noopener">
          View site
        </a>
      </div>
      <nav aria-label="Studio">
        {items.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i.href, i.exact) ? "page" : undefined}>
            {i.label}
          </Link>
        ))}
      </nav>
      <div className="who">
        <p style={{ margin: "0 0 8px" }}>
          Signed in as <strong>{user.name}</strong>
          <br />
          {user.role === "owner" ? "Owner" : "Baker / author"}
        </p>
        <button
          type="button"
          className="btn btn-small"
          style={{ background: "transparent", borderColor: "rgba(255,247,232,.4)" }}
          onClick={async () => {
            await api("/api/auth/logout", { body: {} }).catch(() => {});
            window.location.href = "/dashboard/login";
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
