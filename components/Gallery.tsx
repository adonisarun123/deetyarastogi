"use client";

import { useRef, useState } from "react";
import { CloseIcon } from "./Icons";

export interface GalleryItem {
  key: string;
  src: string;
  srcSet: string;
  large: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
  credit?: string;
}

/** Story is fully readable without opening the enlargement; the dialog is optional. */
export function Gallery({ items }: { items: GalleryItem[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [active, setActive] = useState<GalleryItem | null>(null);

  const open = (item: GalleryItem, btn: HTMLButtonElement) => {
    trigger.current = btn;
    setActive(item);
    dialog.current?.showModal();
  };
  const close = () => {
    dialog.current?.close();
  };

  return (
    <>
      <div className="gallery-grid">
        {items.map((it) => (
          <figure key={it.key}>
            <button type="button" className="open" onClick={(e) => open(it, e.currentTarget)} aria-label={`Enlarge photo: ${it.alt}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.src} srcSet={it.srcSet} sizes="(min-width: 900px) 560px, 92vw" width={it.width} height={it.height} alt={it.alt} loading="lazy" decoding="async" />
            </button>
            {it.caption || it.credit ? (
              <figcaption>
                {it.caption}
                {it.credit ? <span> · Photo: {it.credit}</span> : null}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="lightbox"
        aria-label="Enlarged photo"
        onClose={() => {
          setActive(null);
          trigger.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="lb-bar">
          <span>{active?.caption ? "" : " "}</span>
          <button type="button" className="icon-btn" onClick={close} autoFocus>
            <CloseIcon />
            <span>Close</span>
          </button>
        </div>
        {active ? (
          <figure style={{ margin: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.large} alt={active.alt} width={active.width} height={active.height} />
            {active.caption ? <figcaption>{active.caption}</figcaption> : null}
          </figure>
        ) : null}
      </dialog>
    </>
  );
}
