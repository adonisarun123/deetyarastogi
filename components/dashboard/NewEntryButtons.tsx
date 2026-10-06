"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { ENTRY_TYPES, TYPE_LABEL, type EntryType } from "@/lib/content/types";

const HINT: Record<EntryType, string> = {
  story: "Photos of a bake",
  recipe: "Ingredients & method",
  video: "A YouTube link",
  tip: "A quick lesson",
  journal: "A longer story",
};

export function NewEntryButtons() {
  const [busy, setBusy] = useState<EntryType | null>(null);
  const [error, setError] = useState("");
  const create = async (type: EntryType) => {
    setBusy(type);
    setError("");
    try {
      const r = await api<{ id: string }>("/api/entries", { body: { type } });
      window.location.assign(`/dashboard/entries/${r.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn’t create the entry.");
      setBusy(null);
    }
  };
  return (
    <div>
      <div className="new-entry-grid">
        {ENTRY_TYPES.map((t) => (
          <button key={t} type="button" onClick={() => create(t)} disabled={busy !== null}>
            {busy === t ? "Creating…" : `New ${TYPE_LABEL[t].toLowerCase()}`}
            <small>{HINT[t]}</small>
          </button>
        ))}
      </div>
      {error ? (
        <p className="alert alert-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
