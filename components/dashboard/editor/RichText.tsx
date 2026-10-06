"use client";

import { useRef } from "react";

/**
 * Plain textarea with tiny formatting helpers. Stores safe inline markup:
 * **bold**, *italic*, [text](https://link). Pasting from other apps arrives as clean text.
 */
export function RichText({
  id,
  label,
  value,
  onChange,
  rows = 4,
  maxLength = 10000,
  hint,
  invalid,
  hideLabel,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  maxLength?: number;
  hint?: string;
  invalid?: boolean;
  hideLabel?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrap = (before: string, after: string, placeholderText: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || placeholderText;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };

  const link = () => {
    const url = window.prompt("Link address (https://…)", "https://");
    if (!url || !/^(https?:\/\/|mailto:|\/)/i.test(url)) return;
    wrap("[", `](${url.trim()})`, "link text");
  };

  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </label>
      <div className="row" style={{ gap: 4 }} role="toolbar" aria-label={`Formatting for ${label}`}>
        <button type="button" className="tool-btn" onClick={() => wrap("**", "**", "bold text")} aria-label="Bold">
          <strong>B</strong>
        </button>
        <button type="button" className="tool-btn" onClick={() => wrap("*", "*", "italic text")} aria-label="Italic">
          <em>I</em>
        </button>
        <button type="button" className="tool-btn" onClick={link}>
          Link
        </button>
      </div>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onPaste={(e) => {
          // Paste cleanly from Word/Docs/Notes: plain text only, normalised whitespace.
          const text = e.clipboardData.getData("text/plain");
          if (!text) return;
          e.preventDefault();
          const clean = text.replace(/\r\n?/g, "\n").replace(/ /g, " ").replace(/[​-‍﻿]/g, "");
          const el = e.currentTarget;
          const s = el.selectionStart;
          const end = el.selectionEnd;
          onChange(value.slice(0, s) + clean + value.slice(end));
          requestAnimationFrame(() => el.setSelectionRange(s + clean.length, s + clean.length));
        }}
      />
      {hint ? (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
