import { NextResponse } from "next/server";
import { apiUser, HttpError } from "@/lib/auth/session";
import { q, q1 } from "@/lib/db";
import { handle, noStore, readJson } from "@/lib/ops";
import { ACCEPTED_MIME, MAX_BYTES, MAX_FILES } from "@/lib/media";
import { presignUpload } from "@/lib/storage";

// GET: media library (search, paging). POST: initiate uploads (short-lived direct upload URLs).

export const GET = handle(async (req: Request) => {
  await apiUser(req);
  const url = new URL(req.url);
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const filter = url.searchParams.get("filter") ?? "";
  const where = ["a.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (search) {
    params.push(`%${search.replace(/[%_\\]/g, "\\$&")}%`);
    where.push(`(a.default_alt ILIKE $${params.length} OR a.default_caption ILIKE $${params.length} OR a.original_name ILIKE $${params.length})`);
  }
  if (filter === "unused") where.push(`NOT EXISTS (SELECT 1 FROM media_usage u WHERE u.asset_id = a.id)`);
  if (filter === "failed") where.push(`a.state = 'failed'`);
  const rows = await q(
    `SELECT a.id, a.state, a.error, a.width, a.height, a.bytes, a.default_alt, a.default_caption, a.credit, a.focal_x, a.focal_y,
            a.original_name, a.created_at,
            (SELECT coalesce(array_agg(width ORDER BY width), '{}') FROM media_variants v WHERE v.asset_id = a.id AND v.format = 'webp') AS widths,
            (SELECT count(*) FROM media_usage u WHERE u.asset_id = a.id) AS usage_count,
            (SELECT bool_or(in_published) FROM media_usage u WHERE u.asset_id = a.id) AS used_publicly,
            count(*) OVER() AS total
       FROM media_assets a WHERE ${where.join(" AND ")}
      ORDER BY a.created_at DESC LIMIT 48 OFFSET ${(page - 1) * 48}`,
    params,
  );
  return NextResponse.json({ items: rows, total: Number((rows[0] as { total?: string })?.total ?? 0), page }, { headers: noStore });
});

export const POST = handle(async (req: Request) => {
  const user = await apiUser(req);
  const body = await readJson(req, 50_000);
  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length) throw new HttpError(400, "Choose at least one photo.");
  if (files.length > MAX_FILES) throw new HttpError(400, `Choose up to ${MAX_FILES} photos at a time.`);

  const results = [];
  for (const raw of files) {
    const f = raw as Record<string, unknown>;
    const name = String(f.name ?? "photo").slice(0, 200);
    const size = Number(f.size ?? 0);
    const mime = String(f.type ?? "").toLowerCase();
    const requestId = String(f.requestId ?? "").slice(0, 80);
    const ext = name.toLowerCase().split(".").pop() ?? "";
    const okType = ACCEPTED_MIME.includes(mime) || ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext);
    if (!okType) {
      results.push({ requestId, error: "Only JPEG, PNG, WebP or HEIC photos can be uploaded." });
      continue;
    }
    if (!Number.isFinite(size) || size <= 0) {
      results.push({ requestId, error: "This file looks empty." });
      continue;
    }
    if (size > MAX_BYTES) {
      results.push({ requestId, error: "This photo is larger than 20 MB." });
      continue;
    }
    // Idempotent per client requestId: re-initiating returns the same asset.
    const existing = requestId
      ? await q1<{ id: string; original_key: string; state: string }>(`SELECT id, original_key, state FROM media_assets WHERE upload_request = $1`, [requestId])
      : null;
    let id: string;
    let key: string;
    if (existing) {
      id = existing.id;
      key = existing.original_key;
      if (existing.state === "ready") {
        results.push({ requestId, assetId: id, alreadyReady: true });
        continue;
      }
    } else {
      const row = await q1<{ id: string }>(
        `INSERT INTO media_assets (original_key, original_name, mime, bytes, state, upload_request, created_by)
         VALUES ('pending', $1, $2, $3, 'uploading', $4, $5) RETURNING id`,
        [name, mime || "application/octet-stream", size, requestId || null, user.id],
      );
      id = row!.id;
      key = `originals/${id}`;
      await q(`UPDATE media_assets SET original_key = $2 WHERE id = $1`, [id, key]);
    }
    const contentType = mime && ACCEPTED_MIME.includes(mime) ? mime : "application/octet-stream";
    const up = await presignUpload(key, contentType);
    results.push({ requestId, assetId: id, uploadUrl: up.url, method: up.method, contentType });
  }
  return NextResponse.json({ results }, { headers: noStore });
});
