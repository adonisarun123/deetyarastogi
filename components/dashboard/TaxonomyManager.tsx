"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";

interface T {
  id: string;
  kind: "category" | "tag";
  name: string;
  slug: string;
  usage: number;
}

export function TaxonomyManager() {
  const [terms, setTerms] = useState<T[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState({ category: "", tag: "" });

  const load = useCallback(async () => {
    const r = await api<{ terms: T[] }>("/api/terms").catch(() => ({ terms: [] }));
    setTerms(r.terms);
    setNames(Object.fromEntries(r.terms.map((t) => [t.id, t.name])));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (body: Record<string, unknown>, ok: string) => {
    setErr("");
    setMsg("");
    try {
      await api("/api/terms", { body });
      setMsg(ok);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "That didn’t work.");
    }
  };

  const section = (kind: "category" | "tag") => {
    const list = terms.filter((t) => t.kind === kind);
    return (
      <section className="s-panel" aria-labelledby={`${kind}-h`}>
        <h2 id={`${kind}-h`}>{kind === "category" ? "Categories" : "Tags"}</h2>
        <p className="hint">
          {kind === "category"
            ? "The baking subject (Cakes, Breads, Cookies…). Each entry has exactly one."
            : "Specific techniques or themes (lamination, piping, sourdough…). Up to eight per entry."}
        </p>
        <form
          className="row"
          style={{ alignItems: "flex-end", marginBottom: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (newName[kind].trim()) run({ action: "create", kind, name: newName[kind] }, "Added.").then(() => setNewName((n) => ({ ...n, [kind]: "" })));
          }}
        >
          <div className="field" style={{ flex: "1 1 220px" }}>
            <label htmlFor={`new-${kind}`}>New {kind}</label>
            <input id={`new-${kind}`} value={newName[kind]} onChange={(e) => setNewName((n) => ({ ...n, [kind]: e.target.value }))} />
          </div>
          <button className="btn btn-small" type="submit">
            Add
          </button>
        </form>
        {list.length ? (
          <table className="s-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Used by</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td>
                    <label htmlFor={`nm-${t.id}`} className="sr-only">
                      Name for {t.name}
                    </label>
                    <input id={`nm-${t.id}`} value={names[t.id] ?? ""} onChange={(e) => setNames((n) => ({ ...n, [t.id]: e.target.value }))} />
                  </td>
                  <td>
                    {t.usage} entr{t.usage === 1 ? "y" : "ies"}
                  </td>
                  <td>
                    <span className="row" style={{ gap: 6 }}>
                      <button type="button" className="tool-btn" disabled={names[t.id] === t.name} onClick={() => run({ action: "rename", id: t.id, name: names[t.id] }, "Renamed — every entry keeps its link.")}>
                        Rename
                      </button>
                      <label htmlFor={`mg-${t.id}`} className="sr-only">
                        Merge {t.name} into
                      </label>
                      <select
                        id={`mg-${t.id}`}
                        value=""
                        onChange={(e) => {
                          const into = e.target.value;
                          const target = list.find((x) => x.id === into);
                          if (into && window.confirm(`Merge “${t.name}” into “${target?.name}”? Entries move across and “${t.name}” disappears.`)) run({ action: "merge", id: t.id, into }, "Merged.");
                        }}
                        style={{ width: "auto", minHeight: 40 }}
                      >
                        <option value="">Merge into…</option>
                        {list
                          .filter((x) => x.id !== t.id)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className="tool-btn danger"
                        onClick={() => {
                          if (kind === "category" && t.usage > 0) {
                            const opts = list.filter((x) => x.id !== t.id);
                            if (!opts.length) return setErr("Create another category first, then move these entries to it.");
                            const choice = window.prompt(`“${t.name}” is used by ${t.usage} entr${t.usage === 1 ? "y" : "ies"}. Type the name of the category to move them to:\n${opts.map((o) => o.name).join(", ")}`);
                            const target = opts.find((o) => o.name.toLowerCase() === (choice ?? "").trim().toLowerCase());
                            if (!target) return setErr("Category not found — nothing was deleted.");
                            run({ action: "delete", id: t.id, reassignTo: target.id }, `Deleted. Entries moved to ${target.name}.`);
                          } else if (window.confirm(`Delete “${t.name}”?${t.usage ? ` It will be removed from ${t.usage} entr${t.usage === 1 ? "y" : "ies"}.` : ""}`)) {
                            run({ action: "delete", id: t.id }, "Deleted.");
                          }
                        }}
                      >
                        Delete
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">None yet. Let real entries decide these — don’t invent them in advance.</p>
        )}
      </section>
    );
  };

  return (
    <>
      <div role="status" aria-live="polite">
        {msg ? <p className="alert alert-success">{msg}</p> : null}
        {err ? <p className="alert alert-error">{err}</p> : null}
      </div>
      {section("category")}
      {section("tag")}
    </>
  );
}
