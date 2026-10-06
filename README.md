# Deetya Bakes — the Baking Scrapbook

A personal publishing site for a young baker, plus a private studio where she publishes it herself. It's built from *Baking_Scrapbook_Product_Requirements* (the governing spec) and *Baking_Portfolio_IA_and_Design_Spec* (the Option 1 visual direction).

- **Public site:** Home, Scrapbook feed, Photo stories (`/bakes`), Recipes, Videos, Tips, Journal, About, Contact, Privacy and Search, in the scrapbook design (buttercream, cherry and pistachio, with Fraunces, DM Sans and Caveat type).
- **Studio** (`/dashboard`): invite-only accounts with owner two-step sign-in. It has an editor with autosave and conflict detection, a media library (JPEG, PNG, WebP and HEIC, with EXIF/GPS stripped), structured recipes, YouTube by link, preview, publishing with revisions, unpublish, trash and restore, categories and tags with merge, an inbox, an audit log and export.

> **No real content is included.** The PRD forbids invented posts on the live site, so empty sections hide themselves. Working brand: “Deetya Bakes”. Change it in **Studio → Homepage**.

## Stack decision (PRD §13 asks for this to be documented)

| Layer | Choice | Why |
|---|---|---|
| App + public rendering | Next.js 16 (App Router), server-rendered per request | Unpublish removes content at once (E07 well under 60 s); no stale caches to purge |
| Database | Neon Postgres (project `polished-cloud-92667396`) | Branching gives staging and point-in-time restore |
| Photos | Neon Object Storage, **private** bucket `media` (declared in `neon.ts`) | The app serves only derivatives used by live content, so originals are never public |
| Image processing | `sharp` (+ `heic-convert` for iPhone HEIC) | Auto-orients, strips all metadata, makes responsive WebP plus a JPEG for social previews |
| Auth | Built in: scrypt passwords, DB sessions, TOTP two-step for the owner | No extra vendor; invite-only; sessions can be revoked at once |
| Hosting | **Vercel** (recommended). `neon deploy` does **not** host Next.js | Server actions, cron, `sharp` and 60 s functions are all supported |
| Email (optional) | Resend via `RESEND_API_KEY` | Messages are always stored in the studio inbox anyway |

**Recurring cost assumptions:** the Neon free tier covers Postgres and Object Storage at this scale (2 editors, ≤2,000 entries, ≤10,000 images). Check current Neon storage limits before launch. Vercel Hobby is free for personal, non-commercial use. A custom domain costs about ₹1,000/yr. Resend has a free tier. **The owner should hold every account** (Neon, Vercel, domain, GitHub).

## First-time setup (Neon)

```bash
npm install
npm i -g neon@latest && neon login          # opens a browser to approve
neon link --project-id polished-cloud-92667396 --branch production -y
neon deploy                                  # provisions the private "media" bucket; writes .env.local
npm run db:migrate                           # creates the tables
npm run storage:cors -- https://YOUR-DOMAIN   # lets browsers upload straight to the bucket
npm run invite -- parent@example.com owner   # prints a one-time link (72 h) to set the owner password
npm run dev
```

Open the invite link, choose a password, then go to **Account** and turn on two-step sign-in. Owner tools stay locked until you do. Invite the baker from **Owner settings → Invite someone** with the *Baker / author* role.

## Deploy (Vercel)

1. Import this GitHub repo in Vercel.
2. Add the environment variables from `.env.example`. Copy the Neon values from `.env.local` after `neon deploy`, or use `neon env pull`. Set `SITE_URL`, a long random `SESSION_SECRET`, `RATE_LIMIT_SALT` and `CRON_SECRET`.
3. The build command is `npm run vercel-build`. It runs migrations, then `next build`.
4. Keep `ALLOW_INDEXING=false` on preview deployments. Set it to `true` only on production, at launch.
5. Re-run `npm run storage:cors -- https://your-domain https://your-project.vercel.app`.

The daily cron (`vercel.json`) enforces the retention rules: trash after 30 days, draft snapshots after 30 days, messages after 90 days unless kept, audit after 90 days, and abandoned uploads after 7 days.

## Day-to-day (for the baker)

**Studio → Start something new** → choose a type → fill it in. It saves itself 3 seconds after you stop typing, and the bar at the bottom always tells the truth: *Saved 14:02:11*, *Saving…*, *Save failed* or *Offline*. **Preview** shows desktop and mobile with the real public design. **Publish…** lists anything missing; tap an item to jump to that field. Editing a live entry doesn't change the public page until **Update published entry**.

Photos: **Choose photos** works from a phone. HEIC is fine. The limits are 20 MB each, 80 megapixels and 20 at a time. Every photo needs a short description (alt text) before it can go live.

## Operations

| Task | How |
|---|---|
| Content export (JSON: entries, all revisions, recipes, taxonomy, slugs, relationships, media manifest) | Owner settings → *Download full content export* |
| Photo backup | `npm run backup:media -- ./backup/media` |
| Restore into a separate environment | Create a Neon branch → `npm run db:migrate` → `npm run restore -- export.json --media-dir ./backup/media` |
| Database point-in-time restore | Neon console → Branches → Restore (the history window depends on the plan) |
| Roll back a deploy | Vercel → Deployments → *Promote* a previous build. The DB schema is additive |
| Clear public caches | Not needed: public pages render per request. Media has `s-maxage=60` |
| Monitoring | Upload, publish and email failures appear in *Overview → Needs attention* and *Owner settings → System problems*. Add Vercel log drains or alerts for app errors |

## Tests

```bash
npm run test:unit                    # URL parsing, recipe/publish validation, sanitising, safe links
npm run test:e2e                     # 68 acceptance checks against a running server (NOT production)
```

The e2e suite covers AT01–AT03, AT05–AT07, AT09, AT11–AT17, AT19–AT21, AT23 and AT24 at API/HTML level. Last local run: **68 passed, 0 failed**. Fixtures include a JPEG with GPS and rotation EXIF, PNG, WebP, a real HEIC and a disguised non-image.

## Known limits and deviations (accept or ask for changes)

- **Needs real-device testing:** the PRD requires a HEIC from *her* phone (AT02), touch/keyboard reordering on a phone (AT04), a print check (AT08), a check of a private or embed-blocked video (AT06), 200% zoom and 320 px (AT18), and field Core Web Vitals (AT22). These need a browser and device, not a script.
- **Image cropping** uses focal points (tap the photo, or choose Top/Centre/…) with consistent 4:3 card crops, not a freehand crop tool.
- **Rich text** is a structured block editor. Paragraph formatting is bold, italic and links (stored as safe markup). Pasting arrives as clean text.
- **YouTube metadata** is not fetched automatically (that would need a Google API key). Title, description and cover come from her. VideoObject markup appears only when she enters the real upload date.
- **Email delivery** of new notes needs `RESEND_API_KEY`. Without it, notes are stored and shown in the studio inbox, and the visitor is told only that the note was received.
- **Analytics** are off. Nothing tracks visitors.
- P1 items (scheduling, collections, newsletter, ingredient scaling, direct YouTube upload) are not built, as the spec says.

## Content still needed before launch (PRD §21)

Chosen public name and domain, approved photos, two real recipes, one article, one tip, one playable YouTube link, confirmed training and internship details (only verified facts may be marked *Show publicly*), the bio and three "About" answers, approved social links, the parent-managed email, and an optional gift note.
