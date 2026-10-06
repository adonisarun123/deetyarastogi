import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
import { opsEvent } from "@/lib/ops";

export const maxDuration = 60;

// Retention defaults (PRD §16): trash 30 days, draft snapshots 30 days, contact messages 90 days
// unless kept, audit 90 days, abandoned uploads 7 days. Protected by CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const out: Record<string, number> = {};
  const count = async (label: string, sql: string) => {
    const r = await q(sql);
    out[label] = r.length;
  };
  await count("trashedEntries", `DELETE FROM entries WHERE state = 'trashed' AND trashed_at < now() - interval '30 days' RETURNING id`);
  await count(
    "staleUsage",
    `DELETE FROM media_usage u WHERE u.owner_kind = 'entry' AND NOT EXISTS (SELECT 1 FROM entries e WHERE e.id::text = u.owner_id) RETURNING asset_id`,
  );
  await count(
    "oldSnapshots",
    `DELETE FROM entry_revisions r WHERE r.kind IN ('snapshot', 'published') AND r.created_at < now() - interval '30 days'
       AND NOT EXISTS (SELECT 1 FROM entries e WHERE e.published_revision_id = r.id OR e.working_revision_id = r.id)
     RETURNING id`,
  );
  await count("messages", `DELETE FROM contact_requests WHERE NOT keep AND created_at < now() - interval '90 days' RETURNING id`);
  await count("audit", `DELETE FROM audit_events WHERE created_at < now() - interval '90 days' RETURNING id`);
  await count("sessions", `DELETE FROM sessions WHERE expires_at < now() RETURNING id`);
  await count("invites", `DELETE FROM invites WHERE expires_at < now() - interval '7 days' RETURNING id`);
  await count("rateLimits", `DELETE FROM rate_limits WHERE window_start < now() - interval '1 day' RETURNING key`);
  await count("previewTokens", `DELETE FROM preview_tokens WHERE expires_at < now() RETURNING token_hash`);

  // Abandoned, unreferenced uploads older than 7 days.
  const abandoned = await q<{ id: string; original_key: string }>(
    `SELECT a.id, a.original_key FROM media_assets a
      WHERE a.state IN ('uploading', 'failed') AND a.created_at < now() - interval '7 days'
        AND NOT EXISTS (SELECT 1 FROM media_usage u WHERE u.asset_id = a.id)`,
  );
  for (const a of abandoned) {
    try {
      const vars = await q<{ key: string }>(`SELECT key FROM media_variants WHERE asset_id = $1`, [a.id]);
      for (const v of vars) await deleteObject(v.key).catch(() => {});
      await deleteObject(a.original_key).catch(() => {});
      await q(`DELETE FROM media_assets WHERE id = $1`, [a.id]);
    } catch (e) {
      await opsEvent("cleanup_failed", a.id, (e as Error).message);
    }
  }
  out.abandonedUploads = abandoned.length;
  return NextResponse.json({ ok: true, ...out });
}
