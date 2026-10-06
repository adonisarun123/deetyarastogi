// Shared content model. Used by the editor (client) and the server.
// Recipe data and blocks live inside a revision so preview and publication stay consistent.

export const ENTRY_TYPES = ["story", "recipe", "video", "tip", "journal"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const TYPE_LABEL: Record<EntryType, string> = {
  story: "Photo story",
  recipe: "Recipe",
  video: "Video",
  tip: "Tip",
  journal: "Journal",
};

export const TYPE_PLURAL: Record<EntryType, string> = {
  story: "Photo stories",
  recipe: "Recipes",
  video: "Videos",
  tip: "Tips",
  journal: "Journal",
};

// Public URL prefix for each type. Photo stories live under /bakes.
export const TYPE_PATH: Record<EntryType, string> = {
  story: "bakes",
  recipe: "recipes",
  video: "videos",
  tip: "tips",
  journal: "journal",
};

export function entryPath(type: EntryType, slug: string) {
  return `/${TYPE_PATH[type]}/${slug}`;
}

export type EntryState = "draft" | "published" | "unpublished" | "trashed";

export interface MediaPlacement {
  assetId: string;
  alt: string;
  caption?: string;
  credit?: string;
  focalX?: number; // 0..1
  focalY?: number; // 0..1
}

export interface VideoRef {
  youtubeId: string;
  format: "landscape" | "portrait"; // Shorts are portrait
  sourceUrl: string; // canonical watch URL
  title?: string;
  description?: string;
  cover?: MediaPlacement | null;
  transcript?: string;
  attribution?: string; // e.g. "Video by …" when not made by her
  madeByMe?: boolean;
  uploadDate?: string; // YYYY-MM-DD, only if known (never guessed)
}

export type Block =
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "heading"; level: 2 | 3; text: string }
  | { id: string; type: "list"; ordered: boolean; items: string[] }
  | { id: string; type: "quote"; text: string; cite?: string }
  | { id: string; type: "image"; image: MediaPlacement | null }
  | { id: string; type: "gallery"; images: MediaPlacement[] }
  | { id: string; type: "youtube"; video: VideoRef | null }
  | { id: string; type: "note"; label: "Tip" | "Note"; text: string };

export type BlockType = Block["type"];

export interface Ingredient {
  id: string;
  name: string;
  quantity: string; // display quantity, preserved as entered ("1–2", "to taste")
  unit: string;
  note: string; // preparation note
}

export interface IngredientGroup {
  id: string;
  name: string;
  items: Ingredient[];
}

export interface RecipeStep {
  id: string; // stable step id
  heading?: string;
  text: string;
  image?: MediaPlacement | null;
  temperature?: string; // e.g. "180"
  temperatureUnit?: "C" | "F" | "";
  appliance?: string; // e.g. "Oven, fan"
  durationMinutes?: number | null;
  videoTime?: string; // e.g. "2:15"
}

export interface Recipe {
  difficulty: "" | "Beginner" | "Intermediate" | "Advanced";
  yieldAmount: string;
  yieldUnit: string;
  panSize: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  coolMinutes: number | null;
  chillMinutes: number | null;
  restMinutes: number | null;
  totalMinutes: number | null; // confirmed by the author
  equipment: string[];
  groups: IngredientGroup[];
  steps: RecipeStep[];
  notes: {
    troubleshooting: string;
    storage: string;
    substitutions: string;
    mistakes: string;
    serving: string;
  };
  video: VideoRef | null;
  adaptedFrom: string; // attribution
  sourceUrl: string;
  dietary: string[]; // author-confirmed labels only
  reviewStatus: "in_development" | "tested";
  readyToShare: boolean;
}

export interface EntryContent {
  title: string;
  summary: string;
  blocks: Block[];
  cover: MediaPlacement | null;
  gallery: MediaPlacement[]; // photo stories
  learningNote: string; // "What I learnt"
  context: "" | "independent" | "training" | "internship";
  contribution: "" | "made_by_me" | "assisted" | "created_during_training";
  categoryId: string | null;
  tagIds: string[];
  relatedIds: string[];
  video: VideoRef | null; // main item for Video entries
  recipe: Recipe | null;
  attribution: string;
  seoTitle: string;
  seoDescription: string;
  slug: string;
}

export function emptyRecipe(): Recipe {
  return {
    difficulty: "",
    yieldAmount: "",
    yieldUnit: "",
    panSize: "",
    prepMinutes: null,
    cookMinutes: null,
    coolMinutes: null,
    chillMinutes: null,
    restMinutes: null,
    totalMinutes: null,
    equipment: [],
    groups: [{ id: rid(), name: "Ingredients", items: [{ id: rid(), name: "", quantity: "", unit: "", note: "" }] }],
    steps: [{ id: rid(), text: "" }],
    notes: { troubleshooting: "", storage: "", substitutions: "", mistakes: "", serving: "" },
    video: null,
    adaptedFrom: "",
    sourceUrl: "",
    dietary: [],
    reviewStatus: "in_development",
    readyToShare: false,
  };
}

export function emptyContent(type: EntryType): EntryContent {
  return {
    title: "",
    summary: "",
    blocks: [],
    cover: null,
    gallery: [],
    learningNote: "",
    context: "",
    contribution: "",
    categoryId: null,
    tagIds: [],
    relatedIds: [],
    video: null,
    recipe: type === "recipe" ? emptyRecipe() : null,
    attribution: "",
    seoTitle: "",
    seoDescription: "",
    slug: "",
  };
}

export function rid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

export const CONTEXT_LABEL: Record<string, string> = {
  independent: "Independent bake",
  training: "Made during training",
  internship: "Made during internship",
};

export const CONTRIBUTION_LABEL: Record<string, string> = {
  made_by_me: "Made by me",
  assisted: "I assisted with this",
  created_during_training: "Created during training",
};

export const MAX_TAGS = 8;
export const MAX_RELATED = 3;
export const PAGE_SIZE = 12;
