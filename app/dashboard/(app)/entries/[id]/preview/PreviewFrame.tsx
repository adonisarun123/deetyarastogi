"use client";

import { useState } from "react";

export function PreviewFrame({ id }: { id: string }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [n, setN] = useState(0);
  return (
    <>
      <div className="spread" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Preview</h1>
        <div className="row" role="group" aria-label="Device">
          <button type="button" className="chip" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>
            Desktop
          </button>
          <button type="button" className="chip" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>
            Mobile
          </button>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => setN((x) => x + 1)}>
            Refresh
          </button>
          <a className="btn btn-secondary btn-small" href={`/dashboard/entries/${id}`}>
            Back to editing
          </a>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        This uses the real public page design with your latest saved draft. It isn’t public and isn’t indexed.
      </p>
      <iframe key={n} title="Entry preview" src={`/preview/${id}`} className="preview-frame" data-device={device} />
    </>
  );
}
