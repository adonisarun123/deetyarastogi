"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { MediaPlacement } from "@/lib/content/types";
import { Uploader } from "./Uploader";

export interface LibraryItem {
  id: string;
  state: string;
  error: string | null;
  width: number | null;
  height: number | null;
  default_alt: string;
  default_caption: string;
  credit: string;
  focal_x: number;
  focal_y: number;
  original_name: string | null;
  widths: number[];
  usage_count: string;
  used_publicly: boolean | null;
  created_at: string;
}

export function thumbUrl(id: string, _widths?: number[]) {
  return `/api/media/${id}/thumb`;
}

export function toPlacement(a: Pick<LibraryItem, "id" | "default_alt" | "default_caption" | "credit" | "focal_x" | "focal_y">): MediaPlacement {
  return { assetId: a.id, alt: a.default_alt ?? "", caption: a.default_caption ?? "", credit: a.credit ?? "", focalX: a.focal_x ?? 0.5, focalY: a.focal_y ?? 0.5 };
}

export function MediaPicker({
  open,
  multiple,
  onClose,
  onPick,
  title = "Add photos",
}: {
  open: boolean;
  multiple: boolean;
  onClose: () => void;
  onPick: (p: MediaPlacement[]) => void;
  title?: string;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ items: LibraryItem[] }>(`/api/media?q=${encodeURIComponent(search)}`);
      setItems(r.items);
    } catch {
      /* shown as empty */
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setSelected([]);
      load();
    }
    if (!open && d.open) d.close();
  }, [open, load]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : multiple ? [...s, id] : [id]));

  const confirm = () => {
    const chosen = selected.map((id) => items.find((i) => i.id === id)).filter(Boolean) as LibraryItem[];
    onPick(chosen.map(toPlacement));
    onClose();
  };

  return (
    <dialog ref={dlg} className="s-dialog" onClose={onClose} aria-labelledby="mp-title">
      <div className="dlg-head">
        <h2 id="mp-title">{title}</h2>
        <button type="button" className="btn btn-quiet btn-small" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="dlg-body">
        <Uploader
          compact
          onReady={async (a) => {
            await load();
            setSelected((s) => (multiple ? [...s, a.id] : [a.id]));
          }}
        />
        <div className="row" style={{ margin: "20px 0 12px", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="mp-q">Search your photos</label>
            <input id="mp-q" type="search" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), load())} />
          </div>
          <button type="button" className="btn btn-quiet" onClick={load}>
            Search
          </button>
        </div>
        {loading ? <p role="status">Loading photos…</p> : null}
        <div className="media-grid" role="list">
          {items.map((it) => {
            const ready = it.state === "ready";
            const isSel = selected.includes(it.id);
            return (
              <div key={it.id} className="media-tile" role="listitem" data-selected={isSel}>
                <button type="button" className="thumb" disabled={!ready} aria-pressed={isSel} onClick={() => toggle(it.id)} aria-label={`${isSel ? "Deselect" : "Select"} ${it.default_alt || it.original_name || "photo"}`}>
                  {ready ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl(it.id, it.widths)} alt="" loading="lazy" />
                  ) : (
                    <span>{it.state === "failed" ? `Failed: ${it.error ?? ""}` : "Processing…"}</span>
                  )}
                </button>
                <div className="cap">{it.default_alt || it.original_name || "Untitled photo"}</div>
              </div>
            );
          })}
        </div>
        {!loading && !items.length ? <p className="muted">No photos yet — upload some above.</p> : null}
      </div>
      <div className="editor-bar" style={{ margin: 0, position: "sticky" }}>
        <span className="save-state">{selected.length ? `${selected.length} selected` : multiple ? "Select one or more photos" : "Select a photo"}</span>
        <button type="button" className="btn" disabled={!selected.length} onClick={confirm}>
          {multiple ? "Add selected" : "Use this photo"}
        </button>
      </div>
    </dialog>
  );
}
