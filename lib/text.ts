// Small text helpers shared by server and client.

export function slugify(input: string, max = 80): string {
  return (input ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export function clampText(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.replace(/\u0000/g, "").slice(0, max);
}

// Inline markup used inside paragraphs, list items, notes and quotes:
//   **bold**, *italic*, [link text](https://…)
// Rendered by components/Inline.tsx without dangerouslySetInnerHTML.
export type InlineNode =
  | { t: "text"; v: string }
  | { t: "b"; c: InlineNode[] }
  | { t: "i"; c: InlineNode[] }
  | { t: "a"; href: string; c: InlineNode[] };

const SAFE_LINK = /^(https?:\/\/|mailto:|\/(?!\/))/i;

export function safeHref(href: string): string | null {
  const h = href.trim();
  if (!SAFE_LINK.test(h)) return null;
  if (/^(javascript|data|vbscript):/i.test(h)) return null;
  return h;
}

export function parseInline(src: string): InlineNode[] {
  const out: InlineNode[] = [];
  let i = 0;
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^\*\*([\s\S]+?)\*\*/))) {
      flush();
      out.push({ t: "b", c: parseInline(m[1]) });
      i += m[0].length;
    } else if ((m = rest.match(/^\*(?!\s)([\s\S]+?)(?<!\s)\*/))) {
      flush();
      out.push({ t: "i", c: parseInline(m[1]) });
      i += m[0].length;
    } else if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
      const href = safeHref(m[2]);
      flush();
      if (href) out.push({ t: "a", href, c: parseInline(m[1]) });
      else out.push({ t: "text", v: m[1] });
      i += m[0].length;
    } else {
      buf += src[i];
      i++;
    }
  }
  flush();
  return out;
}

export function stripInline(src: string): string {
  return (src ?? "")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/\*([\s\S]+?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export function minutesLabel(min: number | null | undefined): string {
  if (!min || min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function isoDuration(min: number | null | undefined): string | undefined {
  if (!min || min <= 0) return undefined;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}`;
}

const IST = "Asia/Kolkata";

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: IST }).format(
    new Date(d),
  );
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: IST,
  }).format(new Date(d));
}

export function formatTime(d: string | Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: IST }).format(
    new Date(d),
  );
}

export function headingAnchor(text: string, used: Set<string>): string {
  const base = slugify(stripInline(text), 60) || "section";
  let a = base;
  let n = 2;
  while (used.has(a)) a = `${base}-${n++}`;
  used.add(a);
  return a;
}
