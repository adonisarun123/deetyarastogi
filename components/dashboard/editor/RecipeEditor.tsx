"use client";

import type { Ingredient, IngredientGroup, Recipe, RecipeStep } from "@/lib/content/types";
import { rid } from "@/lib/content/types";
import { RichText } from "./RichText";
import { SinglePhoto } from "./Placements";
import { VideoField } from "./VideoField";

type Bad = (field: string) => boolean;

function NumField({ id, label, value, onChange, invalid, hint }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; invalid?: boolean; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={99999}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))))}
        aria-invalid={invalid || undefined}
      />
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function moveIn<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function RecipeEditor({ value: r, onChange, bad }: { value: Recipe; onChange: (r: Recipe) => void; bad: Bad }) {
  const set = (patch: Partial<Recipe>) => onChange({ ...r, ...patch });
  const setGroup = (gi: number, g: IngredientGroup) => set({ groups: r.groups.map((x, k) => (k === gi ? g : x)) });
  const setItem = (gi: number, ii: number, it: Ingredient) => setGroup(gi, { ...r.groups[gi], items: r.groups[gi].items.map((x, k) => (k === ii ? it : x)) });
  const setStep = (si: number, s: RecipeStep) => set({ steps: r.steps.map((x, k) => (k === si ? s : x)) });
  const componentSum = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) + (r.coolMinutes ?? 0) + (r.chillMinutes ?? 0) + (r.restMinutes ?? 0);

  return (
    <div className="form-grid" style={{ gap: 20 }}>
      <section className="s-panel" aria-labelledby="rc-basics">
        <h2 id="rc-basics">Recipe basics</h2>
        <div className="form-grid two">
          <div className="field">
            <label htmlFor="recipe.difficulty">Difficulty</label>
            <select id="recipe.difficulty" value={r.difficulty} onChange={(e) => set({ difficulty: e.target.value as Recipe["difficulty"] })} aria-invalid={bad("recipe.difficulty") || undefined}>
              <option value="">Choose…</option>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="recipe.panSize">Pan or tin size (optional)</label>
            <input id="recipe.panSize" value={r.panSize} maxLength={80} placeholder="e.g. 20 cm round tin" onChange={(e) => set({ panSize: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="recipe.yieldAmount">Makes (amount)</label>
            <input id="recipe.yieldAmount" value={r.yieldAmount} maxLength={40} placeholder="12" onChange={(e) => set({ yieldAmount: e.target.value })} aria-invalid={bad("recipe.yieldAmount") || undefined} />
          </div>
          <div className="field">
            <label htmlFor="recipe.yieldUnit">Unit</label>
            <input id="recipe.yieldUnit" value={r.yieldUnit} maxLength={60} placeholder="cookies / slices / one 20 cm cake" onChange={(e) => set({ yieldUnit: e.target.value })} aria-invalid={bad("recipe.yieldUnit") || undefined} />
          </div>
        </div>
      </section>

      <section className="s-panel" aria-labelledby="rc-time">
        <h2 id="rc-time">Timings (minutes)</h2>
        <div className="s-grid cols-3">
          <NumField id="recipe.prepMinutes" label="Prep" value={r.prepMinutes} onChange={(v) => set({ prepMinutes: v })} invalid={bad("recipe.prepMinutes")} />
          <NumField id="recipe.cookMinutes" label="Bake / cook" value={r.cookMinutes} onChange={(v) => set({ cookMinutes: v })} invalid={bad("recipe.cookMinutes")} />
          <NumField id="recipe.coolMinutes" label="Cooling (optional)" value={r.coolMinutes} onChange={(v) => set({ coolMinutes: v })} />
          <NumField id="recipe.chillMinutes" label="Chilling (optional)" value={r.chillMinutes} onChange={(v) => set({ chillMinutes: v })} />
          <NumField id="recipe.restMinutes" label="Proving / resting (optional)" value={r.restMinutes} onChange={(v) => set({ restMinutes: v })} />
          <NumField
            id="recipe.totalMinutes"
            label="Total time from start to finish"
            value={r.totalMinutes}
            onChange={(v) => set({ totalMinutes: v })}
            invalid={bad("recipe.totalMinutes")}
            hint={componentSum ? `The parts add up to ${componentSum} min — steps can overlap, so confirm the real total.` : "Confirm the real elapsed time."}
          />
        </div>
      </section>

      <section className="s-panel" aria-labelledby="rc-eq">
        <h2 id="rc-eq">Equipment</h2>
        {r.equipment.map((e, i) => (
          <div className="row" key={i} style={{ flexWrap: "nowrap", marginBottom: 8 }}>
            <label htmlFor={`eq-${i}`} className="sr-only">
              Equipment {i + 1}
            </label>
            <input id={`eq-${i}`} value={e} maxLength={160} placeholder="e.g. Oven (fan), 20 cm springform tin, stand mixer" onChange={(ev) => set({ equipment: r.equipment.map((x, k) => (k === i ? ev.target.value : x)) })} />
            <button type="button" className="tool-btn" aria-label={`Move equipment ${i + 1} up`} disabled={i === 0} onClick={() => set({ equipment: moveIn(r.equipment, i, -1) })}>
              ↑
            </button>
            <button type="button" className="tool-btn danger" aria-label={`Remove equipment ${i + 1}`} onClick={() => set({ equipment: r.equipment.filter((_, k) => k !== i) })}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="tool-btn" onClick={() => set({ equipment: [...r.equipment, ""] })}>
          + Add equipment
        </button>
      </section>

      <section className="s-panel" aria-labelledby="rc-ing" id="recipe.groups" style={bad("recipe.groups") ? { borderColor: "var(--danger)" } : undefined}>
        <h2 id="rc-ing">Ingredients</h2>
        <p className="hint">Write quantities exactly as you measure them — ranges like “1–2” and “to taste” are kept as typed. Nothing is converted automatically.</p>
        {r.groups.map((g, gi) => (
          <div key={g.id} className="block">
            <div className="block-head">
              <span className="kind">Group {gi + 1}</span>
              <button type="button" className="tool-btn" disabled={gi === 0} onClick={() => set({ groups: moveIn(r.groups, gi, -1) })} aria-label={`Move group ${gi + 1} up`}>
                ↑
              </button>
              <button type="button" className="tool-btn" disabled={gi === r.groups.length - 1} onClick={() => set({ groups: moveIn(r.groups, gi, 1) })} aria-label={`Move group ${gi + 1} down`}>
                ↓
              </button>
              <button type="button" className="tool-btn danger" disabled={r.groups.length === 1} onClick={() => window.confirm("Remove this ingredient group?") && set({ groups: r.groups.filter((_, k) => k !== gi) })}>
                Remove group
              </button>
            </div>
            <div className="field">
              <label htmlFor={`g-${g.id}`}>Group name</label>
              <input id={`g-${g.id}`} value={g.name} maxLength={120} placeholder="e.g. For the sponge" onChange={(e) => setGroup(gi, { ...g, name: e.target.value })} />
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {g.items.map((it, ii) => (
                <div key={it.id} style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(64px,90px) minmax(64px,100px) minmax(0,1fr)", alignItems: "end", borderBottom: "1px dashed var(--line)", paddingBottom: 10 }}>
                  <div className="field">
                    <label htmlFor={`q-${it.id}`}>Qty</label>
                    <input id={`q-${it.id}`} value={it.quantity} maxLength={40} placeholder="200" onChange={(e) => setItem(gi, ii, { ...it, quantity: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor={`u-${it.id}`}>Unit</label>
                    <input id={`u-${it.id}`} value={it.unit} maxLength={40} placeholder="g" onChange={(e) => setItem(gi, ii, { ...it, unit: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor={`n-${it.id}`}>Ingredient</label>
                    <input id={`n-${it.id}`} value={it.name} maxLength={200} placeholder="plain flour" onChange={(e) => setItem(gi, ii, { ...it, name: e.target.value })} />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor={`p-${it.id}`}>Preparation note (optional)</label>
                    <div className="row" style={{ flexWrap: "nowrap" }}>
                      <input id={`p-${it.id}`} value={it.note} maxLength={200} placeholder="sifted / at room temperature" onChange={(e) => setItem(gi, ii, { ...it, note: e.target.value })} />
                      <button type="button" className="tool-btn" disabled={ii === 0} onClick={() => setGroup(gi, { ...g, items: moveIn(g.items, ii, -1) })} aria-label={`Move ${it.name || "ingredient"} up`}>
                        ↑
                      </button>
                      <button type="button" className="tool-btn" disabled={ii === g.items.length - 1} onClick={() => setGroup(gi, { ...g, items: moveIn(g.items, ii, 1) })} aria-label={`Move ${it.name || "ingredient"} down`}>
                        ↓
                      </button>
                      <button type="button" className="tool-btn danger" onClick={() => setGroup(gi, { ...g, items: g.items.filter((_, k) => k !== ii) })} aria-label={`Remove ${it.name || "ingredient"}`}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="tool-btn"
              style={{ marginTop: 10 }}
              onClick={() => {
                const nid = rid();
                setGroup(gi, { ...g, items: [...g.items, { id: nid, name: "", quantity: "", unit: "", note: "" }] });
                requestAnimationFrame(() => document.getElementById(`q-${nid}`)?.focus());
              }}
            >
              + Add ingredient
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-small" style={{ marginTop: 12 }} onClick={() => set({ groups: [...r.groups, { id: rid(), name: "", items: [{ id: rid(), name: "", quantity: "", unit: "", note: "" }] }] })}>
          + Add ingredient group
        </button>
      </section>

      <section className="s-panel" aria-labelledby="rc-method" id="recipe.steps" style={bad("recipe.steps") ? { borderColor: "var(--danger)" } : undefined}>
        <h2 id="rc-method">Method</h2>
        <p className="hint">If a step uses heat, add the appliance, temperature and unit. There’s no default oven temperature.</p>
        {r.steps.map((s, si) => (
          <div key={s.id} className="block">
            <div className="block-head">
              <span className="kind">Step {si + 1}</span>
              <button type="button" className="tool-btn" disabled={si === 0} onClick={() => set({ steps: moveIn(r.steps, si, -1) })} aria-label={`Move step ${si + 1} up`}>
                ↑
              </button>
              <button type="button" className="tool-btn" disabled={si === r.steps.length - 1} onClick={() => set({ steps: moveIn(r.steps, si, 1) })} aria-label={`Move step ${si + 1} down`}>
                ↓
              </button>
              <button type="button" className="tool-btn danger" disabled={r.steps.length === 1} onClick={() => window.confirm("Remove this step?") && set({ steps: r.steps.filter((_, k) => k !== si) })}>
                Remove
              </button>
            </div>
            <div className="form-grid" style={{ gap: 10 }}>
              <div className="field">
                <label htmlFor={`sh-${s.id}`}>Step heading (optional)</label>
                <input id={`sh-${s.id}`} value={s.heading ?? ""} maxLength={120} onChange={(e) => setStep(si, { ...s, heading: e.target.value })} />
              </div>
              <RichText id={`st-${s.id}`} label="Instruction" value={s.text} rows={3} maxLength={4000} onChange={(text) => setStep(si, { ...s, text })} />
              <div className="s-grid cols-3" style={{ gap: 10 }}>
                <div className="field">
                  <label htmlFor={`ap-${s.id}`}>Appliance / mode</label>
                  <input id={`ap-${s.id}`} value={s.appliance ?? ""} maxLength={80} placeholder="Oven, fan" onChange={(e) => setStep(si, { ...s, appliance: e.target.value })} />
                </div>
                <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-end", gap: 6 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor={`recipe.steps.${si}.temperature`}>Temperature</label>
                    <input id={`recipe.steps.${si}.temperature`} inputMode="numeric" value={s.temperature ?? ""} maxLength={10} onChange={(e) => setStep(si, { ...s, temperature: e.target.value })} aria-invalid={bad(`recipe.steps.${si}.temperature`) || undefined} />
                  </div>
                  <div className="field" style={{ width: 84 }}>
                    <label htmlFor={`recipe.steps.${si}.temperatureUnit`}>Unit</label>
                    <select id={`recipe.steps.${si}.temperatureUnit`} value={s.temperatureUnit ?? ""} onChange={(e) => setStep(si, { ...s, temperatureUnit: e.target.value as RecipeStep["temperatureUnit"] })} aria-invalid={bad(`recipe.steps.${si}.temperatureUnit`) || undefined}>
                      <option value="">—</option>
                      <option value="C">°C</option>
                      <option value="F">°F</option>
                    </select>
                  </div>
                </div>
                <NumField id={`du-${s.id}`} label="Duration (min, optional)" value={s.durationMinutes ?? null} onChange={(v) => setStep(si, { ...s, durationMinutes: v })} />
              </div>
              {r.video ? (
                <div className="field" style={{ maxWidth: 220 }}>
                  <label htmlFor={`vt-${s.id}`}>Video time (e.g. 2:15)</label>
                  <input id={`vt-${s.id}`} value={s.videoTime ?? ""} maxLength={10} onChange={(e) => setStep(si, { ...s, videoTime: e.target.value })} />
                </div>
              ) : null}
              <details>
                <summary>{s.image ? "Step photo ✓" : "Add a step photo (optional)"}</summary>
                <SinglePhoto value={s.image ?? null} onChange={(image) => setStep(si, { ...s, image })} label="Step photo" idPrefix={`sp-${s.id}`} />
              </details>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary btn-small"
          style={{ marginTop: 12 }}
          onClick={() => {
            const nid = rid();
            set({ steps: [...r.steps, { id: nid, text: "" }] });
            requestAnimationFrame(() => document.getElementById(`st-${nid}`)?.focus());
          }}
        >
          + Add step
        </button>
      </section>

      <section className="s-panel" aria-labelledby="rc-notes">
        <h2 id="rc-notes">Notes (all optional)</h2>
        <div className="form-grid">
          <RichText id="n-trouble" label="Troubleshooting" value={r.notes.troubleshooting} rows={3} onChange={(v) => set({ notes: { ...r.notes, troubleshooting: v } })} />
          <RichText id="n-mistakes" label="Common mistakes" value={r.notes.mistakes} rows={3} onChange={(v) => set({ notes: { ...r.notes, mistakes: v } })} />
          <RichText id="n-subs" label="Substitutions" value={r.notes.substitutions} rows={3} onChange={(v) => set({ notes: { ...r.notes, substitutions: v } })} />
          <RichText id="n-storage" label="Storage" value={r.notes.storage} rows={2} onChange={(v) => set({ notes: { ...r.notes, storage: v } })} />
          <RichText id="n-serving" label="Serving suggestions" value={r.notes.serving} rows={2} onChange={(v) => set({ notes: { ...r.notes, serving: v } })} />
        </div>
      </section>

      <section className="s-panel" aria-labelledby="rc-video">
        <h2 id="rc-video">Video (optional)</h2>
        <VideoField value={r.video} onChange={(video) => set({ video })} idPrefix="recipe-video" label="Recipe video" />
      </section>

      <section className="s-panel" aria-labelledby="rc-src">
        <h2 id="rc-src">Sources, labels and readiness</h2>
        <div className="form-grid two">
          <div className="field">
            <label htmlFor="r-adapted">Adapted from (optional)</label>
            <input id="r-adapted" value={r.adaptedFrom} maxLength={300} placeholder="e.g. my training course notes" onChange={(e) => set({ adaptedFrom: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="r-src">Original source link (optional)</label>
            <input id="r-src" type="url" value={r.sourceUrl} maxLength={500} placeholder="https://…" onChange={(e) => set({ sourceUrl: e.target.value })} />
          </div>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="r-diet">Dietary labels you’ve checked yourself (comma separated, optional)</label>
          <input
            id="r-diet"
            defaultValue={r.dietary.join(", ")}
            placeholder="e.g. Vegetarian, Eggless"
            onBlur={(e) => set({ dietary: e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 10) })}
          />
          <span className="hint">Never added automatically. Shown with a note that they’re not an allergy guarantee.</span>
        </div>
        <div className="form-grid two" style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor="r-status">Testing status (private)</label>
            <select id="r-status" value={r.reviewStatus} onChange={(e) => set({ reviewStatus: e.target.value === "tested" ? "tested" : "in_development" })}>
              <option value="in_development">In development</option>
              <option value="tested">Tested</option>
            </select>
          </div>
          <label className="check" id="recipe.readyToShare" style={bad("recipe.readyToShare") ? { outline: "2px solid var(--danger)", borderRadius: 8, padding: 8 } : undefined}>
            <input type="checkbox" checked={r.readyToShare} onChange={(e) => set({ readyToShare: e.target.checked })} />
            <span>
              <strong>This recipe is ready to share.</strong> I’ve checked the ingredients, quantities and steps.
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}

export { SinglePhoto };
