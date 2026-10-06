import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiUser, HttpError } from "@/lib/auth/session";
import { q, tx } from "@/lib/db";
import { audit, handle, noStore, readJson } from "@/lib/ops";
import { getPrivateSettings, normaliseProfile, normaliseSettings, saveProfile, saveSettings } from "@/lib/site";
import { clampText } from "@/lib/text";
import { isUuid } from "@/lib/content/sanitize";
import { OWNER_MFA_REQUIRED } from "@/lib/auth/owner";

// Homepage settings, public profile and experience entries (author + owner).
// Private owner settings (inbox, integrations) are only writable by the owner.

const KINDS = new Set(["interest", "training", "internship", "next", "other"]);

export const PUT = handle(async (req: Request) => {
  const user = await apiUser(req);
  const b = await readJson(req, 500_000);
  const section = String(b.section ?? "");

  if (section === "settings") {
    const s = normaliseSettings(b.data);
    // Only published entries can be featured.
    const valid = s.featuredIds.length
      ? (await q<{ entry_id: string }>(`SELECT entry_id FROM public_entries WHERE entry_id = ANY($1::uuid[])`, [s.featuredIds])).map((r) => r.entry_id)
      : [];
    s.featuredIds = s.featuredIds.filter((id) => valid.includes(id));
    const priv = await getPrivateSettings();
    if (user.role !== "owner") {
      // Authors may not change the site URL (owner domain setting).
      const cur = normaliseSettings((await q<{ data: unknown }>(`SELECT data FROM site_settings WHERE id = 1`))[0]?.data);
      s.siteUrl = cur.siteUrl;
    }
    await saveSettings(user.id, s, priv);
    await audit(user.id, "settings.update", "settings", "1");
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, data: s }, { headers: noStore });
  }

  if (section === "private") {
    if (user.role !== "owner") throw new HttpError(403, "Only the owner can change inbox and integration settings.");
    if (OWNER_MFA_REQUIRED && !user.totpEnabled) throw new HttpError(403, "Turn on two-step sign-in first.");
    const p = (b.data ?? {}) as Record<string, unknown>;
    const inbox = clampText(p.inboxEmail, 200).trim();
    if (inbox && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inbox)) throw new HttpError(400, "The inbox email doesn’t look right.");
    const hook = clampText(p.notifyWebhook, 400).trim();
    if (hook && !/^https:\/\//.test(hook)) throw new HttpError(400, "The webhook must start with https://");
    await q(`UPDATE site_settings SET data = jsonb_set(data, '{private}', $1::jsonb), updated_at = now(), updated_by = $2 WHERE id = 1`, [
      JSON.stringify({ inboxEmail: inbox, notifyWebhook: hook }),
      user.id,
    ]);
    await audit(user.id, "settings.private_update", "settings", "1");
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  if (section === "profile") {
    const p = normaliseProfile(b.data);
    await saveProfile(user.id, p);
    await audit(user.id, "profile.update", "profile", "1");
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, data: p }, { headers: noStore });
  }

  if (section === "experiences") {
    const items = (Array.isArray(b.data) ? b.data : []).slice(0, 30) as Record<string, unknown>[];
    await tx(async (db) => {
      const keep: string[] = [];
      for (const [i, x] of items.entries()) {
        const kind = KINDS.has(String(x.kind)) ? String(x.kind) : "other";
        const title = clampText(x.title, 160).trim();
        if (!title) continue;
        const details = (Array.isArray(x.details) ? x.details : []).map((d) => clampText(d, 300).trim()).filter(Boolean).slice(0, 12);
        const vals = [kind, title, clampText(x.organisation, 160) || null, clampText(x.role, 160) || null, clampText(x.period, 80) || null, clampText(x.description, 1500) || null, JSON.stringify(details), Boolean(x.is_public), i];
        if (isUuid(x.id)) {
          const r = await db.query(
            `UPDATE experiences SET kind=$2, title=$3, organisation=$4, role=$5, period=$6, description=$7, details=$8, is_public=$9, display_order=$10, updated_at=now()
              WHERE id = $1 RETURNING id`,
            [x.id, ...vals],
          );
          if (r.rows[0]) {
            keep.push(String(x.id));
            continue;
          }
        }
        const r = await db.query<{ id: string }>(
          `INSERT INTO experiences (kind, title, organisation, role, period, description, details, is_public, display_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          vals,
        );
        keep.push(r.rows[0].id);
      }
      await db.query(`DELETE FROM experiences WHERE NOT (id = ANY($1::uuid[]))`, [keep]);
    });
    await audit(user.id, "experiences.update", "experience", null, { count: items.length });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true }, { headers: noStore });
  }

  throw new HttpError(400, "Unknown section.");
});
