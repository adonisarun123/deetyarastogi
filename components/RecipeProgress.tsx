"use client";

import { useEffect, useState } from "react";

// R06: session-only visitor conveniences. Nothing is sent to the server; no account needed.
// Each checkbox stores its own sessionStorage flag so items never overwrite each other.

function useSessionFlag(storageKey: string, id: string) {
  const key = `recipe:${storageKey}:${id}`;
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOn(sessionStorage.getItem(key) === "1");
    } catch {}
    const h = (e: Event) => {
      if ((e as CustomEvent).detail === storageKey) setOn(false);
    };
    window.addEventListener("recipe-reset", h);
    return () => window.removeEventListener("recipe-reset", h);
  }, [key, storageKey]);
  const set = (v: boolean) => {
    setOn(v);
    try {
      if (v) sessionStorage.setItem(key, "1");
      else sessionStorage.removeItem(key);
    } catch {}
  };
  return [on, set] as const;
}

export function IngredientCheck({ storageKey, id, children }: { storageKey: string; id: string; children: React.ReactNode }) {
  const [on, set] = useSessionFlag(storageKey, `i-${id}`);
  return (
    <label>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function StepItem({ storageKey, id, children }: { storageKey: string; id: string; children: React.ReactNode }) {
  const [done, set] = useSessionFlag(storageKey, `s-${id}`);
  return (
    <li id={`step-${id}`} data-done={done}>
      {children}
      <label className="check step-done">
        <input type="checkbox" checked={done} onChange={(e) => set(e.target.checked)} />
        <span>{done ? "Done" : "Mark step as done"}</span>
      </label>
    </li>
  );
}

export function ResetProgress({ storageKey }: { storageKey: string }) {
  const [msg, setMsg] = useState("");
  return (
    <span className="reset-progress row">
      <button
        type="button"
        className="btn btn-quiet btn-small"
        onClick={() => {
          try {
            const prefix = `recipe:${storageKey}:`;
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
              const k = sessionStorage.key(i);
              if (k?.startsWith(prefix)) sessionStorage.removeItem(k);
            }
          } catch {}
          window.dispatchEvent(new CustomEvent("recipe-reset", { detail: storageKey }));
          setMsg("Progress cleared");
          setTimeout(() => setMsg(""), 2500);
        }}
      >
        Reset progress
      </button>
      <span role="status" aria-live="polite" className="muted" style={{ fontSize: "0.9rem" }}>
        {msg}
      </span>
    </span>
  );
}
