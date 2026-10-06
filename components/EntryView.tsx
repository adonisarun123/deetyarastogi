import Link from "next/link";
import type { Card } from "@/lib/content/public";
import {
  type EntryContent,
  type EntryType,
  CONTEXT_LABEL,
  CONTRIBUTION_LABEL,
  TYPE_LABEL,
  TYPE_PATH,
  TYPE_PLURAL,
} from "@/lib/content/types";
import { formatDate, isoDuration, minutesLabel, stripInline } from "@/lib/text";
import { Blocks, VideoEmbed, galleryItems, tocFromBlocks, type MediaMap } from "./Blocks";
import { Breadcrumbs } from "./Breadcrumbs";
import { Gallery } from "./Gallery";
import { Img, mediaUrl } from "./Img";
import { Inline } from "./Inline";
import { JsonLd } from "./JsonLd";
import { CardGrid } from "./Card";
import { IngredientCheck, ResetProgress, StepItem } from "./RecipeProgress";
import { PrintButton, ShareButton } from "./ShareButton";

export interface EntryViewProps {
  type: EntryType;
  slug: string;
  content: EntryContent;
  media: MediaMap;
  authorName: string;
  firstPublishedAt: string | null;
  updatedAt: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  tags: { name: string; slug: string }[];
  related: Card[];
  siteUrl: string;
  preview?: boolean;
}

function absolute(siteUrl: string, path: string) {
  return `${siteUrl}${path}`;
}

