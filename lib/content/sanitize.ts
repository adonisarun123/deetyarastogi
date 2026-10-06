// Coerces untrusted editor input into a well-formed EntryContent.
// Unknown block types, unsafe links and malformed IDs are dropped; text is length-limited.
// Saving a draft never fails on *incomplete* content — only on malformed input.

import {
  type Block,
  type EntryContent,
  type EntryType,
  type IngredientGroup,
  type MediaPlacement,
  type Recipe,
  type RecipeStep,
  type VideoRef,
  MAX_RELATED,
  MAX_TAGS,
  emptyContent,
  rid,
} from "./types";
import { clampText, slugify } from "../text";
import { isValidYouTubeId, watchUrl } from "../youtube";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_ID = /^[A-Za-z0-9_-]{1,40}$/;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, max: number) => clampText(v, max);
const id = (v: unknown) => (typeof v === "string" && SHORT_ID.test(v) ? v : rid());
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n) : null;
};
const frac = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
};

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

export function sanitizePlacement(v: unknown): MediaPlacement | null {
  const o = obj(v);
  if (!isUuid(o.assetId)) return null;
  return {
    assetId: o.assetId,
    alt: str(o.alt, 400),
    caption: str(o.caption, 600),
    credit: str(o.credit, 200),
    focalX: frac(o.focalX ?? 0.5),
    focalY: frac(o.focalY ?? 0.5),
  };
}

export function sanitizeVideo(v: unknown): VideoRef | null {
  const o = obj(v);
  if (!isValidYouTubeId(o.youtubeId)) return null;
  const format = o.format === "portrait" ? "portrait" : "landscape";
  const uploadDate = typeof o.uploadDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.uploadDate) ? o.uploadDate : "";
  return {
    youtubeId: o.youtubeId,
    format,
    sourceUrl: watchUrl(o.youtubeId, format),
    title: str(o.title, 200),
    description: str(o.description, 5000),
    cover: sanitizePlacement(o.cover),
    transcript: str(o.transcript, 50000),
    attribution: str(o.attribution, 300),
    madeByMe: o.madeByMe !== false,
    uploadDate,
  };
}

function sanitizeBlock(v: unknown): Block | null {
  const o = obj(v);
  const bid = id(o.id);
  switch (o.type) {
    case "paragraph":
      return { id: bid, type: "paragraph", text: str(o.text, 10000) };
    case "heading":
      return { id: bid, type: "heading", level: o.level === 3 ? 3 : 2, text: str(o.text, 200) };
    case "list":
      return {
        id: bid,
        type: "list",
        ordered: Boolean(o.ordered),
        items: arr(o.items).slice(0, 100).map((x) => str(x, 2000)),
      };
    case "quote":
      return { id: bid, type: "quote", text: str(o.text, 3000), cite: str(o.cite, 200) };
    case "image":
      return { id: bid, type: "image", image: sanitizePlacement(o.image) };
    case "gallery":
      return {
        id: bid,
        type: "gallery",
        images: arr(o.images).slice(0, 40).map(sanitizePlacement).filter(Boolean) as MediaPlacement[],
      };
    case "youtube":
      return { id: bid, type: "youtube", video: sanitizeVideo(o.video) };
    case "note":
      return { id: bid, type: "note", label: o.label === "Note" ? "Note" : "Tip", text: str(o.text, 3000) };
    default:
      return null;
  }
}

