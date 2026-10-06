"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { SiteSettings } from "@/lib/site";
import { TYPE_LABEL, type EntryType } from "@/lib/content/types";
import { SinglePhoto } from "./editor/Placements";

interface Pub {
  id: string;
  type: EntryType;
  title: string;
}

export function HomeSettingsForm({ initial, isOwner }: { initial: SiteSettings; isOwner: boolean }) {
  const [s, setS] = useState(initial);
  const [pub, setPub] = useState<Pub[]>([]);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<SiteSettings>) => setS((x) => ({ ...x, ...p }));

  useEffect(() => {
    api<{ items: Pub[] }>("/api/entries?state=published")
      .then((r) => setPub(r.items))
      .catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    setErr("");
    setStatus("");
    try {
      const r = await api<{ data: SiteSettings }>("/api/site", { method: "PUT", body: { section: "settings", data: s } });
      setS(r.data);
      setStatus("Saved — the homepage is updated.");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn’t save.");
    } finally {
      setBusy(false);
    }
  };

  const moveFeat = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= s.featuredIds.length) return;
    const n = [...s.featuredIds];
    [n[i], n[j]] = [n[j], n[i]];
    set({ featuredIds: n });
  };
  const title = (id: string) => pub.find((p) => p.id === id)?.title ?? "Published entry";

  return (
    <div className="form-grid" style={{ gap: 16 }}>
      <section className="s-panel" style={{ marginTop: 0 }}>
        <h2>Hero</h2>
        <div className="form-grid">
          <div className="form-grid two">
            <div className="field">
              <label htmlFor="brand">Site name (wordmark)</label>
              <input id="brand" value={s.brandName} maxLength={60} onChange={(e) => set({ brandName: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="eyebrow">Small line above the headline</label>
              <input id="eyebrow" value={s.eyebrow} maxLength={80} onChange={(e) => set({ eyebrow: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="headline">Headline</label>
            <input id="headline" value={s.headline} maxLength={120} onChange={(e) => set({ headline: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="intro">Introduction</label>
            <textarea id="intro" rows={3} value={s.intro} maxLength={400} onChange={(e) => set({ intro: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="support">Supporting line (separate items with •)</label>
            <input id="support" value={s.supportingLine} maxLength={160} onChange={(e) => set({ supportingLine: e.target.value })} />
            <span className="hint">Only list training and internship facts that have been confirmed.</span>
          </div>
          <SinglePhoto value={s.hero} onChange={(hero) => set({ hero })} label="Hero photo (one of her bakes)" idPrefix="hero" hint="Portrait (4:5) photos work best. Without one, a simple illustration is shown." />
          <SinglePhoto value={s.heroProcess} onChange={(heroProcess) => set({ heroProcess })} label="Small process photo (optional, desktop only)" idPrefix="hero-process" />
          <div className="field" style={{ maxWidth: 320 }}>
            <label htmlFor="annot">Handwritten note on the photo (optional)</label>
            <input id="annot" value={s.heroAnnotation} maxLength={40} onChange={(e) => set({ heroAnnotation: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="s-panel">
        <h2>Featured on the homepage</h2>
        <p className="hint">Choose 3–6 published entries. If one is unpublished later, it simply drops out — no empty card.</p>
        <ol style={{ paddingLeft: 20 }}>
          {s.featuredIds.map((id, i) => (
            <li key={id} style={{ marginBottom: 6 }}>
              <span className="row" style={{ gap: 6 }}>
                <strong>{title(id)}</strong>
                <button type="button" className="tool-btn" disabled={i === 0} onClick={() => moveFeat(i, -1)} aria-label={`Move ${title(id)} up`}>
                  ↑
                </button>
                <button type="button" className="tool-btn" disabled={i === s.featuredIds.length - 1} onClick={() => moveFeat(i, 1)} aria-label={`Move ${title(id)} down`}>
                  ↓
                </button>
                <button type="button" className="tool-btn danger" onClick={() => set({ featuredIds: s.featuredIds.filter((x) => x !== id) })}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ol>
        {s.featuredIds.length < 6 ? (
          <div className="field" style={{ maxWidth: 480 }}>
            <label htmlFor="add-feat">Add an entry</label>
            <select
              id="add-feat"
              value=""
              onChange={(e) => e.target.value && set({ featuredIds: [...s.featuredIds, e.target.value] })}
            >
              <option value="">Choose a published entry…</option>
              {pub
                .filter((p) => !s.featuredIds.includes(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({TYPE_LABEL[p.type]})
                  </option>
                ))}
            </select>
          </div>
        ) : null}
      </section>

      <section className="s-panel">
        <h2>Contact & footer</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="cintro">Contact introduction</label>
            <textarea id="cintro" rows={2} value={s.contactIntro} maxLength={300} onChange={(e) => set({ contactIntro: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cman">Who reads messages (shown beside the form)</label>
            <textarea id="cman" rows={2} value={s.contactManagedBy} maxLength={300} onChange={(e) => set({ contactManagedBy: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="alt-email">Backup email shown only if the form fails (optional, parent-managed)</label>
            <input id="alt-email" type="email" value={s.alternativeEmail} onChange={(e) => set({ alternativeEmail: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="footer">Footer line</label>
            <input id="footer" value={s.footerLine} maxLength={120} onChange={(e) => set({ footerLine: e.target.value })} />
          </div>
          <fieldset>
            <legend>Approved social links</legend>
            {s.socialLinks.map((l, i) => (
              <div className="row" key={i} style={{ marginTop: 8, alignItems: "flex-end" }}>
                <div className="field" style={{ width: 160 }}>
                  <label htmlFor={`sl-l-${i}`}>Label</label>
                  <input id={`sl-l-${i}`} value={l.label} onChange={(e) => set({ socialLinks: s.socialLinks.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
                </div>
                <div className="field" style={{ flex: "1 1 240px" }}>
                  <label htmlFor={`sl-u-${i}`}>Link (https://)</label>
                  <input id={`sl-u-${i}`} type="url" value={l.url} onChange={(e) => set({ socialLinks: s.socialLinks.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)) })} />
                </div>
                <button type="button" className="tool-btn danger" onClick={() => set({ socialLinks: s.socialLinks.filter((_, k) => k !== i) })}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="tool-btn" style={{ marginTop: 8 }} onClick={() => set({ socialLinks: [...s.socialLinks, { label: "YouTube", url: "https://" }] })}>
              + Add link
            </button>
          </fieldset>
        </div>
      </section>

      <section className="s-panel">
        <h2>A note for you (gift message)</h2>
        <label className="check">
          <input type="checkbox" checked={s.giftNote.enabled} onChange={(e) => set({ giftNote: { ...s.giftNote, enabled: e.target.checked } })} />
          <span>Show the “A note for you” reveal near the footer</span>
        </label>
        <div className="form-grid two" style={{ marginTop: 8 }}>
          <div className="field">
            <label htmlFor="gift-text">Message</label>
            <textarea id="gift-text" rows={3} value={s.giftNote.text} maxLength={600} onChange={(e) => set({ giftNote: { ...s.giftNote, text: e.target.value } })} />
          </div>
          <div className="field">
            <label htmlFor="gift-from">From (optional)</label>
            <input id="gift-from" value={s.giftNote.from} maxLength={80} onChange={(e) => set({ giftNote: { ...s.giftNote, from: e.target.value } })} />
          </div>
        </div>
      </section>

      {isOwner ? (
        <section className="s-panel">
          <h2>Domain</h2>
          <div className="field">
            <label htmlFor="site-url">Public site address (used in sitemaps, share links and structured data)</label>
            <input id="site-url" type="url" placeholder="https://deetyabakes.com" value={s.siteUrl} onChange={(e) => set({ siteUrl: e.target.value })} />
          </div>
        </section>
      ) : null}

      <div className="editor-bar">
        <span className="save-state" role="status" aria-live="polite">
          {err ? <span className="error-text">{err}</span> : status}
        </span>
        <button type="button" className="btn btn-small" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save homepage"}
        </button>
      </div>
    </div>
  );
}
