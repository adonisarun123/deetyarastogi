"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { TYPE_LABEL, type EntryType } from "@/lib/content/types";
import { formatDateTime } from "@/lib/text";
import { Uploader } from "./Uploader";
import { thumbUrl, type LibraryItem } from "./MediaPicker";

interface Usage {
  owner_kind: string;
  owner_id: string;
  in_draft: boolean;
  in_published: boolean;
  type: EntryType | null;
  title: string | null;
}

export function MediaLibrary({ initialFilter }: { initialFilter: string }) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<LibraryItem | null>(null);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [form, setForm] = useState({ alt: "", caption: "", credit: "", focalX: 0.5, focalY: 0.5 });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await api<{ items: LibraryItem[]; total: number }>(`/api/media?filter=${filter}&q=${encodeURIComponent(search)}`).catch(() => ({ items: [], total: 0 }));
    setItems(r.items);
    setTotal(r.total);
  }, [filter, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const open = async (it: LibraryItem) => {
    setSel(it);
    setMsg("");
    setErr("");
    setForm({ alt: it.default_alt, caption: it.default_caption, credit: it.credit, focalX: it.focal_x, focalY: it.focal_y });
    const r = await api<{ usage: Usage[] }>(`/api/media/${it.id}`).catch(() => ({ usage: [] }));
    setUsage(r.usage);
  };

  const save = async () => {
    if (!sel) return;
    setErr("");
    try {
      await api(`/api/media/${sel.id}`, { method: "PATCH", body: form });
      setMsg("Saved. New uses of this photo start with these details.");
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn’t save.");
    }
  };

  const retry = async () => {
    if (!sel) return;
    setErr("");
    try {
      await api(`/api/media/${sel.id}`, { body: {} });
      setMsg("Processed successfully.");
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Still failing — try uploading a different file.");
    }
  };

  const remove = async () => {
    if (!sel || !window.confirm("Permanently delete this photo? This can’t be undone.")) return;
    try {
      await api(`/api/media/${sel.id}`, { method: "DELETE" });
      setSel(null);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn’t delete.");
    }
  };

  return (
    <div className="editor-layout">
      <div>
        <section className="s-panel" style={{ marginTop: 0 }}>
          <Uploader onReady={() => load()} />
        </section>
        <section className="s-panel">
          <div className="row" style={{ alignItems: "flex-end", marginBottom: 12 }}>
            <div className="field" style={{ flex: "1 1 200px" }}>
              <label htmlFor="ml-q">Search descriptions</label>
              <input id="ml-q" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="row" role="group" aria-label="Filter">
              {[
                ["", "All"],
                ["unused", "Not used anywhere"],
                ["failed", "Failed"],
              ].map(([k, l]) => (
                <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <p className="muted" role="status">
            {total} photo{total === 1 ? "" : "s"}
          </p>
          <div className="media-grid">
            {items.map((it) => (
              <div key={it.id} className="media-tile" data-selected={sel?.id === it.id}>
                <button type="button" className="thumb" onClick={() => open(it)} aria-label={`Edit ${it.default_alt || it.original_name || "photo"}`}>
                  {it.state === "ready" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl(it.id)} alt="" loading="lazy" />
                  ) : (
                    <span>{it.state === "failed" ? "Failed" : "Processing…"}</span>
                  )}
                </button>
                <div className="cap">
                  {it.used_publicly ? "● Live · " : Number(it.usage_count) ? "Draft · " : ""}
                  {it.default_alt || it.original_name || "No description"}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <aside className="editor-side">
        <section className="s-panel" style={{ marginTop: 0 }} aria-live="polite">
          {sel ? (
            <div className="form-grid" style={{ gap: 12 }}>
              <h2 style={{ margin: 0 }}>Photo details</h2>
              {sel.state === "ready" ? (
                <div
                  style={{ position: "relative", cursor: "crosshair", borderRadius: 10, overflow: "hidden" }}
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setForm((f) => ({ ...f, focalX: Math.round(((e.clientX - r.left) / r.width) * 100) / 100, focalY: Math.round(((e.clientY - r.top) / r.height) * 100) / 100 }));
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbUrl(sel.id)} alt="" style={{ width: "100%" }} />
                  <span aria-hidden="true" style={{ position: "absolute", left: `${form.focalX * 100}%`, top: `${form.focalY * 100}%`, width: 16, height: 16, margin: -8, borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 0 0 2px var(--cherry)" }} />
                </div>
              ) : (
                <p className="alert alert-error">{sel.error ?? "Not processed yet."}</p>
              )}
              <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
                {sel.width && sel.height ? `${sel.width} × ${sel.height}px · ` : ""}tap the photo to set the focus point
              </p>
              <div className="field">
                <label htmlFor="d-alt">Default description (alt text)</label>
                <input id="d-alt" value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="d-cap">Default caption</label>
                <input id="d-cap" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="d-credit">Photo credit</label>
                <input id="d-credit" value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} />
              </div>
              <div className="row">
                <button type="button" className="btn btn-small" onClick={save}>
                  Save details
                </button>
                {sel.state === "failed" ? (
                  <button type="button" className="btn btn-secondary btn-small" onClick={retry}>
                    Retry processing
                  </button>
                ) : null}
              </div>
              <div>
                <h3 style={{ marginBottom: 6 }}>Used in</h3>
                {usage.length ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {usage.map((u, i) => (
                      <li key={i}>
                        {u.owner_kind === "entry" ? (
                          <a href={`/dashboard/entries/${u.owner_id}`}>
                            {u.title} ({u.type ? TYPE_LABEL[u.type] : "entry"})
                          </a>
                        ) : u.owner_kind === "settings" ? (
                          "Homepage"
                        ) : (
                          "Profile"
                        )}{" "}
                        <span className="muted">{u.in_published ? "· live" : u.in_draft ? "· draft" : ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>Not used anywhere.</p>
                )}
              </div>
              <button type="button" className="btn btn-quiet btn-small" style={{ color: "var(--danger)" }} onClick={remove} disabled={usage.length > 0} aria-describedby="del-hint">
                Delete permanently
              </button>
              <span id="del-hint" className="hint">
                {usage.length ? "Remove it from everything that uses it first — this protects published pages." : `Uploaded ${formatDateTime(sel.created_at)}`}
              </span>
              {msg ? <p className="alert alert-success" style={{ margin: 0 }}>{msg}</p> : null}
              {err ? (
                <p className="alert alert-error" role="alert" style={{ margin: 0 }}>
                  {err}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Choose a photo to edit its description, credit and focus point, or to see where it’s used.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
