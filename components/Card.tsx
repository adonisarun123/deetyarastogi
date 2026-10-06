import Link from "next/link";
import type { Card as CardT } from "@/lib/content/public";
import { TYPE_LABEL } from "@/lib/content/types";
import { formatDate, minutesLabel } from "@/lib/text";
import { Img } from "./Img";

const SIZES = "(min-width: 1000px) 380px, (min-width: 640px) 46vw, 92vw";

export function EntryCard({ card, priority = false, headingLevel = 3 }: { card: CardT; priority?: boolean; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const hasImage = Boolean(card.cover?.widths?.length);
  return (
    <article className="card" data-type={card.type}>
      {hasImage ? (
        <div className="media">
          <Img placement={card.cover!} info={card.cover!} sizes={SIZES} ratio="4 / 3" priority={priority} />
          {card.type === "video" ? <span className="play-badge" aria-hidden="true" /> : null}
        </div>
      ) : card.type === "tip" ? (
        <div className="text-art" aria-hidden="true">
          Tip!
        </div>
      ) : (
        <div className="text-art" aria-hidden="true">
          {card.title}
        </div>
      )}
      <div className="body">
        <span className="label" data-type={card.type}>
          {card.type === "video" ? "▶ " : ""}
          {TYPE_LABEL[card.type]}
        </span>
        <H>
          <Link href={card.path}>{card.title}</Link>
        </H>
        {card.summary ? <p>{card.summary}</p> : null}
        <div className="meta">
          {card.type === "recipe" && card.totalMinutes ? <span>⏱ {minutesLabel(card.totalMinutes)}</span> : null}
          {card.type === "recipe" && card.difficulty ? <span>{card.difficulty}</span> : null}
          {card.categoryName ? <span>{card.categoryName}</span> : null}
          <time dateTime={card.firstPublishedAt}>{formatDate(card.firstPublishedAt)}</time>
        </div>
      </div>
    </article>
  );
}

export function CardGrid({ cards, featureFirst = false, priorityCount = 0 }: { cards: CardT[]; featureFirst?: boolean; priorityCount?: number }) {
  return (
    <ul className="grid" role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {cards.map((c, i) => (
        <li key={c.id} className={featureFirst ? "feature-first" : undefined} style={{ display: "grid" }}>
          <EntryCard card={c} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
