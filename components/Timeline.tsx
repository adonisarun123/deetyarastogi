import type { Experience } from "@/lib/site";

const KIND_LABEL: Record<string, string> = {
  interest: "Where it started",
  training: "Professional training",
  internship: "Internship",
  next: "Next chapter",
  other: "Experience",
};

export function Timeline({ items, compact = false }: { items: Experience[]; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <ol className="timeline" style={{ ["--cols" as string]: String(Math.min(items.length, 4)) }}>
      {items.map((x) => (
        <li key={x.id} data-kind={x.kind}>
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            {KIND_LABEL[x.kind]}
          </p>
          <h3>{x.title}</h3>
          {x.organisation || x.role ? (
            <p className="org" style={{ margin: 0 }}>
              {[x.role, x.organisation].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {x.period ? <p className="period" style={{ margin: "2px 0 0" }}>{x.period}</p> : null}
          {x.description ? <p style={{ marginTop: 10, marginBottom: 0 }}>{x.description}</p> : null}
          {!compact && x.details?.length ? (
            <ul>
              {x.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
