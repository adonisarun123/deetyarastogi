"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";

export function LoginForm({ mfaPending }: { mfaPending: boolean }) {
  const [step, setStep] = useState<"password" | "mfa">(mfaPending ? "mfa" : "password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const go = () => {
    window.location.href = "/dashboard";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (step === "password") {
        const r = await api<{ mfa: boolean }>("/api/auth/login", { body: { email, password } });
        if (r.mfa) setStep("mfa");
        else go();
      } else {
        await api("/api/auth/mfa", { body: { code } });
        go();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form-grid" style={{ marginTop: 16 }} noValidate>
      <div role="alert" aria-live="assertive">
        {error ? <p className="alert alert-error" style={{ margin: 0 }}>{error}</p> : null}
      </div>
      {step === "password" ? (
        <>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </>
      ) : (
        <div className="field">
          <label htmlFor="code">6-digit code from your authenticator app</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        </div>
      )}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Checking…" : step === "password" ? "Sign in" : "Verify"}
      </button>
      <p className="muted" style={{ fontSize: "0.9rem", margin: 0 }}>
        Forgot your password? Ask the site owner for a reset link.
      </p>
    </form>
  );
}
