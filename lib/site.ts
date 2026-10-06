import "server-only";
import { q, q1 } from "./db";
import type { MediaPlacement } from "./content/types";
import { sanitizePlacement, isUuid } from "./content/sanitize";
import { clampText } from "./text";

export interface SocialLink {
  label: string;
  url: string;
}

export interface SiteSettings {
  brandName: string;
  eyebrow: string;
  headline: string;
  intro: string;
  supportingLine: string;
  hero: MediaPlacement | null;
  heroProcess: MediaPlacement | null;
  heroAnnotation: string;
  featuredIds: string[];
  socialLinks: SocialLink[];
  contactIntro: string;
  contactManagedBy: string; // e.g. "Messages go to an inbox managed by her parent."
  alternativeEmail: string; // public fallback shown only on failure, if set
  giftNote: { enabled: boolean; text: string; from: string };
  footerLine: string;
  siteUrl: string;
}

// Owner-only settings never leave the server through public pages.
export interface PrivateSettings {
  inboxEmail: string;
  notifyWebhook: string;
}

export interface Profile {
  publicName: string;
  shortBio: string;
  fullBio: string;
  portrait: MediaPlacement | null;
  currentLearning: string;
  location: string; // city-level only, optional
  ageLine: string; // optional, e.g. "I'm 16" — shown once if she wants
  answers: { drewMe: string; enjoy: string; learnNext: string };
}

export const DEFAULT_SETTINGS: SiteSettings = {
  brandName: "Deetya Bakes",
  eyebrow: "The baking world of Deetya",
  headline: "A little flour. A lot of possibility.",
  intro:
    "Hi, I’m Deetya. I’m learning, experimenting and working towards a future in baking. Welcome to my little corner of the kitchen.",
  supportingLine: "Professional baking training • Baking internship experience",
  hero: null,
  heroProcess: null,
  heroAnnotation: "made with care",
  featuredIds: [],
  socialLinks: [],
  contactIntro: "For learning opportunities, collaborations or a kind hello, send a note here.",
  contactManagedBy: "Messages go to a private inbox managed by my parent, who reads every note first.",
  alternativeEmail: "",
  giftNote: {
    enabled: false,
    text: "For every idea you’re brave enough to try, and every dream you’re ready to grow. This little corner of the internet is yours.",
    from: "",
  },
  footerLine: "Made with curiosity, care and a little flour",
  siteUrl: "",
};

export const DEFAULT_PROFILE: Profile = {
  publicName: "Deetya",
  shortBio: "",
  fullBio: "",
  portrait: null,
  currentLearning: "",
  location: "",
  ageLine: "",
  answers: { drewMe: "", enjoy: "", learnNext: "" },
};

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

export function normaliseSettings(raw: unknown): SiteSettings {
  const r = o(raw);
  const s = (k: keyof SiteSettings, max: number) =>
    typeof r[k] === "string" ? clampText(r[k], max) : (DEFAULT_SETTINGS[k] as string);
  const gift = o(r.giftNote);
  return {
    brandName: s("brandName", 60) || DEFAULT_SETTINGS.brandName,
    eyebrow: s("eyebrow", 80),
    headline: s("headline", 120) || DEFAULT_SETTINGS.headline,
    intro: s("intro", 400),
    supportingLine: s("supportingLine", 160),
    hero: sanitizePlacement(r.hero),
    heroProcess: sanitizePlacement(r.heroProcess),
    heroAnnotation: s("heroAnnotation", 40),
    featuredIds: (Array.isArray(r.featuredIds) ? r.featuredIds : []).filter(isUuid).slice(0, 6) as string[],
    socialLinks: (Array.isArray(r.socialLinks) ? r.socialLinks : [])
      .map((x) => ({ label: clampText(o(x).label, 40), url: clampText(o(x).url, 300) }))
      .filter((x) => x.label && /^https:\/\//i.test(x.url))
      .slice(0, 8),
    contactIntro: s("contactIntro", 300),
    contactManagedBy: s("contactManagedBy", 300),
    alternativeEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r.alternativeEmail ?? "")) ? clampText(r.alternativeEmail, 120) : "",
    giftNote: {
      enabled: Boolean(gift.enabled),
      text: typeof gift.text === "string" ? clampText(gift.text, 600) : DEFAULT_SETTINGS.giftNote.text,
      from: clampText(gift.from, 80),
    },
    footerLine: s("footerLine", 120),
    siteUrl: /^https?:\/\//.test(String(r.siteUrl ?? "")) ? clampText(r.siteUrl, 200).replace(/\/$/, "") : "",
  };
}

