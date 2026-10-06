"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";

export function EntryRowActions({ id, state }: { id: string; state: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const act = async (action: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ id?: string }>(`/api/entries/${id}`, { body: { action } });
      if (action === "duplicate" && r.id) window.location.href = `/dashboard/entries/${r.id}`;
      else window.location.reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "That didn’t work.");
      setBusy(false);
    }
  };
  return (
    <span className="row" style={{ gap: 6 }}>
      {state === "trashed" ? (
        <button className="tool-btn" disabled={busy} onClick={() => act("restore")}>
          Restore as draft
        </button>
      ) : (
        <>
          <a className="tool-btn" href={`/dashboard/entries/${id}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            Edit
          </a>
          <button className="tool-btn" disabled={busy} onClick={() => act("duplicate")}>
            Duplicate
          </button>
          {state === "published" ? (
            <button className="tool-btn" disabled={busy} onClick={() => act("unpublish", "Unpublish this entry? It will disappear from the site, search and sitemap. The draft is kept.")}>
              Unpublish
            </button>
          ) : null}
          <button className="tool-btn danger" disabled={busy} onClick={() => act("trash", "Move to trash? You can restore it for 30 days.")}>
            Trash
          </button>
        </>
      )}
      {msg ? (
        <span role="alert" className="error-text">
          {msg}
        </span>
      ) : null}
    </span>
  );
}
