import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section">
      <div className="container narrow center">
        <p className="hand" style={{ fontSize: "2.2rem", margin: 0 }} aria-hidden="true">
          oops — this one didn’t rise
        </p>
        <h1 style={{ color: "var(--cherry)" }}>We couldn’t find that page</h1>
        <p className="muted">It may have been moved or taken down. Try the scrapbook or search for what you were after.</p>
        <form action="/search" method="get" role="search" className="row" style={{ justifyContent: "center", margin: "24px auto", maxWidth: 520, flexWrap: "nowrap" }}>
          <label htmlFor="nf-q" className="sr-only">
            Search
          </label>
          <input id="nf-q" type="search" name="q" minLength={2} placeholder="Search recipes, bakes, tips…" />
          <button className="btn" type="submit">
            Search
          </button>
        </form>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <Link href="/scrapbook" className="btn btn-secondary">
            Open the scrapbook
          </Link>
          <Link href="/" className="btn btn-quiet">
            Home
          </Link>
        </div>
      </div>
    </section>
  );
}
