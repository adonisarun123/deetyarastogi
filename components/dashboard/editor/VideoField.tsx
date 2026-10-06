"use client";

import { useState } from "react";
import type { VideoRef } from "@/lib/content/types";
import { parseYouTubeUrl, watchUrl } from "@/lib/youtube";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { SinglePhoto } from "./Placements";

/** V01–V03, V06, V07: paste a YouTube link, preview it, describe and credit it. */
export function VideoField({
  value,
  onChange,
  idPrefix,
  label = "YouTube video",
  full = false,
  invalid,
}: {
  value: VideoRef | null;
  onChange: (v: VideoRef | null) => void;
  idPrefix: string;
  label?: string;
  full?: boolean; // show title/description/transcript fields (Video entries)
  invalid?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);

  const add = () => {
    const r = parseYouTubeUrl(url);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError("");
    setUrl("");
    onChange({
      youtubeId: r.id,
      format: r.format,
      sourceUrl: r.canonicalUrl,
      title: value?.title ?? "",
      description: value?.description ?? "",
      cover: value?.cover ?? null,
      transcript: value?.transcript ?? "",
      attribution: value?.attribution ?? "",
      madeByMe: value?.madeByMe ?? true,
      uploadDate: value?.uploadDate ?? "",
    });
  };

  const set = (patch: Partial<VideoRef>) => value && onChange({ ...value, ...patch });

  return (
    <fieldset id={idPrefix} style={invalid ? { outline: "2px solid var(--danger)", outlineOffset: 6, borderRadius: 8 } : undefined}>
      <legend>{label}</legend>
      {!value ? (
        <>
          <p className="hint" style={{ margin: "2px 0 8px" }}>
            Upload the video on YouTube or YouTube Studio first, then copy its link (watch, youtu.be or Shorts) and paste it here.
          </p>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ flex: "1 1 260px" }}>
              <label htmlFor={`${idPrefix}-url`}>YouTube link</label>
              <input
                id={`${idPrefix}-url`}
                type="url"
                inputMode="url"
                value={url}
                placeholder="https://youtu.be/…"
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${idPrefix}-err` : undefined}
              />
            </div>
            <button type="button" className="btn" onClick={add}>
              Add YouTube video
            </button>
          </div>
          {error ? (
            <p id={`${idPrefix}-err`} className="error-text" role="alert">
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <div className="form-grid" style={{ gap: 12 }}>
          <p style={{ margin: 0 }}>
            <strong>{value.format === "portrait" ? "YouTube Short" : "YouTube video"}</strong> · ID <span className="kbd">{value.youtubeId}</span> ·{" "}
            <a href={watchUrl(value.youtubeId, value.format)} target="_blank" rel="noopener noreferrer">
              open on YouTube
            </a>
          </p>
          <div className="row">
            <button type="button" className="tool-btn" onClick={() => setPreview((p) => !p)}>
              {preview ? "Hide preview" : "Test playback"}
            </button>
            <button type="button" className="tool-btn danger" onClick={() => onChange(null)}>
              Remove video
            </button>
          </div>
          {preview ? (
            <div style={{ maxWidth: value.format === "portrait" ? 300 : 560 }}>
              <YouTubePlayer id={value.youtubeId} title={value.title || "Preview"} format={value.format} watchUrl={watchUrl(value.youtubeId, value.format)} />
              <p className="hint">If the video is private, deleted or doesn’t allow embedding, the public page shows a short message and an “Open on YouTube” link instead.</p>
            </div>
          ) : null}

          {full ? (
            <>
              <div className="field">
                <label htmlFor={`${idPrefix}-title`}>Video title (optional; defaults to the entry title)</label>
                <input id={`${idPrefix}-title`} value={value.title ?? ""} maxLength={200} onChange={(e) => set({ title: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`${idPrefix}-desc`}>Description</label>
                <textarea id={`${idPrefix}-desc`} rows={4} value={value.description ?? ""} maxLength={5000} onChange={(e) => set({ description: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`${idPrefix}-tr`}>Transcript or written summary (optional)</label>
                <textarea id={`${idPrefix}-tr`} rows={4} value={value.transcript ?? ""} onChange={(e) => set({ transcript: e.target.value })} />
              </div>
              <div className="field" style={{ maxWidth: 240 }}>
                <label htmlFor={`${idPrefix}-date`}>YouTube upload date (only if you know it)</label>
                <input id={`${idPrefix}-date`} type="date" value={value.uploadDate ?? ""} onChange={(e) => set({ uploadDate: e.target.value })} />
                <span className="hint">Used for search engines. Leave empty if unsure.</span>
              </div>
            </>
          ) : null}

          <label className="check">
            <input type="checkbox" checked={value.madeByMe !== false} onChange={(e) => set({ madeByMe: e.target.checked })} />
            <span>I made this video</span>
          </label>
          {value.madeByMe === false ? (
            <div className="field">
              <label htmlFor={`${idPrefix}-attr`}>Who made it? (shown as credit)</label>
              <input id={`${idPrefix}-attr`} value={value.attribution ?? ""} maxLength={300} onChange={(e) => set({ attribution: e.target.value })} aria-invalid={!value.attribution?.trim() || undefined} />
            </div>
          ) : null}

          <SinglePhoto
            value={value.cover ?? null}
            onChange={(cover) => set({ cover })}
            label="Video cover image (shown before the video loads)"
            idPrefix={`${idPrefix}-cover`}
            hint="Upload your own still — the site never fetches YouTube thumbnails before a visitor presses play."
          />
        </div>
      )}
    </fieldset>
  );
}
