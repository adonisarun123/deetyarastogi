import type { MediaPlacement } from "@/lib/content/types";

export interface VariantInfo {
  width: number;
  height: number;
  widths: number[];
  jpeg?: number | null;
}

export function mediaUrl(assetId: string, width: number, format: "webp" | "jpg" = "webp") {
  return `/media/${assetId}/${width}.${format}`;
}

export function pickWidth(info: VariantInfo, target: number) {
  return info.widths.find((w) => w >= target) ?? info.widths[info.widths.length - 1];
}

/**
 * Responsive image from processed variants. Explicit width/height prevent layout shift.
 * `ratio` crops via object-fit using the saved focal point; omit it for the full image.
 */
export function Img({
  placement,
  info,
  sizes,
  priority = false,
  ratio,
  className,
  alt,
}: {
  placement: MediaPlacement;
  info: VariantInfo | undefined;
  sizes: string;
  priority?: boolean;
  ratio?: string;
  className?: string;
  alt?: string;
}) {
  if (!info || !info.widths.length) return null;
  const srcSet = info.widths.map((w) => `${mediaUrl(placement.assetId, w)} ${w}w`).join(", ");
  const fallback = pickWidth(info, 1200);
  const fx = Math.round((placement.focalX ?? 0.5) * 100);
  const fy = Math.round((placement.focalY ?? 0.5) * 100);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaUrl(placement.assetId, fallback)}
      srcSet={srcSet}
      sizes={sizes}
      width={info.width}
      height={info.height}
      alt={alt ?? placement.alt ?? ""}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={className}
      style={ratio ? { aspectRatio: ratio, objectFit: "cover", objectPosition: `${fx}% ${fy}%` } : undefined}
    />
  );
}
