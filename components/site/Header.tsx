"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HeartIcon, MenuIcon, SearchIcon } from "../Icons";

export interface NavItem {
  href: string;
  label: string;
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Header({ brand, primary, more }: { brand: string; primary: NavItem[]; more: NavItem[] }) {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);


  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoreOpen(false);
        (moreRef.current?.querySelector("button") as HTMLButtonElement | null)?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuBtn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const moreActive = more.some((m) => isActive(pathname, m.href));

  return (
    <header className="site-header" data-scrolled={scrolled}>
      <div className="container">
        <div className="bar">
          <Link href="/" className="wordmark" aria-label={`${brand} — home`}>
            <span>{brand}</span>
            <HeartIcon />
          </Link>

          <nav className="nav-desktop" aria-label="Main">
            {primary.map((n) => (
              <Link key={n.href} href={n.href} aria-current={isActive(pathname, n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
            {more.length > 0 && (
              <div className="nav-more" ref={moreRef}>
                <button
                  type="button"
                  aria-expanded={moreOpen}
                  aria-controls="more-menu"
                  onClick={() => setMoreOpen((v) => !v)}
                  style={moreActive ? { color: "var(--cherry)" } : undefined}
                >
                  More
                </button>
                {moreOpen && (
                  <div className="menu" id="more-menu">
                    {more.map((n) => (
                      <Link key={n.href} href={n.href} onClick={() => setMoreOpen(false)} aria-current={isActive(pathname, n.href) ? "page" : undefined}>
                        {n.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="icon-btn"
              aria-expanded={searchOpen}
              aria-controls="site-search"
              onClick={() => {
                setSearchOpen((v) => !v);
                setMenuOpen(false);
              }}
            >
              <SearchIcon />
              <span className="hide-mobile">Search</span>
              <span className="sr-only">{searchOpen ? " (close)" : ""}</span>
            </button>
            <button
              ref={menuBtn}
              type="button"
              className="icon-btn menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => {
                setMenuOpen((v) => !v);
                setSearchOpen(false);
              }}
            >
              <span>Menu</span>
              <MenuIcon open={menuOpen} />
            </button>
            <Link href="/contact" className="btn header-cta">
              Say hello
            </Link>
          </div>
        </div>

        {searchOpen && (
          <div className="search-panel" id="site-search">
            <form action="/search" method="get" role="search" className="row" style={{ flexWrap: "nowrap" }}>
              <label htmlFor="site-search-q" className="sr-only">
                Search recipes, bakes and notes
              </label>
              <input
                ref={searchInput}
                id="site-search-q"
                type="search"
                name="q"
                minLength={2}
                maxLength={100}
                required
                placeholder="Search recipes, bakes, tips…"
                autoComplete="off"
              />
              <button type="submit" className="btn">
                Search
              </button>
            </form>
          </div>
        )}

        {menuOpen && (
          <nav className="mobile-menu" id="mobile-menu" aria-label="Main">
            {[...primary, ...more].map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} aria-current={isActive(pathname, n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
