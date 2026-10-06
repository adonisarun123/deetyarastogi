import type { EntryType } from "./types";

export const COLLECTIONS: Record<string, { type: EntryType; title: string; intro: string; handwriting: string }> = {
  bakes: {
    type: "story",
    title: "Photo stories",
    intro: "Bakes from my kitchen — the process, the photos and what each one taught me.",
    handwriting: "fresh from the oven",
  },
  recipes: {
    type: "recipe",
    title: "Recipes",
    intro: "Recipes I’ve tested and want to share, with every ingredient and step written out.",
    handwriting: "tried & tested",
  },
  videos: {
    type: "video",
    title: "Videos",
    intro: "Watch from the kitchen. Videos load only when you press play.",
    handwriting: "press play",
  },
  tips: {
    type: "tip",
    title: "Tips",
    intro: "Small things I’ve learnt that make a big difference.",
    handwriting: "good to know",
  },
  journal: {
    type: "journal",
    title: "Journal",
    intro: "Longer stories, experiments and notes about learning to bake professionally.",
    handwriting: "notes from the bench",
  },
};

export function collectionFor(segment: string) {
  return COLLECTIONS[segment] ?? null;
}
