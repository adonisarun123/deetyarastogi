import "server-only";
import sharp from "sharp";
import { q, q1 } from "./db";
import { getObject, putObject, deleteObject } from "./storage";
import { opsEvent } from "./ops";

export const MAX_BYTES = 20 * 1024 * 1024; // M02: 20 MiB
export const MAX_PIXELS = 80_000_000; // M02: 80 megapixels decoded
export const MAX_FILES = 20;
export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const WIDTHS = [480, 800, 1200, 1600, 2000];

export type Sniffed = "jpeg" | "png" | "webp" | "heic" | null;

/** Identify the real file type from its bytes; never trust the filename or browser MIME. */
export function sniff(buf: Buffer): Sniffed {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) return "heic";
  }
  return null;
}

async function decodeHeic(buf: Buffer): Promise<Buffer> {
  // libvips prebuilt binaries cannot decode HEVC-based HEIC, so convert server-side first.
  const mod = (await import("heic-convert")) as unknown as {
    default: (o: { buffer: Buffer; format: "JPEG" | "PNG"; quality?: number }) => Promise<ArrayBuffer>;
  };
  const out = await mod.default({ buffer: buf, format: "JPEG", quality: 0.92 });
  return Buffer.from(out);
}

export interface ProcessResult {
  ok: boolean;
  error?: string;
}

/** Idempotent: re-running on a ready asset is a no-op. */
export async function processAsset(assetId: string): Promise<ProcessResult> {
  const asset = await q1<{ id: string; original_key: string; state: string }>(
    `SELECT id, original_key, state FROM media_assets WHERE id = $1 AND deleted_at IS NULL`,
    [assetId],
  );
  if (!asset) return { ok: false, error: "Upload not found." };
  if (asset.state === "ready") return { ok: true };

  // Claim the job so a double "complete" call doesn't process twice.
  const claimed = await q1(
    `UPDATE media_assets SET state = 'processing', error = NULL, updated_at = now()
      WHERE id = $1 AND state IN ('uploading', 'failed', 'processing') AND (state <> 'processing' OR updated_at < now() - interval '2 minutes')
      RETURNING id`,
    [assetId],
  );
  if (!claimed) {
    const cur = await q1<{ state: string }>(`SELECT state FROM media_assets WHERE id = $1`, [assetId]);
    return { ok: cur?.state === "ready" || cur?.state === "processing" };
  }

  const fail = async (msg: string) => {
    await q(`UPDATE media_assets SET state = 'failed', error = $2, updated_at = now() WHERE id = $1`, [assetId, msg]);
    await opsEvent("upload_failed", assetId, msg);
    return { ok: false, error: msg };
  };

  try {
    const original = await getObject(asset.original_key);
    if (!original) return await fail("The upload didn't arrive. Please try again.");
    if (original.length > MAX_BYTES) return await fail("This photo is larger than 20 MB.");
    const kind = sniff(original);
    if (!kind) return await fail("This file isn't a JPEG, PNG, WebP or HEIC photo.");

    let input = original;
    if (kind === "heic") {
      try {
        input = await decodeHeic(original);
      } catch {
        return await fail("We couldn't read this HEIC photo. Try exporting it as JPEG.");
      }
    }

    const meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
    if (!meta.width || !meta.height) return await fail("We couldn't read this photo's size.");
    if (meta.width * meta.height > MAX_PIXELS) return await fail("This photo is larger than 80 megapixels.");

    // Apply EXIF orientation, then strip ALL metadata (including GPS) from derivatives.
    const oriented = await sharp(input, { limitInputPixels: MAX_PIXELS }).rotate().toBuffer({ resolveWithObject: true });
    const W = oriented.info.width;
    const H = oriented.info.height;

    const widths = WIDTHS.filter((w) => w < W);
    if (widths.length === 0 || widths[widths.length - 1] < Math.min(W, 2000)) widths.push(Math.min(W, 2000));

    await q(`DELETE FROM media_variants WHERE asset_id = $1`, [assetId]);
    for (const w of Array.from(new Set(widths))) {
      const img = sharp(oriented.data).resize({ width: w, withoutEnlargement: true });
      const webp = await img.clone().webp({ quality: w <= 800 ? 72 : 76, effort: 4 }).toBuffer({ resolveWithObject: true });
      const key = `public/${assetId}/${w}.webp`;
      await putObject(key, webp.data, "image/webp");
      await q(
        `INSERT INTO media_variants (asset_id, width, height, format, key, bytes) VALUES ($1,$2,$3,'webp',$4,$5)`,
        [assetId, webp.info.width, webp.info.height, key, webp.data.length],
      );
      if (w === 1200 || (w === widths[widths.length - 1] && W < 1200)) {
        // JPEG for social previews (some crawlers don't read WebP).
        const jpg = await img.clone().jpeg({ quality: 80, mozjpeg: true }).toBuffer({ resolveWithObject: true });
        const jkey = `public/${assetId}/${w}.jpg`;
        await putObject(jkey, jpg.data, "image/jpeg");
        await q(
          `INSERT INTO media_variants (asset_id, width, height, format, key, bytes) VALUES ($1,$2,$3,'jpeg',$4,$5)
           ON CONFLICT DO NOTHING`,
          [assetId, jpg.info.width, jpg.info.height, jkey, jpg.data.length],
        );
      }
    }

    await q(
      `UPDATE media_assets SET state = 'ready', width = $2, height = $3, mime = $4, error = NULL, updated_at = now() WHERE id = $1`,
      [assetId, W, H, kind === "heic" ? "image/heic" : `image/${kind}`],
    );
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message?.includes("pixel limit")
      ? "This photo is larger than 80 megapixels."
      : "Processing failed. Please retry.";
    return await fail(msg);
  }
}

