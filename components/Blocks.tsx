import type { Block, MediaPlacement, VideoRef } from "@/lib/content/types";
import { headingAnchor, stripInline } from "@/lib/text";
import { watchUrl } from "@/lib/youtube";
import { Inline } from "./Inline";
import { Img, mediaUrl, pickWidth, type VariantInfo } from "./Img";
import { Gallery, type GalleryItem } from "./Gallery";
import { YouTubePlayer } from "./YouTubePlayer";

export type MediaMap = Map<string, VariantInfo>;

export function galleryItems(images: MediaPlacement[], media: MediaMap): GalleryItem[] {
  return images
    .filter((p) => media.get(p.assetId))
    .map((p, i) => {
      const info = media.get(p.assetId)!;
      return {
        key: `${p.assetId}-${i}`,
        src: mediaUrl(p.assetId, pickWidth(info, 800)),
        srcSet: info.widths.map((w) => `${mediaUrl(p.assetId, w)} ${w}w`).join(", "),
        large: mediaUrl(p.assetId, pickWidth(info, 2000)),
        width: info.width,
        height: info.height,
        alt: p.alt,
        caption: p.caption,
        credit: p.credit,
      };
    });
}

export function VideoEmbed({ video, media, fallbackCover, title }: { video: VideoRef; media: MediaMap; fallbackCover?: MediaPlacement | null; title: string }) {
  const cover = video.cover ?? fallbackCover ?? null;
  const info = cover ? media.get(cover.assetId) : undefined;
  return (
    <figure style={{ margin: 0 }}>
      <YouTubePlayer
        id={video.youtubeId}
        title={video.title || title}
        format={video.format}
        watchUrl={watchUrl(video.youtubeId, video.format)}
        coverSrc={cover && info ? mediaUrl(cover.assetId, pickWidth(info, 1200)) : null}
        coverSrcSet={cover && info ? info.widths.map((w) => `${mediaUrl(cover.assetId, w)} ${w}w`).join(", ") : null}
      />
      {video.madeByMe === false && video.attribution ? <figcaption>Video: {video.attribution}</figcaption> : null}
    </figure>
  );
}

export function tocFromBlocks(blocks: Block[]) {
  const used = new Set<string>();
  return blocks
    .filter((b): b is Extract<Block, { type: "heading" }> => b.type === "heading" && Boolean(b.text.trim()))
    .map((b) => ({ id: b.id, level: b.level, text: stripInline(b.text), anchor: headingAnchor(b.text, used) }));
}

export function Blocks({ blocks, media, title }: { blocks: Block[]; media: MediaMap; title: string }) {
  const anchors = new Map(tocFromBlocks(blocks).map((t) => [t.id, t.anchor]));
  return (
    <>
      {blocks.map((b) => {
        switch (b.type) {
          case "paragraph":
            return b.text.trim() ? (
              <p key={b.id}>
                <Inline text={b.text} />
              </p>
            ) : null;
          case "heading": {
            if (!b.text.trim()) return null;
            const H = b.level === 3 ? "h3" : "h2";
            return (
              <H key={b.id} id={anchors.get(b.id)}>
                {stripInline(b.text)}
              </H>
            );
          }
          case "list": {
            const items = b.items.filter((i) => i.trim());
            if (!items.length) return null;
            const L = b.ordered ? "ol" : "ul";
            return (
              <L key={b.id}>
                {items.map((it, i) => (
                  <li key={i}>
                    <Inline text={it} />
                  </li>
                ))}
              </L>
            );
          }
          case "quote":
            return b.text.trim() ? (
              <blockquote key={b.id}>
                <Inline text={b.text} />
                {b.cite ? <cite>— {b.cite}</cite> : null}
              </blockquote>
            ) : null;
          case "image": {
            if (!b.image) return null;
            const info = media.get(b.image.assetId);
            if (!info) return null;
            return (
              <figure key={b.id} className="figure">
                <Img placement={b.image} info={info} sizes="(min-width: 900px) 720px, 92vw" />
                {b.image.caption || b.image.credit ? (
                  <figcaption>
                    {b.image.caption}
                    {b.image.credit ? <span> · Photo: {b.image.credit}</span> : null}
                  </figcaption>
                ) : null}
              </figure>
            );
          }
          case "gallery": {
            const items = galleryItems(b.images, media);
            return items.length ? (
              <div key={b.id}>
                <Gallery items={items} />
              </div>
            ) : null;
          }
          case "youtube":
            return b.video ? (
              <div key={b.id}>
                <VideoEmbed video={b.video} media={media} title={title} />
              </div>
            ) : null;
          case "note":
            return b.text.trim() ? (
              <aside key={b.id} className="note-block" aria-label={b.label}>
                <strong className="note-label">{b.label}</strong>
                <Inline text={b.text} />
              </aside>
            ) : null;
        }
      })}
    </>
  );
}
