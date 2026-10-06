"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";

export function AcceptForm({ token, needsName }: { token: string; needsName: boolean }) {
  const [displayName, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 10) return setError("Use at least 10 characters.");
    if (password !== confirm) return setError("The two passwords don’t match.");
    setBusy(true);
    try {
      await api("/api/auth/invite-accept", { body: { token, password, displayName } });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" noValidate>
      <div role="alert">{error ? <p className="alert alert-error" style={{ margin: 0 }}>{error}</p> : null}</div>
      {needsName ? (
        <div className="field">
          <label htmlFor="n">Your name (only shown inside the studio)</label>
          <input id="n" autoComplete="name" value={displayName} onChange={(e) => setName(e.target.value)} />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="p">Password</label>
        <input id="p" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="p-hint" />
        <span id="p-hint" className="hint">
          At least 10 characters. A short sentence works well.
        </span>
      </div>
      <div className="field">
        <label htmlFor="c">Type it again</label>
        <input id="c" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <button className="btn" disabled={busy}>
        {busy ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}
