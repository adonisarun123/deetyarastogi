"use client";

import { useCallback, useRef, useState } from "react";
import { api, ApiError, newRequestId } from "@/lib/client/api";

// M01–M03: phone/desktop picker + drag-and-drop, limits shown up front, per-file states,
// individual retry/cancel; one failure never discards the rest of the batch.

export const LIMITS = { bytes: 20 * 1024 * 1024, files: 20 };
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp";
const EXT_OK = /\.(jpe?g|png|webp|heic|heif)$/i;

type Status = "queued" | "uploading" | "processing" | "ready" | "failed" | "cancelled";

interface Item {
  key: string;
  file: File;
  requestId: string;
  status: Status;
  progress: number;
  error?: string;
  assetId?: string;
  xhr?: XMLHttpRequest;
}

export interface UploadedAsset {
  id: string;
  name: string;
}

function putWithProgress(url: string, file: File, contentType: string, onProgress: (p: number) => void, item: Item) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    item.xhr = xhr;
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Network problem during upload."));
    xhr.onabort = () => reject(new Error("cancelled"));
    xhr.send(file);
  });
}

export function Uploader({ onReady, compact = false }: { onReady: (a: UploadedAsset) => void; compact?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const run = useCallback(
    async (item: Item) => {
      update(item.key, { status: "uploading", progress: 0, error: undefined });
      try {
        const init = await api<{ results: { requestId: string; assetId?: string; uploadUrl?: string; contentType?: string; error?: string; alreadyReady?: boolean }[] }>(
          "/api/media",
          { body: { files: [{ name: item.file.name, size: item.file.size, type: item.file.type, requestId: item.requestId }] } },
        );
        const r = init.results[0];
        if (!r || r.error || !r.assetId) throw new Error(r?.error ?? "Upload couldn’t start.");
        if (!r.alreadyReady) {
          await putWithProgress(r.uploadUrl!, item.file, r.contentType!, (p) => update(item.key, { progress: p }), item);
          update(item.key, { status: "processing", progress: 1, assetId: r.assetId });
          // Completion is idempotent: safe to retry after a timeout.
          await api(`/api/media/${r.assetId}`, { body: {} });
        }
        update(item.key, { status: "ready", assetId: r.assetId });
        onReady({ id: r.assetId, name: item.file.name });
      } catch (e) {
        const msg = (e as Error).message;
        if (msg === "cancelled") update(item.key, { status: "cancelled", error: "Cancelled" });
        else update(item.key, { status: "failed", error: e instanceof ApiError ? e.message : msg });
      }
    },
    [onReady],
  );

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    setNotice("");
    if (files.length > LIMITS.files) setNotice(`Only the first ${LIMITS.files} photos were added — please add the rest in another batch.`);
    const fresh: Item[] = files.slice(0, LIMITS.files).map((file) => {
      const base: Item = { key: newRequestId(), file, requestId: newRequestId(), status: "queued", progress: 0 };
      const typeOk = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type) || EXT_OK.test(file.name);
      if (!typeOk) return { ...base, status: "failed", error: "Not a JPEG, PNG, WebP or HEIC photo." };
      if (file.size > LIMITS.bytes) return { ...base, status: "failed", error: "Larger than 20 MB." };
      if (file.size === 0) return { ...base, status: "failed", error: "This file is empty." };
      return base;
    });
    setItems((xs) => [...fresh, ...xs]);
    // Upload sequentially-ish (2 at a time) to be gentle on phones.
    const queue = fresh.filter((f) => f.status === "queued");
    let i = 0;
    const next = async () => {
      const it = queue[i++];
      if (!it) return;
      await run(it);
      await next();
    };
    next();
    next();
  };

  return (
    <div>
      <div
        className="upload-drop"
        data-over={over}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          id="upload-input"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button type="button" className="btn" onClick={() => input.current?.click()} style={{ minHeight: compact ? 48 : 56 }}>
          Choose photos
        </button>
        <p className="muted" style={{ margin: "10px 0 0", fontSize: "0.9rem" }}>
          JPEG, PNG, WebP or HEIC (iPhone) · up to 20 MB and 80 megapixels each · up to {LIMITS.files} at a time
          <span className="hide-mobile"> · or drag photos here</span>
        </p>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>Location data is removed automatically before anything goes public.</p>
      </div>
      {notice ? (
        <p className="alert alert-info" role="status" style={{ marginTop: 10 }}>
          {notice}
        </p>
      ) : null}
      {items.length ? (
        <ul className="upload-list" aria-live="polite">
          {items.map((it) => (
            <li key={it.key}>
              <span className="name" title={it.file.name}>
                {it.file.name}
              </span>
              {it.status === "uploading" ? (
                <span className="progress" aria-label={`Uploading ${Math.round(it.progress * 100)}%`}>
                  <span style={{ width: `${Math.round(it.progress * 100)}%` }} />
                </span>
              ) : null}
              <span style={{ fontWeight: 600, color: it.status === "failed" ? "var(--danger)" : it.status === "ready" ? "var(--success)" : undefined }}>
                {it.status === "queued" && "Waiting"}
                {it.status === "uploading" && "Uploading"}
                {it.status === "processing" && "Processing"}
                {it.status === "ready" && "Ready ✓"}
                {it.status === "failed" && `Failed: ${it.error}`}
                {it.status === "cancelled" && "Cancelled"}
              </span>
              {it.status === "uploading" ? (
                <button type="button" className="tool-btn" onClick={() => it.xhr?.abort()}>
                  Cancel
                </button>
              ) : null}
              {(it.status === "failed" || it.status === "cancelled") && it.file.size <= LIMITS.bytes ? (
                <button type="button" className="tool-btn" onClick={() => run(it)}>
                  Retry
                </button>
              ) : null}
              {it.status === "failed" || it.status === "cancelled" || it.status === "ready" ? (
                <button type="button" className="tool-btn" onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))} aria-label={`Dismiss ${it.file.name}`}>
                  ✕
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
