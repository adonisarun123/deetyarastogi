"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, newRequestId } from "@/lib/client/api";
import { type EntryContent, type EntryState, type EntryType, CONTEXT_LABEL, CONTRIBUTION_LABEL, TYPE_LABEL, emptyRecipe, entryPath } from "@/lib/content/types";
import { formatDateTime, formatTime, slugify } from "@/lib/text";
import type { Problem } from "@/lib/content/validate";
import { BlockEditor } from "./BlockEditor";
import { PhotoList, SinglePhoto } from "./Placements";
import { RecipeEditor } from "./RecipeEditor";
import { VideoField } from "./VideoField";
import { RelatedPicker, Revisions, TaxonomyFields, type TermLite } from "./Sidebar";

type SaveStatus = "saved" | "dirty" | "saving" | "error" | "offline" | "conflict";

export interface EditorEntry {
  id: string;
  type: EntryType;
  slug: string;
  state: EntryState;
  working_version: number;
  has_unpublished_changes: boolean;
  first_published_at: string | null;
  last_published_at: string | null;
  updated_at: string;
  published: boolean;
}

const AUTOSAVE_MS = 3000;
const backupKey = (id: string) => `scrapbook-draft-backup:${id}`;

export function Editor({ entry: initialEntry, content: initial, terms: initialTerms }: { entry: EditorEntry; content: EntryContent; terms: TermLite[] }) {
  const [entry, setEntry] = useState(initialEntry);
  const [c, setC] = useState<EntryContent>(initial);
  const [terms, setTerms] = useState(initialTerms);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [savedAt, setSavedAt] = useState<string>(initialEntry.updated_at);
  const [saveError, setSaveError] = useState("");
  const [online, setOnline] = useState(true);
  const [conflict, setConflict] = useState<{ serverContent: EntryContent; serverVersion: number; serverUpdatedAt: string } | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState("");
  const [backup, setBackup] = useState<{ content: EntryContent; at: string } | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug) && !initial.slug.startsWith("draft-"));

  const version = useRef(initialEntry.working_version);
  const contentRef = useRef(c);
  const lastSaved = useRef(JSON.stringify(initial));
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishRequestId = useRef(newRequestId());
  const publishDlg = useRef<HTMLDialogElement>(null);
  const conflictDlg = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    contentRef.current = c;
  }, [c]);

  // Offer to restore a local backup from an interrupted session (same base version, different content).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(backupKey(entry.id));
      if (!raw) return;
      const b = JSON.parse(raw);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (b.version === initialEntry.working_version && JSON.stringify(b.content) !== lastSaved.current) setBackup({ content: b.content, at: b.at });
      else localStorage.removeItem(backupKey(entry.id));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSave = useCallback(async (opts: { force?: boolean } = {}): Promise<boolean> => {
    if (inFlight.current) await inFlight.current;
    const snapshot = contentRef.current;
    const body = JSON.stringify(snapshot);
    if (!opts.force && body === lastSaved.current) {
      setStatus("saved");
      return true;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return false;
    }
    setStatus("saving");
    const p = (async () => {
      try {
        const r = await api<{ version: number; savedAt: string }>(`/api/entries/${entry.id}`, {
          method: "PUT",
          body: { content: snapshot, version: version.current, snapshot: Boolean(opts.force) },
        });
        version.current = r.version;
        lastSaved.current = body;
        setSavedAt(r.savedAt);
        setSaveError("");
        setEntry((e) => ({ ...e, working_version: r.version, has_unpublished_changes: true }));
        const stillSame = JSON.stringify(contentRef.current) === body;
        setStatus(stillSame ? "saved" : "dirty");
        if (stillSame) {
          try {
            localStorage.removeItem(backupKey(entry.id));
          } catch {}
        }
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409 && e.data.conflict) {
          setConflict({
            serverContent: e.data.serverContent as EntryContent,
            serverVersion: Number(e.data.serverVersion),
            serverUpdatedAt: String(e.data.serverUpdatedAt),
          });
          setStatus("conflict");
        } else if (e instanceof ApiError && e.status === 0) {
          setStatus("offline");
          setSaveError(e.message);
        } else {
          setStatus("error");
          setSaveError(e instanceof ApiError ? e.message : "Save failed.");
        }
        return false;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = p;
    return p;
  }, [entry.id]);

  // Change → local backup immediately, server autosave after 3s of inactivity (E02).
  const update = (patch: Partial<EntryContent>) => {
    setC((prev) => {
      const next = { ...prev, ...patch };
      if (!slugTouched && patch.title !== undefined && !entry.published) next.slug = slugify(patch.title);
      try {
        localStorage.setItem(backupKey(entry.id), JSON.stringify({ version: version.current, content: next, at: new Date().toISOString() }));
      } catch {}
      return next;
    });
    if (status !== "conflict") setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (navigator.onLine) doSave();
    }, AUTOSAVE_MS);
  };

  useEffect(() => {
    const on = () => {
      setOnline(true);
      doSave();
    };
    const off = () => {
      setOnline(false);
      setStatus((s) => (s === "saved" ? s : "offline"));
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(contentRef.current) !== lastSaved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [doSave]);

  useEffect(() => {
    const d = conflictDlg.current;
    if (conflict && d && !d.open) d.showModal();
    if (!conflict && d?.open) d.close();
  }, [conflict]);

  useEffect(() => {
    const d = publishDlg.current;
    if (publishOpen && d && !d.open) d.showModal();
    if (!publishOpen && d?.open) d.close();
  }, [publishOpen]);

  const badSet = useMemo(() => new Set(problems.map((p) => p.field)), [problems]);
  const bad = (f: string) => badSet.has(f) || [...badSet].some((b) => b.startsWith(f + "."));

  const focusField = (field: string) => {
    setPublishOpen(false);
    const ids = [field, `f-${field}`, field.split(".").slice(0, 2).join(".")];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: "center" });
        (el.matches("input,select,textarea,button") ? el : el.querySelector<HTMLElement>("input,select,textarea,button"))?.focus();
        return;
      }
    }
  };

  const openPublish = async () => {
    setPublishMsg("");
    const ok = await doSave();
    if (!ok) return;
    try {
      const r = await api<{ problems: Problem[] }>(`/api/entries/${entry.id}?view=check`);
      setProblems(r.problems);
      setPublishOpen(true);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Couldn’t check the entry.");
    }
  };

  const publish = async () => {
    setPublishing(true);
    setPublishMsg("");
    try {
      const r = await api<{ path: string }>(`/api/entries/${entry.id}`, {
        body: { action: "publish", version: version.current, requestId: publishRequestId.current },
      });
      publishRequestId.current = newRequestId();
      setEntry((e) => ({
        ...e,
        state: "published",
        published: true,
        has_unpublished_changes: false,
        slug: r.path.split("/").pop()!,
        first_published_at: e.first_published_at ?? new Date().toISOString(),
        last_published_at: new Date().toISOString(),
      }));
      setC((prev) => ({ ...prev, slug: r.path.split("/").pop()! }));
      lastSaved.current = JSON.stringify({ ...contentRef.current, slug: r.path.split("/").pop()! });
      setProblems([]);
      setPublishMsg(`Live at ${r.path}`);
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.data.problems)) setProblems(e.data.problems as Problem[]);
      setPublishMsg(e instanceof ApiError ? e.message : "Publishing failed. The previous live version is unchanged.");
    } finally {
      setPublishing(false);
    }
  };

  const simpleAction = async (action: "unpublish" | "trash" | "duplicate", confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    await doSave();
    try {
      const r = await api<{ id?: string }>(`/api/entries/${entry.id}`, { body: { action } });
      if (action === "duplicate" && r.id) window.location.href = `/dashboard/entries/${r.id}`;
      else if (action === "trash") window.location.href = "/dashboard/entries?state=trashed";
      else setEntry((e) => ({ ...e, state: "unpublished", published: false, has_unpublished_changes: true }));
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "That didn’t work.");
    }
  };

  const previewLink = async () => {
    try {
      const r = await api<{ url: string; hours: number }>(`/api/entries/${entry.id}`, { body: { action: "preview-link", hours: 48 } });
      const full = `${window.location.origin}${r.url}`;
      await navigator.clipboard.writeText(full).catch(() => window.prompt("Private preview link (expires in 48 hours):", full));
      setPublishMsg("Private preview link copied — it expires in 48 hours.");
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Couldn’t create a link.");
    }
  };

  const t = entry.type;
  const isPublished = entry.state === "published";

  return (
    <>
      {!online ? (
        <div className="offline-banner" role="alert">
          You’re offline. Keep writing — everything stays on this page and will save when you reconnect.
        </div>
      ) : null}
      {backup ? (
        <div className="alert alert-info" role="status" style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px" }}>
            This device has unsaved changes from {formatDateTime(backup.at)} that never reached the server.
          </p>
          <div className="row">
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                setC(backup.content);
                contentRef.current = backup.content;
                setBackup(null);
                setStatus("dirty");
                doSave();
              }}
            >
              Restore those changes
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-small"
              onClick={() => {
                localStorage.removeItem(backupKey(entry.id));
                setBackup(null);
              }}
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}

      <div className="spread" style={{ marginBottom: 8 }}>
        <p className="muted" style={{ margin: 0 }}>
          <Link href="/dashboard/entries">Entries</Link> / {TYPE_LABEL[t]}
        </p>
        <span className="row" style={{ gap: 6 }}>
          <span className={`state state-${entry.state}`}>{entry.state === "published" ? "Published" : entry.state === "unpublished" ? "Unpublished" : entry.state === "trashed" ? "In trash" : "Draft"}</span>
          {isPublished && entry.has_unpublished_changes && JSON.stringify(c) !== "" ? <span className="state state-changes">Changes not live yet</span> : null}
        </span>
      </div>

      <div className="editor-layout">
        <div>
          <div className="field">
            <label htmlFor="title" className="sr-only">
              Title
            </label>
            <input
              id="title"
              className="editor-title"
              value={c.title}
              maxLength={200}
              placeholder={t === "recipe" ? "Name of the dish" : "Title"}
              onChange={(e) => update({ title: e.target.value })}
              aria-invalid={bad("title") || undefined}
            />
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="summary">{t === "video" ? "Description / summary" : "Short summary"}</label>
            <textarea id="summary" rows={2} value={c.summary} maxLength={600} onChange={(e) => update({ summary: e.target.value })} aria-invalid={bad("summary") || undefined} aria-describedby="summary-hint" />
            <span id="summary-hint" className="hint">
              One or two sentences shown on cards and in search results. {c.summary.length}/600
            </span>
          </div>

          <div style={{ marginTop: 24, display: "grid", gap: 20 }}>
            {t === "story" ? (
              <section className="s-panel" style={{ marginTop: 0 }}>
                <h2>Photos</h2>
                <PhotoList
                  value={c.gallery}
                  onChange={(gallery) => update({ gallery, cover: c.cover && gallery.some((g) => g.assetId === c.cover!.assetId) ? c.cover : (gallery[0] ?? null) })}
                  label="Story photos (the first or chosen cover leads the page)"
                  idPrefix="gallery"
                  coverId={c.cover?.assetId ?? c.gallery[0]?.assetId}
                  onSetCover={(p) => update({ cover: p })}
                  invalid={bad("gallery") || bad("media.alt")}
                />
              </section>
            ) : null}

            {t === "video" ? (
              <section className="s-panel" style={{ marginTop: 0 }}>
                <h2>The video</h2>
                <VideoField value={c.video} onChange={(video) => update({ video, cover: video?.cover ?? c.cover })} idPrefix="video" full invalid={bad("video")} />
              </section>
            ) : null}

            {t !== "story" ? (
              <section className="s-panel" style={{ marginTop: 0 }}>
                <SinglePhoto
                  value={t === "video" ? (c.video?.cover ?? c.cover) : c.cover}
                  onChange={(cover) => (t === "video" && c.video ? update({ cover, video: { ...c.video, cover } }) : update({ cover }))}
                  label={t === "recipe" ? "Cover photo of the finished bake" : t === "video" ? "Cover image" : "Cover photo (optional)"}
                  idPrefix="cover"
                  hint={t === "tip" || t === "journal" ? "Optional — tips and articles without photos get an honest text card." : undefined}
                  invalid={bad("cover") || bad("media.alt")}
                />
              </section>
            ) : null}

            {t === "recipe" ? <RecipeEditor value={c.recipe ?? emptyRecipe()} onChange={(recipe) => update({ recipe })} bad={bad} /> : null}

            <section className="s-panel" style={{ marginTop: 0 }}>
              <h2>{t === "recipe" ? "Introduction & story (optional)" : t === "tip" ? "The tip" : t === "video" ? "Extra notes (optional)" : "Write"}</h2>
              <BlockEditor blocks={c.blocks} onChange={(blocks) => update({ blocks })} invalid={bad("blocks")} />
            </section>

            {t === "story" ? (
              <section className="s-panel" style={{ marginTop: 0 }}>
                <h2>Context</h2>
                <div className="form-grid two">
                  <div className="field">
                    <label htmlFor="context">Where was this made?</label>
                    <select id="context" value={c.context} onChange={(e) => update({ context: e.target.value as EntryContent["context"] })}>
                      <option value="">Not specified</option>
                      {Object.entries(CONTEXT_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="contribution">My part in it</label>
                    <select id="contribution" value={c.contribution} onChange={(e) => update({ contribution: e.target.value as EntryContent["contribution"] })}>
                      <option value="">Not specified</option>
                      {Object.entries(CONTRIBUTION_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>
            ) : null}

            {t === "story" || t === "journal" ? (
              <section className="s-panel" style={{ marginTop: 0 }}>
                <div className="field">
                  <label htmlFor="learning">What I learnt (optional)</label>
                  <textarea id="learning" rows={3} value={c.learningNote} maxLength={3000} onChange={(e) => update({ learningNote: e.target.value })} />
                </div>
              </section>
            ) : null}

            <section className="s-panel" style={{ marginTop: 0 }}>
              <div className="field">
                <label htmlFor="attribution">Credits & attribution (optional)</label>
                <input id="attribution" value={c.attribution} maxLength={400} placeholder="e.g. Decorated with help from Chef …, photos by …" onChange={(e) => update({ attribution: e.target.value })} />
              </div>
            </section>
          </div>
        </div>

        <aside className="editor-side" aria-label="Entry settings">
          <section className="s-panel" style={{ marginTop: 0 }}>
            <h2>Organise</h2>
            <TaxonomyFields content={c} set={update} terms={terms} setTerms={setTerms} bad={bad} />
          </section>
          <section className="s-panel">
            <h2>Link & search</h2>
            <div className="form-grid" style={{ gap: 12 }}>
              <div className="field">
                <label htmlFor="slug">Web address</label>
                <input
                  id="slug"
                  value={c.slug}
                  maxLength={80}
                  onChange={(e) => {
                    setSlugTouched(true);
                    update({ slug: slugify(e.target.value) || "" });
                  }}
                />
                <span className="hint">
                  {entryPath(t, c.slug || "…")}
                  {isPublished ? " · Changing it keeps the old link working (redirect)." : ""}
                </span>
              </div>
              <div className="field">
                <label htmlFor="seoTitle">Search title (optional)</label>
                <input id="seoTitle" value={c.seoTitle} maxLength={120} onChange={(e) => update({ seoTitle: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="seoDescription">Search description (optional)</label>
                <textarea id="seoDescription" rows={2} value={c.seoDescription} maxLength={300} onChange={(e) => update({ seoDescription: e.target.value })} />
              </div>
            </div>
          </section>
          <section className="s-panel">
            <h2>Related</h2>
            <RelatedPicker selfId={entry.id} ids={c.relatedIds} onChange={(relatedIds) => update({ relatedIds })} />
          </section>
          <section className="s-panel">
            <h2>More</h2>
            <div className="form-grid" style={{ gap: 10 }}>
              {entry.first_published_at ? (
                <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                  First published {formatDateTime(entry.first_published_at)}
                  {entry.last_published_at ? ` · last updated ${formatDateTime(entry.last_published_at)}` : ""}
                </p>
              ) : null}
              <Revisions entryId={entry.id} onRestored={() => window.location.reload()} />
              <button type="button" className="btn btn-quiet btn-small" onClick={previewLink}>
                Copy private preview link
              </button>
              <button type="button" className="btn btn-quiet btn-small" onClick={() => simpleAction("duplicate", "Make a copy of this entry as a new draft?")}>
                Duplicate as draft
              </button>
              {isPublished ? (
                <button type="button" className="btn btn-quiet btn-small" onClick={() => simpleAction("unpublish", "Unpublish? It disappears from the site, search and sitemap within a minute. Your draft stays here.")}>
                  Unpublish
                </button>
              ) : null}
              <button type="button" className="btn btn-quiet btn-small" style={{ color: "var(--danger)" }} onClick={() => simpleAction("trash", "Move to trash? You can restore it for 30 days.")}>
                Move to trash
              </button>
            </div>
          </section>
        </aside>
      </div>

      <div className="editor-bar">
        <span className="save-state" role="status" aria-live="polite">
          <span className="save-dot" data-s={status} aria-hidden="true" />
          {status === "saved" && `Saved ${formatTime(savedAt)}`}
          {status === "dirty" && "Unsaved changes…"}
          {status === "saving" && "Saving…"}
          {status === "error" && `Save failed — ${saveError || "please retry"}`}
          {status === "offline" && "Offline — not saved yet"}
          {status === "conflict" && "Changed in another window"}
        </span>
        <button type="button" className="btn btn-quiet btn-small" onClick={() => doSave({ force: status === "error" })} disabled={status === "saving"}>
          Save draft
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={async () => {
            await doSave();
            window.open(`/dashboard/entries/${entry.id}/preview`, "_blank", "noopener");
          }}
        >
          Preview
        </button>
        <button type="button" className="btn btn-small" onClick={openPublish} disabled={status === "conflict" || entry.state === "trashed"}>
          {isPublished ? "Update published entry" : "Publish…"}
        </button>
      </div>
      {publishMsg && !publishOpen ? (
        <p className="alert alert-success" role="status" style={{ marginTop: 12 }}>
          {publishMsg}
        </p>
      ) : null}

      {/* Publish review (E05) */}
      <dialog ref={publishDlg} className="s-dialog" style={{ width: "min(620px, 96vw)" }} onClose={() => setPublishOpen(false)} aria-labelledby="pub-title">
        <div className="dlg-head">
          <h2 id="pub-title">{problems.length ? "A few things first" : isPublished ? "Update the live entry?" : "Ready to publish?"}</h2>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => setPublishOpen(false)}>
            Close
          </button>
        </div>
        <div className="dlg-body">
          {problems.length ? (
            <>
              <p>These need attention before it can go live. Your draft is safe.</p>
              <ul className="problems">
                {problems.map((p, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => focusField(p.field)}>
                      {p.message}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <dl className="facts" style={{ marginBottom: 16 }}>
                <div>
                  <dt>Type</dt>
                  <dd>{TYPE_LABEL[t]}</dd>
                </div>
                <div>
                  <dt>Photos</dt>
                  <dd>{[c.cover, ...c.gallery].filter(Boolean).length}</dd>
                </div>
                {c.video || c.recipe?.video ? (
                  <div>
                    <dt>Video</dt>
                    <dd>Yes</dd>
                  </div>
                ) : null}
              </dl>
              <p style={{ margin: "0 0 6px" }}>
                <strong>{c.title}</strong>
              </p>
              <p className="muted" style={{ marginTop: 0 }}>
                Will be live at <span className="kbd">{entryPath(t, c.slug || slugify(c.title))}</span>
              </p>
              {isPublished ? <p>The current live version stays up until you press the button below.</p> : <p>It will appear on the homepage, in the scrapbook, in search and in the sitemap.</p>}
            </>
          )}
          {publishMsg ? (
            <p className={`alert ${publishMsg.startsWith("Live") ? "alert-success" : "alert-error"}`} role="status">
              {publishMsg}{" "}
              {publishMsg.startsWith("Live") ? (
                <a href={entryPath(t, entry.slug)} target="_blank" rel="noopener">
                  Open it
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
        {!problems.length && !publishMsg.startsWith("Live") ? (
          <div className="editor-bar" style={{ margin: 0, position: "sticky" }}>
            <span className="save-state" />
            <button type="button" className="btn" onClick={publish} disabled={publishing}>
              {publishing ? "Publishing…" : isPublished ? "Update published entry" : "Publish now"}
            </button>
          </div>
        ) : null}
      </dialog>

      {/* Conflict (E03): both versions are preserved. */}
      <dialog ref={conflictDlg} className="s-dialog" style={{ width: "min(620px, 96vw)" }} aria-labelledby="conf-title" onCancel={(e) => e.preventDefault()}>
        <div className="dlg-head">
          <h2 id="conf-title">This draft changed somewhere else</h2>
        </div>
        <div className="dlg-body">
          <p>
            Another window or device saved this draft at {conflict ? formatDateTime(conflict.serverUpdatedAt) : ""}. Nothing has been overwritten. Choose which version to keep
            working on — the other one is kept in version history.
          </p>
          <p className="muted">
            Other version’s title: “{conflict?.serverContent?.title || "Untitled"}” · Your title: “{c.title || "Untitled"}”
          </p>
          <div className="row" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                if (!conflict) return;
                // Keep mine: save on top of the newer version. The server snapshots theirs first.
                version.current = conflict.serverVersion;
                setConflict(null);
                await doSave({ force: true });
              }}
            >
              Keep my version
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                if (!conflict) return;
                // Keep theirs: my version goes into a duplicate draft so neither is lost.
                const mine = contentRef.current;
                try {
                  const dup = await api<{ id: string }>("/api/entries", { body: { type: entry.type } });
                  const fresh = await api<{ entry: { working_version: number } }>(`/api/entries/${dup.id}`);
                  await api(`/api/entries/${dup.id}`, { method: "PUT", body: { content: { ...mine, title: `${mine.title || "Untitled"} (my other version)`, slug: "" }, version: fresh.entry.working_version } });
                } catch {}
                version.current = conflict.serverVersion;
                setC(conflict.serverContent);
                contentRef.current = conflict.serverContent;
                lastSaved.current = JSON.stringify(conflict.serverContent);
                setConflict(null);
                setStatus("saved");
              }}
            >
              Use the other version (save mine as a copy)
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
