"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Experience, Profile } from "@/lib/site";
import { SinglePhoto } from "./editor/Placements";

type Exp = Omit<Experience, "id"> & { id: string | null };

const KINDS: { value: Exp["kind"]; label: string }[] = [
  { value: "interest", label: "Where it started" },
  { value: "training", label: "Professional training" },
  { value: "internship", label: "Internship" },
  { value: "next", label: "Next chapter" },
  { value: "other", label: "Other experience" },
];

export function ProfileForm({ initial, experiences }: { initial: Profile; experiences: Experience[] }) {
  const [p, setP] = useState(initial);
  const [ex, setEx] = useState<Exp[]>(experiences);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const setX = (i: number, patch: Partial<Exp>) => setEx((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setEx((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const n = [...xs];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const save = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await api("/api/site", { method: "PUT", body: { section: "profile", data: p } });
      await api("/api/site", { method: "PUT", body: { section: "experiences", data: ex } });
      setMsg("Saved.");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn’t save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-grid" style={{ gap: 16 }}>
      <section className="s-panel" style={{ marginTop: 0 }}>
        <h2>Public profile</h2>
        <p className="hint">Never include a home address, school, exact birthday, routine places or a personal phone number.</p>
        <div className="form-grid">
          <div className="form-grid two">
            <div className="field">
              <label htmlFor="pn">Public name</label>
              <input id="pn" value={p.publicName} maxLength={60} onChange={(e) => set({ publicName: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="loc">City (optional)</label>
              <input id="loc" value={p.location} maxLength={60} onChange={(e) => set({ location: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="age">Age line (optional, shown once on About)</label>
            <input id="age" value={p.ageLine} maxLength={60} placeholder="e.g. I’m 16 and…" onChange={(e) => set({ ageLine: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="sb">Short bio (homepage, 100–150 words works well)</label>
            <textarea id="sb" rows={4} value={p.shortBio} maxLength={600} onChange={(e) => set({ shortBio: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="fb">Full bio (About page; blank line between paragraphs)</label>
            <textarea id="fb" rows={8} value={p.fullBio} maxLength={4000} onChange={(e) => set({ fullBio: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cl">Currently learning (optional)</label>
            <input id="cl" value={p.currentLearning} maxLength={200} onChange={(e) => set({ currentLearning: e.target.value })} />
          </div>
          <SinglePhoto value={p.portrait} onChange={(portrait) => set({ portrait })} label="Portrait or hands-at-work photo (optional, approved)" idPrefix="portrait" />
        </div>
      </section>

      <section className="s-panel">
        <h2>In my own words (optional)</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="a1">What first drew you to baking?</label>
            <textarea id="a1" rows={3} value={p.answers.drewMe} onChange={(e) => set({ answers: { ...p.answers, drewMe: e.target.value } })} />
          </div>
          <div className="field">
            <label htmlFor="a2">Which part of the process do you enjoy?</label>
            <textarea id="a2" rows={3} value={p.answers.enjoy} onChange={(e) => set({ answers: { ...p.answers, enjoy: e.target.value } })} />
          </div>
          <div className="field">
            <label htmlFor="a3">What would you love to learn next?</label>
            <textarea id="a3" rows={3} value={p.answers.learnNext} onChange={(e) => set({ answers: { ...p.answers, learnNext: e.target.value } })} />
          </div>
        </div>
      </section>

      <section className="s-panel">
        <h2>Learning journey</h2>
        <p className="hint">Only tick “Show publicly” once the course name, company, dates and details are confirmed. Unconfirmed entries stay private.</p>
        {ex.map((x, i) => (
          <div className="block" key={x.id ?? `new-${i}`}>
            <div className="block-head">
              <span className="kind">
                {i + 1}. {KINDS.find((k) => k.value === x.kind)?.label}
              </span>
              <button type="button" className="tool-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${x.title || "entry"} up`}>
                ↑
              </button>
              <button type="button" className="tool-btn" disabled={i === ex.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${x.title || "entry"} down`}>
                ↓
              </button>
              <button type="button" className="tool-btn danger" onClick={() => window.confirm("Remove this journey entry?") && setEx((xs) => xs.filter((_, k) => k !== i))}>
                Remove
              </button>
            </div>
            <div className="form-grid two">
              <div className="field">
                <label htmlFor={`k-${i}`}>Kind</label>
                <select id={`k-${i}`} value={x.kind} onChange={(e) => setX(i, { kind: e.target.value as Exp["kind"] })}>
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`t-${i}`}>Title</label>
                <input id={`t-${i}`} value={x.title} maxLength={160} placeholder="e.g. Professional baking training" onChange={(e) => setX(i, { title: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`o-${i}`}>Institution / company</label>
                <input id={`o-${i}`} value={x.organisation ?? ""} maxLength={160} onChange={(e) => setX(i, { organisation: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`r-${i}`}>Course / role</label>
                <input id={`r-${i}`} value={x.role ?? ""} maxLength={160} onChange={(e) => setX(i, { role: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`pe-${i}`}>Period (only if confirmed)</label>
                <input id={`pe-${i}`} value={x.period ?? ""} maxLength={80} placeholder="e.g. Summer 2026" onChange={(e) => setX(i, { period: e.target.value })} />
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor={`d-${i}`}>Description</label>
              <textarea id={`d-${i}`} rows={3} value={x.description ?? ""} maxLength={1500} onChange={(e) => setX(i, { description: e.target.value })} />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor={`dt-${i}`}>Subjects, responsibilities or things learnt (one per line)</label>
              <textarea id={`dt-${i}`} rows={3} value={x.details.join("\n")} onChange={(e) => setX(i, { details: e.target.value.split("\n") })} />
            </div>
            <label className="check">
              <input type="checkbox" checked={x.is_public} onChange={(e) => setX(i, { is_public: e.target.checked })} />
              <span>
                <strong>Show publicly</strong> — these details are verified
              </span>
            </label>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary btn-small"
          style={{ marginTop: 12 }}
          onClick={() => setEx((xs) => [...xs, { id: null, kind: "training", title: "", organisation: "", role: "", period: "", description: "", details: [], is_public: false, display_order: xs.length }])}
        >
          + Add journey entry
        </button>
      </section>

      <div className="editor-bar">
        <span className="save-state" role="status" aria-live="polite">
          {err ? <span className="error-text">{err}</span> : msg}
        </span>
        <button type="button" className="btn btn-small" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}
