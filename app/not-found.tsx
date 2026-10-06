import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="section">
      <div className="container narrow center">
        <h1 style={{ color: "var(--cherry)" }}>We couldn’t find that page</h1>
        <p className="muted">It may have moved or been taken down.</p>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <Link href="/scrapbook" className="btn">
            Open the scrapbook
          </Link>
          <Link href="/" className="btn btn-secondary">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