export function normaliseProfile(raw: unknown): Profile {
  const r = o(raw);
  const s = (k: keyof Profile, max: number) => (typeof r[k] === "string" ? clampText(r[k], max) : (DEFAULT_PROFILE[k] as string));
  const a = o(r.answers);
  return {
    publicName: s("publicName", 60) || DEFAULT_PROFILE.publicName,
    shortBio: s("shortBio", 600),
    fullBio: s("fullBio", 4000),
    portrait: sanitizePlacement(r.portrait),
    currentLearning: s("currentLearning", 200),
    location: s("location", 60),
    ageLine: s("ageLine", 60),
    answers: {
      drewMe: clampText(a.drewMe, 800),
      enjoy: clampText(a.enjoy, 800),
      learnNext: clampText(a.learnNext, 800),
    },
  };
}

export async function getSettings(): Promise<SiteSettings> {
  try {
    const row = await q1<{ data: Obj }>(`SELECT data FROM site_settings WHERE id = 1`);
    return normaliseSettings(row?.data);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function getPrivateSettings(): Promise<PrivateSettings> {
  const row = await q1<{ data: Obj }>(`SELECT data FROM site_settings WHERE id = 1`);
  const p = o(o(row?.data).private);
  return { inboxEmail: clampText(p.inboxEmail, 200), notifyWebhook: clampText(p.notifyWebhook, 400) };
}

export async function getProfile(): Promise<Profile> {
  try {
    const row = await q1<{ data: Obj }>(`SELECT data FROM author_profile WHERE id = 1`);
    return normaliseProfile(row?.data);
  } catch {
    return DEFAULT_PROFILE;
  }
}

async function setUsage(kind: "settings" | "profile", ids: string[]) {
  await q(`DELETE FROM media_usage WHERE owner_kind = $1 AND owner_id = '1'`, [kind]);
  for (const id of ids)
    await q(
      `INSERT INTO media_usage (asset_id, owner_kind, owner_id, in_draft, in_published)
       SELECT $1, $2, '1', false, true WHERE EXISTS (SELECT 1 FROM media_assets WHERE id = $1)`,
      [id, kind],
    );
}

export async function saveSettings(userId: string, s: SiteSettings, priv?: PrivateSettings) {
  const current = await q1<{ data: Obj }>(`SELECT data FROM site_settings WHERE id = 1`);
  const privateData = priv ?? o(o(current?.data).private);
  await q(`UPDATE site_settings SET data = $1, updated_at = now(), updated_by = $2 WHERE id = 1`, [
    JSON.stringify({ ...s, private: privateData }),
    userId,
  ]);
  await setUsage("settings", [s.hero?.assetId, s.heroProcess?.assetId].filter(Boolean) as string[]);
}

export async function saveProfile(userId: string, p: Profile) {
  await q(`UPDATE author_profile SET data = $1, updated_at = now(), updated_by = $2 WHERE id = 1`, [JSON.stringify(p), userId]);
  await setUsage("profile", [p.portrait?.assetId].filter(Boolean) as string[]);
}

export interface Experience {
  id: string;
  kind: "interest" | "training" | "internship" | "next" | "other";
  title: string;
  organisation: string | null;
  role: string | null;
  period: string | null;
  description: string | null;
  details: string[];
  is_public: boolean;
  display_order: number;
}

export async function listExperiences(publicOnly: boolean): Promise<Experience[]> {
  try {
    return await q<Experience>(
      `SELECT id, kind, title, organisation, role, period, description, details, is_public, display_order
         FROM experiences ${publicOnly ? "WHERE is_public" : ""} ORDER BY display_order, created_at`,
    );
  } catch {
    return [];
  }
}

export function siteUrl(settings?: SiteSettings) {
  return (
    settings?.siteUrl ||
    process.env.SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