export interface VariantRow {
  width: number;
  height: number;
  format: string;
  key: string;
}

export async function variantsFor(assetIds: string[]) {
  if (!assetIds.length) return new Map<string, { width: number; height: number; widths: number[]; jpeg?: number }>();
  const rows = await q<{ asset_id: string; width: number; height: number; format: string; aw: number; ah: number; focal_x: number; focal_y: number }>(
    `SELECT v.asset_id, v.width, v.height, v.format, a.width AS aw, a.height AS ah, a.focal_x, a.focal_y
       FROM media_variants v JOIN media_assets a ON a.id = v.asset_id
      WHERE v.asset_id = ANY($1::uuid[]) AND a.state = 'ready' AND a.deleted_at IS NULL`,
    [assetIds],
  );
  const map = new Map<string, { width: number; height: number; widths: number[]; jpeg?: number }>();
  for (const r of rows) {
    const m = map.get(r.asset_id) ?? { width: r.aw, height: r.ah, widths: [] as number[] };
    if (r.format === "webp") m.widths.push(r.width);
    if (r.format === "jpeg") m.jpeg = r.width;
    map.set(r.asset_id, m);
  }
  for (const m of map.values()) m.widths.sort((a, b) => a - b);
  return map;
}

/** Permanently delete an asset — refused when any published entry or public setting uses it (M06). */
export async function purgeAsset(assetId: string): Promise<{ ok: boolean; error?: string }> {
  const used = await q<{ owner_kind: string; owner_id: string; in_published: boolean }>(
    `SELECT owner_kind, owner_id, in_published FROM media_usage WHERE asset_id = $1`,
    [assetId],
  );
  if (used.some((u) => u.in_published)) return { ok: false, error: "This photo is used by published content." };
  if (used.length) return { ok: false, error: "This photo is still used in a draft. Remove it there first." };
  const asset = await q1<{ original_key: string }>(`SELECT original_key FROM media_assets WHERE id = $1`, [assetId]);
  if (!asset) return { ok: true };
  const variants = await q<{ key: string }>(`SELECT key FROM media_variants WHERE asset_id = $1`, [assetId]);
  for (const v of variants) await deleteObject(v.key).catch(() => {});
  await deleteObject(asset.original_key).catch(() => {});
  await q(`DELETE FROM media_assets WHERE id = $1`, [assetId]);
  return { ok: true };
}
