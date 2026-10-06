"use client";

import { useEffect, useRef, useState } from "react";

// V04–V06: click-to-load. Nothing is requested from YouTube until the visitor chooses to play.
// After interaction the privacy-enhanced (youtube-nocookie) embed loads with a Referer
// (strict-origin-when-cross-origin) and keyboard-accessible native controls.

const ERRORS: Record<number, string> = {
  2: "This video link isn't valid any more.",
  5: "This video can't play in this browser.",
  100: "This video has been removed or made private.",
  101: "The video's owner doesn't allow it to play on other websites.",
  150: "The video's owner doesn't allow it to play on other websites.",
  152: "This video can't be played here.",
  153: "This video can't be played here.",
};

export function YouTubePlayer({
  id,
  title,
  format,
  coverSrc,
  coverSrcSet,
  watchUrl,
}: {
  id: string;
  title: string;
  format: "landscape" | "portrait";
  coverSrc?: string | null;
  coverSrcSet?: string | null;
  watchUrl: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!loaded) return;
    const onMsg = (e: MessageEvent) => {
      if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
      let data: { event?: string; info?: unknown } | null = null;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data?.event === "onError") {
        const code = Number(data.info);
        setError(ERRORS[code] ?? "This video can't be played here right now.");
      }
    };
    window.addEventListener("message", onMsg);
    const ping = () =>
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
    const t = setInterval(ping, 1000);
    const stop = setTimeout(() => clearInterval(t), 8000);
    return () => {
      window.removeEventListener("message", onMsg);
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [loaded]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&enablejsapi=1${
    origin ? `&origin=${encodeURIComponent(origin)}` : ""
  }`;

  return (
    <div>
      <div className="yt" data-format={format}>
        {!loaded ? (
          <>
            {coverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cover" src={coverSrc} srcSet={coverSrcSet ?? undefined} sizes="(min-width: 900px) 800px, 100vw" alt="" loading="lazy" />
            ) : (
              <div className="cover-fallback" />
            )}
            <button type="button" className="load" onClick={() => setLoaded(true)}>
              <span className="play-badge" aria-hidden="true" />
              <span className="txt">
                Load YouTube video<span className="sr-only">: {title}</span>
              </span>
            </button>
          </>
        ) : (
          <iframe
            ref={frame}
            src={src}
            title={`YouTube video: ${title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        )}
        {error ? (
          <div className="yt-error" role="status">
            <div>
              <p style={{ marginBottom: 10 }}>{error}</p>
              <a href={watchUrl} target="_blank" rel="noopener noreferrer">
                Open on YouTube<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </div>
        ) : null}
      </div>
      <p className="yt-note">
        {loaded ? "Playing from YouTube. " : "Loading the video connects to YouTube (Google). "}
        <a href={watchUrl} target="_blank" rel="noopener noreferrer">
          Open on YouTube<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </div>
  );
}