export function EntryView(p: EntryViewProps) {
  const { type, content: c, media } = p;
  const path = `/${TYPE_PATH[type]}/${p.slug}`;
  const url = absolute(p.siteUrl, path);
  const coverPl = c.cover ?? (type === "story" ? c.gallery[0] : null) ?? c.video?.cover ?? null;
  const coverInfo = coverPl ? media.get(coverPl.assetId) : undefined;
  const ogImage = coverPl && coverInfo?.jpeg ? absolute(p.siteUrl, mediaUrl(coverPl.assetId, coverInfo.jpeg, "jpg")) : undefined;
  const toc = type === "journal" ? tocFromBlocks(c.blocks) : [];
  const r = c.recipe;
  const showUpdated = p.updatedAt && p.firstPublishedAt && formatDate(p.updatedAt) !== formatDate(p.firstPublishedAt);

  const storyImages = type === "story" ? [c.cover, ...c.gallery].filter((x, i, arr) => x && arr.findIndex((y) => y?.assetId === x.assetId) === i) : [];

  const jsonLd: unknown[] = [];
  if (!p.preview) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absolute(p.siteUrl, "/") },
        { "@type": "ListItem", position: 2, name: TYPE_PLURAL[type], item: absolute(p.siteUrl, `/${TYPE_PATH[type]}`) },
        { "@type": "ListItem", position: 3, name: c.title, item: url },
      ],
    });
    const author = { "@type": "Person", name: p.authorName, url: absolute(p.siteUrl, "/about") };
    if (type === "recipe" && r) {
      const video =
        r.video && r.video.uploadDate && ogImage
          ? {
              "@type": "VideoObject",
              name: r.video.title || c.title,
              description: r.video.description || c.summary,
              thumbnailUrl: [ogImage],
              uploadDate: r.video.uploadDate,
              embedUrl: `https://www.youtube-nocookie.com/embed/${r.video.youtubeId}`,
              contentUrl: r.video.sourceUrl,
            }
          : undefined;
      jsonLd.push({
        "@context": "https://schema.org",
        "@type": "Recipe",
        name: c.title,
        description: c.summary,
        image: ogImage ? [ogImage] : undefined,
        author,
        datePublished: p.firstPublishedAt ?? undefined,
        dateModified: p.updatedAt ?? undefined,
        recipeYield: `${r.yieldAmount} ${r.yieldUnit}`.trim(),
        prepTime: isoDuration(r.prepMinutes),
        cookTime: isoDuration(r.cookMinutes),
        totalTime: isoDuration(r.totalMinutes),
        recipeCategory: p.categoryName ?? undefined,
        keywords: p.tags.map((t) => t.name).join(", ") || undefined,
        recipeIngredient: r.groups.flatMap((g) => g.items.filter((i) => i.name.trim()).map((i) => [i.quantity, i.unit, i.name, i.note ? `(${i.note})` : ""].filter(Boolean).join(" "))),
        recipeInstructions: r.steps
          .filter((s) => s.text.trim())
          .map((s, i) => ({ "@type": "HowToStep", name: s.heading || undefined, text: stripInline(s.text), url: `${url}#step-${s.id}`, position: i + 1 })),
        video,
      });
    } else if (type === "video" && c.video) {
      // Only emit VideoObject when the upload date is genuinely known (never the scrapbook date).
      if (c.video.uploadDate && ogImage) {
        jsonLd.push({
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: c.title,
          description: c.summary || c.video.description,
          thumbnailUrl: [ogImage],
          uploadDate: c.video.uploadDate,
          embedUrl: `https://www.youtube-nocookie.com/embed/${c.video.youtubeId}`,
          contentUrl: c.video.sourceUrl,
        });
      }
    } else {
      jsonLd.push({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: c.title,
        description: c.summary,
        image: ogImage ? [ogImage] : undefined,
        author,
        datePublished: p.firstPublishedAt ?? undefined,
        dateModified: p.updatedAt ?? undefined,
        mainEntityOfPage: url,
      });
    }
  }

  return (
    <article>
      {jsonLd.map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <header className="entry-head">
        <div className="container">
          <Breadcrumbs
            items={[
              { href: "/", label: "Home" },
              { href: `/${TYPE_PATH[type]}`, label: TYPE_PLURAL[type] },
              { label: c.title || "Untitled" },
            ]}
          />
          <div style={{ marginTop: 20 }} className="row">
            <span className="label" data-type={type}>
              {TYPE_LABEL[type]}
            </span>
            {p.categoryName && p.categorySlug ? (
              <Link href={`/scrapbook?category=${p.categorySlug}`} className="muted" style={{ fontSize: "0.95rem" }}>
                {p.categoryName}
              </Link>
            ) : null}
          </div>
          <h1>{c.title || "Untitled"}</h1>
          {c.summary ? <p className="lede">{c.summary}</p> : null}
          <div className="byline">
            <span>
              By <strong>{p.authorName}</strong>
            </span>
            {p.firstPublishedAt ? (
              <span>
                Published <time dateTime={p.firstPublishedAt}>{formatDate(p.firstPublishedAt)}</time>
              </span>
            ) : (
              <span>Not published yet</span>
            )}
            {showUpdated ? (
              <span>
                Updated <time dateTime={p.updatedAt!}>{formatDate(p.updatedAt)}</time>
              </span>
            ) : null}
            {!p.preview ? <ShareButton url={url} title={c.title} /> : null}
          </div>
          <p className="print-only">{url}</p>

          {type === "recipe" && r ? (
            <>
              <dl className="facts" style={{ marginTop: 24 }}>
                {r.yieldAmount ? (
                  <div>
                    <dt>Makes</dt>
                    <dd>
                      {r.yieldAmount} {r.yieldUnit}
                    </dd>
                  </div>
                ) : null}
                {r.prepMinutes ? (
                  <div>
                    <dt>Prep</dt>
                    <dd>{minutesLabel(r.prepMinutes)}</dd>
                  </div>
                ) : null}
                {r.cookMinutes ? (
                  <div>
                    <dt>Bake / cook</dt>
                    <dd>{minutesLabel(r.cookMinutes)}</dd>
                  </div>
                ) : null}
                {r.chillMinutes ? (
                  <div>
                    <dt>Chill</dt>
                    <dd>{minutesLabel(r.chillMinutes)}</dd>
                  </div>
                ) : null}
                {r.restMinutes ? (
                  <div>
                    <dt>Prove / rest</dt>
                    <dd>{minutesLabel(r.restMinutes)}</dd>
                  </div>
                ) : null}
                {r.coolMinutes ? (
                  <div>
                    <dt>Cool</dt>
                    <dd>{minutesLabel(r.coolMinutes)}</dd>
                  </div>
                ) : null}
                {r.totalMinutes ? (
                  <div>
                    <dt>Total</dt>
                    <dd>{minutesLabel(r.totalMinutes)}</dd>
                  </div>
                ) : null}
                {r.difficulty ? (
                  <div>
                    <dt>Level</dt>
                    <dd>{r.difficulty}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="recipe-actions">
                <a href="#recipe" className="btn btn-small">
                  Jump to recipe
                </a>
                <a href="#ingredients" className="btn btn-quiet btn-small">
                  Ingredients
                </a>
                <a href="#method" className="btn btn-quiet btn-small">
                  Method
                </a>
                <PrintButton />
              </div>
            </>
          ) : null}
        </div>
      </header>

      {/* Main visual */}
      {type === "video" && c.video ? (
        <div className="container" style={{ maxWidth: c.video.format === "portrait" ? 520 : 1000 }}>
          <VideoEmbed video={c.video} media={media} fallbackCover={c.cover} title={c.title} />
        </div>
      ) : coverPl && coverInfo && type !== "story" ? (
        <div className={`container ${type === "recipe" ? "recipe-hero-img" : "hero-media"}`}>
          <figure style={{ margin: 0 }}>
            <Img placement={coverPl} info={coverInfo} sizes="(min-width: 1260px) 1200px, 94vw" priority className="figure" />
            {coverPl.caption ? <figcaption>{coverPl.caption}</figcaption> : null}
          </figure>
        </div>
      ) : null}

      {type === "story" && storyImages.length ? (
        <div className="container hero-media story-lead" style={{ maxWidth: 1080 }}>
          {storyImages[0] && media.get(storyImages[0].assetId) ? (
            <figure style={{ margin: 0 }}>
              <Img placement={storyImages[0]} info={media.get(storyImages[0].assetId)} sizes="(min-width: 1140px) 1080px, 94vw" priority className="figure" />
              {storyImages[0].caption || storyImages[0].credit ? (
                <figcaption>
                  {storyImages[0].caption}
                  {storyImages[0].credit ? <span> · Photo: {storyImages[0].credit}</span> : null}
                </figcaption>
              ) : null}
            </figure>
          ) : null}
        </div>
      ) : null}

      <div className="section" style={{ paddingTop: 40 }}>
        <div className="container">
          {type === "story" && (c.context || c.contribution) ? (
            <p className="row" style={{ marginBottom: 24 }}>
              {c.context ? <span className="label">{CONTEXT_LABEL[c.context]}</span> : null}
              {c.contribution ? <span className="label" data-type="journal">{CONTRIBUTION_LABEL[c.contribution]}</span> : null}
            </p>
          ) : null}

          {toc.length >= 3 ? (
            <nav className="toc no-print" aria-labelledby="toc-h" style={{ maxWidth: "68ch", marginBottom: 32 }}>
              <h2 id="toc-h">In this post</h2>
              <ol>
                {toc.map((t) => (
                  <li key={t.id} className={t.level === 3 ? "lvl-3" : undefined}>
                    <a href={`#${t.anchor}`}>{t.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}

          {c.blocks.length ? (
            <div className="prose">
              <Blocks blocks={c.blocks} media={media} title={c.title} />
            </div>
          ) : null}

          {type === "video" && c.video ? (
            <div className="prose" style={{ marginTop: c.blocks.length ? 32 : 0 }}>
              {c.video.description && c.video.description !== c.summary ? (
                <p>
                  <Inline text={c.video.description} />
                </p>
              ) : null}
              {c.video.madeByMe === false && c.video.attribution ? (
                <p className="muted">Video created by {c.video.attribution}. Shared here with credit.</p>
              ) : null}
              {c.video.transcript ? (
                <details className="panel">
                  <summary style={{ cursor: "pointer", fontWeight: 600, minHeight: 44, display: "flex", alignItems: "center" }}>
                    Read the transcript
                  </summary>
                  <div style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{c.video.transcript}</div>
                </details>
              ) : null}
            </div>
          ) : null}

          {type === "story" && storyImages.length > 1 ? (
            <section aria-labelledby="gallery-h" style={{ marginTop: 40 }}>
              <h2 id="gallery-h" style={{ fontSize: "clamp(1.5rem,2.6vw,2rem)" }}>
                The bake in pictures
              </h2>
              <Gallery items={galleryItems(storyImages.slice(1) as typeof c.gallery, media)} />
            </section>
          ) : null}

          {c.learningNote ? (
            <section className="learn-note" aria-labelledby="learnt-h" style={{ marginTop: 40, maxWidth: 820 }}>
              <h2 id="learnt-h">What I learnt</h2>
              <p style={{ margin: 0 }}>
                <Inline text={c.learningNote} />
              </p>
            </section>
          ) : null}

          {type === "recipe" && r ? <RecipeBody {...p} url={url} /> : null}

          {c.attribution ? (
            <p className="muted" style={{ marginTop: 32, maxWidth: "68ch" }}>
              <Inline text={c.attribution} />
            </p>
          ) : null}

          {p.tags.length ? (
            <div style={{ marginTop: 40 }} className="no-print">
              <h2 className="sr-only">Tags</h2>
              <ul className="tag-list">
                {p.tags.map((t) => (
                  <li key={t.slug}>
                    <Link href={`/scrapbook?tag=${t.slug}`}>{t.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {p.related.length ? (
        <section className="section surface-pink related" aria-labelledby="related-h" style={{ paddingTop: 64 }}>
          <div className="container">
            <div className="section-head">
              <h2 id="related-h">More from the scrapbook</h2>
            </div>
            <CardGrid cards={p.related} />
          </div>
        </section>
      ) : null}
    </article>
  );
}

function RecipeBody(p: EntryViewProps & { url: string }) {
  const r = p.content.recipe!;
  const key = p.slug;
  const notes = [
    ["Troubleshooting", r.notes.troubleshooting],
    ["Common mistakes", r.notes.mistakes],
    ["Substitutions", r.notes.substitutions],
    ["Storage", r.notes.storage],
    ["Serving suggestions", r.notes.serving],
  ].filter(([, v]) => v.trim());
  return (
    <section id="recipe" aria-labelledby="recipe-h" style={{ marginTop: p.content.blocks.length ? 56 : 0 }}>
      <div className="spread" style={{ marginBottom: 20 }}>
        <h2 id="recipe-h" style={{ margin: 0, color: "var(--cherry)" }}>
          The recipe
        </h2>
        <span className="row no-print">
          <ResetProgress storageKey={key} />
          <PrintButton />
        </span>
      </div>
      {r.panSize ? (
        <p>
          <strong>Pan:</strong> {r.panSize}
        </p>
      ) : null}
      <div className="recipe-layout">
        <div className="ingredients">
          <div className="recipe-card" id="ingredients">
            <h2>Ingredients</h2>
            {r.groups
              .filter((g) => g.items.some((i) => i.name.trim()))
              .map((g) => (
                <div key={g.id}>
                  {g.name ? <h3>{g.name}</h3> : null}
                  <ul className="ing-list">
                    {g.items
                      .filter((i) => i.name.trim())
                      .map((i) => (
                        <li key={i.id}>
                          <IngredientCheck storageKey={key} id={i.id}>
                            {i.quantity || i.unit ? (
                              <span className="qty">
                                {[i.quantity, i.unit].filter(Boolean).join(" ")}{" "}
                              </span>
                            ) : null}
                            {i.name}
                            {i.note ? <span className="prep">, {i.note}</span> : null}
                          </IngredientCheck>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            {r.equipment.filter(Boolean).length ? (
              <>
                <h3>Equipment</h3>
                <ul className="eq-list">
                  {r.equipment.filter(Boolean).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {r.dietary.length ? (
              <p style={{ marginTop: 16, fontSize: "0.9rem" }}>
                <strong>Dietary notes:</strong> {r.dietary.join(", ")}.{" "}
                <span className="muted">Labels are my own notes, not a guarantee — please check every ingredient for allergies.</span>
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <h2 id="method" style={{ fontSize: "clamp(1.5rem,2.6vw,2rem)", color: "var(--cherry)" }}>
            Method
          </h2>
          <ol className="method">
            {r.steps
              .filter((s) => s.text.trim())
              .map((s) => {
                const info = s.image ? p.media.get(s.image.assetId) : undefined;
                return (
                  <StepItem key={s.id} storageKey={key} id={s.id}>
                    {s.heading ? <h3>{s.heading}</h3> : null}
                    <p style={{ margin: 0 }}>
                      <Inline text={s.text} />
                    </p>
                    {s.temperature || s.durationMinutes || s.appliance || s.videoTime ? (
                      <div className="step-meta">
                        {s.appliance ? <span>{s.appliance}</span> : null}
                        {s.temperature && s.temperatureUnit ? (
                          <span>
                            {s.temperature}°{s.temperatureUnit}
                          </span>
                        ) : null}
                        {s.durationMinutes ? <span>⏱ {minutesLabel(s.durationMinutes)}</span> : null}
                        {s.videoTime ? <span>▶ Video at {s.videoTime}</span> : null}
                      </div>
                    ) : null}
                    {s.image && info ? <Img placement={s.image} info={info} sizes="(min-width: 960px) 600px, 88vw" /> : null}
                  </StepItem>
                );
              })}
          </ol>
        </div>
      </div>

      {notes.length ? (
        <div className="recipe-notes" style={{ marginTop: 40 }}>
          {notes.map(([label, v]) => (
            <div key={label} className="note-block">
              <strong className="note-label">{label}</strong>
              <Inline text={v} />
            </div>
          ))}
        </div>
      ) : null}

      {r.video ? (
        <section aria-labelledby="watch-h" style={{ marginTop: 48, maxWidth: r.video.format === "portrait" ? 420 : 860 }}>
          <h2 id="watch-h" style={{ fontSize: "clamp(1.5rem,2.6vw,2rem)" }}>
            Watch it being made
          </h2>
          <VideoEmbed video={r.video} media={p.media} fallbackCover={p.content.cover} title={p.content.title} />
          <p className="print-only">Video: {r.video.sourceUrl}</p>
        </section>
      ) : null}

      {r.adaptedFrom || r.sourceUrl ? (
        <p style={{ marginTop: 32 }} className="muted">
          {r.adaptedFrom ? <>Adapted from {r.adaptedFrom}. </> : null}
          {r.sourceUrl ? (
            <a href={r.sourceUrl} rel="noopener noreferrer nofollow" target="_blank">
              Original source<span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
