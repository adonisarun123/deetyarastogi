const LABEL: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  unpublished: "Unpublished",
  trashed: "In trash",
};

export function StateBadge({ state, changes }: { state: string; changes?: boolean }) {
  return (
    <span className="row" style={{ gap: 6, display: "inline-flex" }}>
      <span className={`state state-${state}`}>{LABEL[state] ?? state}</span>
      {state === "published" && changes ? <span className="state state-changes">Unpublished changes</span> : null}
    </span>
  );
}
