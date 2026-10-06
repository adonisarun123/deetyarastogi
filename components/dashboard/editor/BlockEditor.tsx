"use client";

import type { Block, BlockType } from "@/lib/content/types";
import { rid } from "@/lib/content/types";
import { RichText } from "./RichText";
import { PhotoList, SinglePhoto } from "./Placements";
import { VideoField } from "./VideoField";

const LABEL: Record<BlockType, string> = {
  paragraph: "Paragraph",
  heading: "Heading",
  list: "List",
  quote: "Quote",
  image: "Photo",
  gallery: "Gallery",
  youtube: "YouTube video",
  note: "Tip / Note box",
};

function make(type: BlockType): Block {
  const id = rid();
  switch (type) {
    case "paragraph":
      return { id, type, text: "" };
    case "heading":
      return { id, type, level: 2, text: "" };
    case "list":
      return { id, type, ordered: false, items: [""] };
    case "quote":
      return { id, type, text: "", cite: "" };
    case "image":
      return { id, type, image: null };
    case "gallery":
      return { id, type, images: [] };
    case "youtube":
      return { id, type, video: null };
    case "note":
      return { id, type, label: "Tip", text: "" };
  }
}

export function BlockEditor({ blocks, onChange, invalid }: { blocks: Block[]; onChange: (b: Block[]) => void; invalid?: boolean }) {
  const update = (i: number, b: Block) => onChange(blocks.map((x, k) => (k === i ? b : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const insert = (type: BlockType) => {
    const nb = make(type);
    onChange([...blocks, nb]);
    requestAnimationFrame(() => {
      const el = document.getElementById(`blk-${nb.id}`) ?? document.getElementById(`blk-${nb.id}-0`);
      el?.focus();
    });
  };

  return (
    <div id="blocks" style={invalid ? { outline: "2px solid var(--danger)", outlineOffset: 6, borderRadius: 12 } : undefined}>
      {blocks.length === 0 ? <p className="muted">Add paragraphs, headings, photos, a video or a tip box below.</p> : null}
      {blocks.map((b, i) => (
        <div className="block" key={b.id} id={`blocks.${b.id}`}>
          <div className="block-head">
            <span className="kind">
              {i + 1}. {LABEL[b.type]}
            </span>
            <button type="button" className="tool-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move block ${i + 1} up`}>
              ↑
            </button>
            <button type="button" className="tool-btn" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} aria-label={`Move block ${i + 1} down`}>
              ↓
            </button>
            <button
              type="button"
              className="tool-btn danger"
              onClick={() => {
                const empty =
                  ("text" in b && !b.text.trim()) || (b.type === "list" && !b.items.some((x) => x.trim())) || (b.type === "image" && !b.image) || (b.type === "gallery" && !b.images.length) || (b.type === "youtube" && !b.video);
                if (empty || window.confirm("Delete this block?")) onChange(blocks.filter((_, k) => k !== i));
              }}
              aria-label={`Delete block ${i + 1}`}
            >
              Delete
            </button>
          </div>
          <BlockFields block={b} onChange={(nb) => update(i, nb)} />
        </div>
      ))}
      <div className="add-block" role="group" aria-label="Add a block">
        {(Object.keys(LABEL) as BlockType[]).map((t) => (
          <button key={t} type="button" className="tool-btn" onClick={() => insert(t)}>
            + {LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockFields({ block: b, onChange }: { block: Block; onChange: (b: Block) => void }) {
  const fid = `blk-${b.id}`;
  switch (b.type) {
    case "paragraph":
      return (
        <RichText id={fid} label="Paragraph text" hideLabel value={b.text} rows={5} onChange={(text) => onChange({ ...b, text })} />
      );
    case "heading":
      return (
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ flex: "1 1 260px" }}>
            <label htmlFor={fid}>Heading text</label>
            <input id={fid} value={b.text} maxLength={200} onChange={(e) => onChange({ ...b, text: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`${fid}-lvl`}>Size</label>
            <select id={`${fid}-lvl`} value={b.level} onChange={(e) => onChange({ ...b, level: e.target.value === "3" ? 3 : 2 })}>
              <option value="2">Section (H2)</option>
              <option value="3">Sub-section (H3)</option>
            </select>
          </div>
        </div>
      );
    case "list":
      return (
        <div className="form-grid" style={{ gap: 8 }}>
          <label className="check" style={{ paddingTop: 0 }}>
            <input type="checkbox" checked={b.ordered} onChange={(e) => onChange({ ...b, ordered: e.target.checked })} />
            <span>Numbered list</span>
          </label>
          {b.items.map((it, k) => (
            <div className="row" key={k} style={{ flexWrap: "nowrap" }}>
              <label htmlFor={`${fid}-${k}`} className="sr-only">
                Item {k + 1}
              </label>
              <input
                id={`${fid}-${k}`}
                value={it}
                maxLength={2000}
                onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === k ? e.target.value : x)) })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const items = [...b.items];
                    items.splice(k + 1, 0, "");
                    onChange({ ...b, items });
                    requestAnimationFrame(() => document.getElementById(`${fid}-${k + 1}`)?.focus());
                  }
                }}
              />
              <button type="button" className="tool-btn" aria-label={`Remove item ${k + 1}`} onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== k) })}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="tool-btn" style={{ justifySelf: "start" }} onClick={() => onChange({ ...b, items: [...b.items, ""] })}>
            + Add item
          </button>
        </div>
      );
    case "quote":
      return (
        <div className="form-grid" style={{ gap: 8 }}>
          <RichText id={fid} label="Quote" value={b.text} rows={3} maxLength={3000} onChange={(text) => onChange({ ...b, text })} />
          <div className="field">
            <label htmlFor={`${fid}-cite`}>Who said it? (optional)</label>
            <input id={`${fid}-cite`} value={b.cite ?? ""} maxLength={200} onChange={(e) => onChange({ ...b, cite: e.target.value })} />
          </div>
        </div>
      );
    case "image":
      return <SinglePhoto value={b.image} onChange={(image) => onChange({ ...b, image })} label="Photo" idPrefix={fid} />;
    case "gallery":
      return <PhotoList value={b.images} onChange={(images) => onChange({ ...b, images })} label="Gallery photos" idPrefix={fid} />;
    case "youtube":
      return <VideoField value={b.video} onChange={(video) => onChange({ ...b, video })} idPrefix={fid} />;
    case "note":
      return (
        <div className="form-grid" style={{ gap: 8 }}>
          <div className="field" style={{ maxWidth: 200 }}>
            <label htmlFor={`${fid}-label`}>Label</label>
            <select id={`${fid}-label`} value={b.label} onChange={(e) => onChange({ ...b, label: e.target.value === "Note" ? "Note" : "Tip" })}>
              <option>Tip</option>
              <option>Note</option>
            </select>
          </div>
          <RichText id={fid} label="Text" value={b.text} rows={3} maxLength={3000} onChange={(text) => onChange({ ...b, text })} />
        </div>
      );
  }
}
