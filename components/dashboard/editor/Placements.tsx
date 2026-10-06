"use client";

import { useState } from "react";
import type { MediaPlacement } from "@/lib/content/types";
import { MediaPicker, thumbUrl } from "../MediaPicker";

const FOCUS: { label: string; x: number; y: number }[] = [
  { label: "Centre", x: 0.5, y: 0.5 },
  { label: "Top", x: 0.5, y: 0.2 },
  { label: "Bottom", x: 0.5, y: 0.8 },
  { label: "Left", x: 0.2, y: 0.5 },
  { label: "Right", x: 0.8, y: 0.5 },
];

function focusLabel(p: MediaPlacement) {
  const f = FOCUS.find((f) => Math.abs(f.x - (p.focalX ?? 0.5)) < 0.05 && Math.abs(f.y - (p.focalY ?? 0.5)) < 0.05);
  return f?.label ?? "Custom";
}

export function PlacementFields({
  value,
  onChange,
  idPrefix,
  invalidAlt,
}: {
  value: MediaPlacement;
  onChange: (p: MediaPlacement) => void;
  idPrefix: string;
  invalidAlt?: boolean;
}) {
  const set = (patch: Partial<MediaPlacement>) => onChange({ ...value, ...patch });
  return (
    <div className="form-grid" style={{ gap: 10 }}>
      <div className="field">
        <label htmlFor={`${idPrefix}-alt`}>Describe the photo (alt text)</label>
        <input
          id={`${idPrefix}-alt`}
          value={value.alt}
          maxLength={400}
          onChange={(e) => set({ alt: e.target.value })}
          aria-invalid={invalidAlt && !value.alt.trim() ? true : undefined}
          placeholder="e.g. A lemon tart with piped meringue peaks, slightly torched"
        />
      </div>
      <div className="form-grid two" style={{ gap: 10 }}>
        <div className="field">
          <label htmlFor={`${idPrefix}-cap`}>Caption (optional)</label>
          <input id={`${idPrefix}-cap`} value={value.caption ?? ""} maxLength={600} onChange={(e) => set({ caption: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-credit`}>Photo credit (if someone else took it)</label>
          <input id={`${idPrefix}-credit`} value={value.credit ?? ""} maxLength={200} onChange={(e) => set({ credit: e.target.value })} />
        </div>
      </div>
      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor={`${idPrefix}-focus`}>Keep in view when cropped</label>
        <select
          id={`${idPrefix}-focus`}
          value={focusLabel(value)}
          onChange={(e) => {
            const f = FOCUS.find((x) => x.label === e.target.value);
            if (f) set({ focalX: f.x, focalY: f.y });
          }}
        >
          {FOCUS.map((f) => (
            <option key={f.label}>{f.label}</option>
          ))}
          {focusLabel(value) === "Custom" ? <option>Custom</option> : null}
        </select>
        <span className="hint">Or tap the photo where the most important detail is.</span>
      </div>
    </div>
  );
}

export function PlacementThumb({ p, onFocal }: { p: MediaPlacement; onFocal?: (x: number, y: number) => void }) {
  return (
    <div
      className="ph"
      style={{ position: "relative", cursor: onFocal ? "crosshair" : undefined }}
      onClick={(e) => {
        if (!onFocal) return;
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        onFocal(Math.round(((e.clientX - r.left) / r.width) * 100) / 100, Math.round(((e.clientY - r.top) / r.height) * 100) / 100);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumbUrl(p.assetId)} alt="" onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: `${(p.focalX ?? 0.5) * 100}%`,
          top: `${(p.focalY ?? 0.5) * 100}%`,
          width: 14,
          height: 14,
          marginLeft: -7,
          marginTop: -7,
          borderRadius: "50%",
          border: "2px solid #fff",
          boxShadow: "0 0 0 2px var(--cherry)",
        }}
      />
    </div>
  );
}

/** Single photo slot (cover, step photo, video cover, hero…). */
export function SinglePhoto({
  value,
  onChange,
  label,
  idPrefix,
  hint,
  invalid,
}: {
  value: MediaPlacement | null;
  onChange: (p: MediaPlacement | null) => void;
  label: string;
  idPrefix: string;
  hint?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <fieldset id={idPrefix} data-invalid={invalid || undefined} style={invalid ? { outline: "2px solid var(--danger)", outlineOffset: 6, borderRadius: 8 } : undefined}>
      <legend>{label}</legend>
      {hint ? <p className="hint" style={{ margin: "2px 0 8px" }}>{hint}</p> : null}
      {value ? (
        <div className="placement">
          <PlacementThumb p={value} onFocal={(x, y) => onChange({ ...value, focalX: x, focalY: y })} />
          <div>
            <PlacementFields value={value} onChange={onChange} idPrefix={idPrefix} invalidAlt={invalid} />
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" className="tool-btn" onClick={() => setOpen(true)}>
                Replace
              </button>
              <button type="button" className="tool-btn danger" onClick={() => onChange(null)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          Choose a photo
        </button>
      )}
      <MediaPicker open={open} multiple={false} onClose={() => setOpen(false)} onPick={(ps) => ps[0] && onChange(ps[0])} title={label} />
    </fieldset>
  );
}

/** Ordered list of photos with Move up/down (non-drag alternative), cover selection and removal. */
export function PhotoList({
  value,
  onChange,
  label,
  idPrefix,
  coverId,
  onSetCover,
  invalid,
}: {
  value: MediaPlacement[];
  onChange: (v: MediaPlacement[]) => void;
  label: string;
  idPrefix: string;
  coverId?: string | null;
  onSetCover?: (p: MediaPlacement) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <fieldset id={idPrefix} style={invalid ? { outline: "2px solid var(--danger)", outlineOffset: 6, borderRadius: 8 } : undefined}>
      <legend>{label}</legend>
      {value.map((p, i) => (
        <div className="placement" key={`${p.assetId}-${i}`}>
          <PlacementThumb p={p} onFocal={(x, y) => onChange(value.map((v, k) => (k === i ? { ...v, focalX: x, focalY: y } : v)))} />
          <div>
            <PlacementFields value={p} onChange={(np) => onChange(value.map((v, k) => (k === i ? np : v)))} idPrefix={`${idPrefix}-${i}`} invalidAlt={invalid} />
            <div className="row" style={{ marginTop: 10, gap: 6 }}>
              <button type="button" className="tool-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move photo ${i + 1} up`}>
                ↑ Move up
              </button>
              <button type="button" className="tool-btn" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Move photo ${i + 1} down`}>
                ↓ Move down
              </button>
              {onSetCover ? (
                coverId === p.assetId ? (
                  <span className="state state-published">Cover</span>
                ) : (
                  <button type="button" className="tool-btn" onClick={() => onSetCover(p)}>
                    Make cover
                  </button>
                )
              ) : null}
              <button type="button" className="tool-btn danger" onClick={() => onChange(value.filter((_, k) => k !== i))}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-secondary" style={{ marginTop: value.length ? 12 : 0 }} onClick={() => setOpen(true)}>
        {value.length ? "Add more photos" : "Add photos"}
      </button>
      <MediaPicker open={open} multiple onClose={() => setOpen(false)} onPick={(ps) => onChange([...value, ...ps.filter((p) => !value.some((v) => v.assetId === p.assetId))])} />
    </fieldset>
  );
}
