// Publish-time validation (E05, R01, M08, V03, minimum publishable content table).
// Returns field-level problems; never mutates or drops content.

import type { EntryContent, EntryType } from "./types";
import { referencedAssetIds } from "./sanitize";
import { stripInline } from "../text";

export interface Problem {
  field: string; // dotted path used by the editor to highlight the exact field
  message: string;
}

export interface MediaStateLookup {
  (assetId: string): "ready" | "processing" | "uploading" | "failed" | "missing";
}

function hasBodyText(c: EntryContent) {
  return c.blocks.some(
    (b) =>
      ((b.type === "paragraph" || b.type === "quote" || b.type === "note") && stripInline(b.text).trim().length > 0) ||
      (b.type === "list" && b.items.some((i) => i.trim())),
  );
}

export function validateForPublish(type: EntryType, c: EntryContent, media: MediaStateLookup): Problem[] {
  const p: Problem[] = [];
  const need = (cond: boolean, field: string, message: string) => {
    if (!cond) p.push({ field, message });
  };

  need(c.title.trim().length > 0, "title", "Add a title.");
  if (c.title.length > 140) p.push({ field: "title", message: "Keep the title under 140 characters." });

  switch (type) {
    case "story": {
      need(c.summary.trim().length > 0, "summary", "Add a short summary.");
      const imgs = [c.cover, ...c.gallery].filter(Boolean);
      need(imgs.length > 0, "gallery", "A photo story needs at least one photo.");
      need(
        imgs.some((i) => media(i!.assetId) === "ready"),
        "gallery",
        "At least one photo must finish processing before publishing.",
      );
      break;
    }
    case "recipe": {
      const r = c.recipe;
      need(c.summary.trim().length > 0, "summary", "Add a short summary.");
      need(Boolean(c.cover), "cover", "Add a cover photo of the finished bake.");
      need(Boolean(c.categoryId), "categoryId", "Choose one category.");
      if (!r) {
        p.push({ field: "recipe", message: "Recipe details are missing." });
        break;
      }
      need(Boolean(r.difficulty), "recipe.difficulty", "Choose a difficulty.");
      need(r.yieldAmount.trim().length > 0, "recipe.yieldAmount", "Add the yield amount (e.g. 12).");
      need(r.yieldUnit.trim().length > 0, "recipe.yieldUnit", "Add the yield unit (e.g. cookies).");
      need(r.prepMinutes !== null, "recipe.prepMinutes", "Add the prep time in minutes.");
      need(r.cookMinutes !== null, "recipe.cookMinutes", "Add the bake/cook time in minutes (0 if none).");
      need(r.totalMinutes !== null && r.totalMinutes > 0, "recipe.totalMinutes", "Confirm the total time in minutes.");
      const groupsWithName = r.groups.filter((g) => g.name.trim());
      need(groupsWithName.length > 0, "recipe.groups", "Name at least one ingredient group.");
      const ingredients = r.groups.flatMap((g) => g.items).filter((i) => i.name.trim());
      need(ingredients.length > 0, "recipe.groups", "Add at least one ingredient.");
      const steps = r.steps.filter((s) => s.text.trim());
      need(steps.length > 0, "recipe.steps", "Add at least one method step.");
      r.steps.forEach((s, i) => {
        if (s.temperature && !s.temperatureUnit)
          p.push({ field: `recipe.steps.${i}.temperatureUnit`, message: `Step ${i + 1}: choose °C or °F.` });
        if (s.temperatureUnit && !s.temperature)
          p.push({ field: `recipe.steps.${i}.temperature`, message: `Step ${i + 1}: add the temperature.` });
      });
      need(r.readyToShare, "recipe.readyToShare", "Confirm the recipe is ready to share.");
      break;
    }
    case "video": {
      need(Boolean(c.video), "video", "Add a YouTube link.");
      need((c.summary || c.video?.description || "").trim().length > 0, "summary", "Add a description.");
      need(Boolean(c.cover || c.video?.cover), "cover", "Add a cover image for the video.");
      if (c.video && c.video.madeByMe === false)
        need(Boolean(c.video.attribution?.trim()), "video.attribution", "Credit who made this video.");
      break;
    }
    case "tip": {
      need(hasBodyText(c) || c.summary.trim().length > 20, "blocks", "Add a useful explanation.");
      break;
    }
    case "journal": {
      need(c.summary.trim().length > 0, "summary", "Add a short summary.");
      need(hasBodyText(c), "blocks", "Write some body text.");
      break;
    }
  }

  // Every referenced image must be ready (a processing image cannot go public).
  for (const assetId of referencedAssetIds(c)) {
    const s = media(assetId);
    if (s === "missing") p.push({ field: "media", message: "A photo used in this entry was deleted. Remove or replace it." });
    else if (s === "failed") p.push({ field: "media", message: "A photo failed to process. Retry or replace it." });
    else if (s !== "ready") p.push({ field: "media", message: "Wait for all photos to finish processing." });
  }

  // Alt text (WCAG): every placed image needs a description.
  const placements = [c.cover, ...c.gallery, ...c.blocks.flatMap((b) => (b.type === "image" ? [b.image] : b.type === "gallery" ? b.images : []))].filter(Boolean);
  if (placements.some((pl) => !pl!.alt.trim()))
    p.push({ field: "media.alt", message: "Describe every photo (alt text) so everyone can enjoy it." });

  for (const b of c.blocks) {
    if (b.type === "youtube" && !b.video) p.push({ field: `blocks.${b.id}`, message: "A video block has no valid YouTube link." });
  }

  // De-duplicate identical messages.
  const seen = new Set<string>();
  return p.filter((x) => {
    const k = x.field + x.message;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
