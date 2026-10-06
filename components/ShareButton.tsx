"use client";

import { useState } from "react";

/** Device share sheet when available; Copy link fallback. Always shares the canonical URL. */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const [status, setStatus] = useState("");

  const onClick = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
    } catch {
      window.prompt("Copy this link:", url);
    }
    setTimeout(() => setStatus(""), 3000);
  };

  return (
    <span className="share-wrap">
      <button type="button" className="btn btn-quiet btn-small" onClick={onClick}>
        Share
      </button>
      <span className="share-status" role="status" aria-live="polite">
        {status}
      </span>
    </span>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn btn-secondary btn-small" onClick={() => window.print()}>
      Print recipe
    </button>
  );
}
