// V01: accept youtube.com/watch?v=, youtu.be/, youtube.com/shorts/ links only.
// Arbitrary iframe code and non-YouTube hosts are rejected.

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"]);

export type ParsedYouTube =
  | { ok: true; id: string; format: "landscape" | "portrait"; canonicalUrl: string; startSeconds?: number }
  | { ok: false; error: string };

export function parseYouTubeUrl(input: string): ParsedYouTube {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: "Paste a YouTube link." };
  if (/<\s*iframe|<\s*script|</i.test(raw)) {
    return { ok: false, error: "Paste the video link, not embed code." };
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: "That doesn't look like a link." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, error: "Only web links are allowed." };
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return { ok: false, error: "Only YouTube links (youtube.com or youtu.be) are accepted." };

  let id: string | null = null;
  let format: "landscape" | "portrait" = "landscape";
  const parts = url.pathname.split("/").filter(Boolean);

  if (host.endsWith("youtu.be")) {
    id = parts[0] ?? null;
  } else if (parts[0] === "watch") {
    id = url.searchParams.get("v");
  } else if (parts[0] === "shorts") {
    id = parts[1] ?? null;
    format = "portrait";
  } else if (parts[0] === "live" || parts[0] === "embed") {
    id = parts[1] ?? null;
  }

  if (!id || !ID_RE.test(id)) return { ok: false, error: "We couldn't find a video ID in that YouTube link." };

  const t = url.searchParams.get("t") ?? url.searchParams.get("start");
  const startSeconds = t ? parseTime(t) : undefined;

  return {
    ok: true,
    id,
    format,
    canonicalUrl: format === "portrait" ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
    ...(startSeconds ? { startSeconds } : {}),
  };
}

function parseTime(t: string): number | undefined {
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m) return undefined;
  const s = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return s || undefined;
}

export function isValidYouTubeId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

export function embedUrl(id: string, origin?: string) {
  const params = new URLSearchParams({ autoplay: "1", rel: "0", playsinline: "1" });
  if (origin) params.set("origin", origin);
  // Privacy-enhanced mode (V04).
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function watchUrl(id: string, format: "landscape" | "portrait" = "landscape") {
  return format === "portrait" ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
}