function sanitizeRecipe(v: unknown): Recipe {
  const o = obj(v);
  const notes = obj(o.notes);
  const difficulty = ["Beginner", "Intermediate", "Advanced"].includes(o.difficulty as string)
    ? (o.difficulty as Recipe["difficulty"])
    : "";
  const groups: IngredientGroup[] = arr(o.groups)
    .slice(0, 20)
    .map((g) => {
      const go = obj(g);
      return {
        id: id(go.id),
        name: str(go.name, 120),
        items: arr(go.items)
          .slice(0, 80)
          .map((it) => {
            const io = obj(it);
            return {
              id: id(io.id),
              name: str(io.name, 200),
              quantity: str(io.quantity, 40),
              unit: str(io.unit, 40),
              note: str(io.note, 200),
            };
          }),
      };
    });
  const steps: RecipeStep[] = arr(o.steps)
    .slice(0, 80)
    .map((s) => {
      const so = obj(s);
      return {
        id: id(so.id),
        heading: str(so.heading, 120),
        text: str(so.text, 4000),
        image: sanitizePlacement(so.image),
        temperature: str(so.temperature, 10).replace(/[^0-9–\-.]/g, ""),
        temperatureUnit: so.temperatureUnit === "C" || so.temperatureUnit === "F" ? so.temperatureUnit : "",
        appliance: str(so.appliance, 80),
        durationMinutes: num(so.durationMinutes),
        videoTime: str(so.videoTime, 10).replace(/[^0-9:]/g, ""),
      };
    });
  return {
    difficulty,
    yieldAmount: str(o.yieldAmount, 40),
    yieldUnit: str(o.yieldUnit, 60),
    panSize: str(o.panSize, 80),
    prepMinutes: num(o.prepMinutes),
    cookMinutes: num(o.cookMinutes),
    coolMinutes: num(o.coolMinutes),
    chillMinutes: num(o.chillMinutes),
    restMinutes: num(o.restMinutes),
    totalMinutes: num(o.totalMinutes),
    equipment: arr(o.equipment).slice(0, 40).map((x) => str(x, 160)),
    groups,
    steps,
    notes: {
      troubleshooting: str(notes.troubleshooting, 5000),
      storage: str(notes.storage, 3000),
      substitutions: str(notes.substitutions, 3000),
      mistakes: str(notes.mistakes, 3000),
      serving: str(notes.serving, 3000),
    },
    video: sanitizeVideo(o.video),
    adaptedFrom: str(o.adaptedFrom, 300),
    sourceUrl: /^https?:\/\//i.test(String(o.sourceUrl ?? "")) ? str(o.sourceUrl, 500) : "",
    dietary: arr(o.dietary).slice(0, 10).map((x) => str(x, 40)).filter(Boolean),
    reviewStatus: o.reviewStatus === "tested" ? "tested" : "in_development",
    readyToShare: Boolean(o.readyToShare),
  };
}

export function sanitizeContent(type: EntryType, input: unknown): EntryContent {
  const o = obj(input);
  const base = emptyContent(type);
  const uniq = (xs: unknown[], max: number) => Array.from(new Set(xs.filter(isUuid))).slice(0, max) as string[];
  return {
    ...base,
    title: str(o.title, 200),
    summary: str(o.summary, 600),
    blocks: arr(o.blocks).slice(0, 300).map(sanitizeBlock).filter(Boolean) as Block[],
    cover: sanitizePlacement(o.cover),
    gallery: arr(o.gallery).slice(0, 40).map(sanitizePlacement).filter(Boolean) as MediaPlacement[],
    learningNote: str(o.learningNote, 3000),
    context: ["independent", "training", "internship"].includes(o.context as string)
      ? (o.context as EntryContent["context"])
      : "",
    contribution: ["made_by_me", "assisted", "created_during_training"].includes(o.contribution as string)
      ? (o.contribution as EntryContent["contribution"])
      : "",
    categoryId: isUuid(o.categoryId) ? o.categoryId : null,
    tagIds: uniq(arr(o.tagIds), MAX_TAGS),
    relatedIds: uniq(arr(o.relatedIds), MAX_RELATED),
    video: sanitizeVideo(o.video),
    recipe: type === "recipe" ? sanitizeRecipe(o.recipe) : null,
    attribution: str(o.attribution, 400),
    seoTitle: str(o.seoTitle, 120),
    seoDescription: str(o.seoDescription, 300),
    slug: slugify(str(o.slug, 120)),
  };
}

/** Every media asset id referenced anywhere in the content. */
export function referencedAssetIds(c: EntryContent): string[] {
  const ids = new Set<string>();
  const add = (p: MediaPlacement | null | undefined) => p?.assetId && ids.add(p.assetId);
  const addVideo = (v: VideoRef | null | undefined) => add(v?.cover);
  add(c.cover);
  c.gallery.forEach(add);
  addVideo(c.video);
  for (const b of c.blocks) {
    if (b.type === "image") add(b.image);
    if (b.type === "gallery") b.images.forEach(add);
    if (b.type === "youtube") addVideo(b.video);
  }
  if (c.recipe) {
    addVideo(c.recipe.video);
    c.recipe.steps.forEach((s) => add(s.image));
  }
  return [...ids];
}
