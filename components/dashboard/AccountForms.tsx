"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { api, ApiError } from "@/lib/client/api";

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg("");
        setErr("");
        try {
          await api("/api/account", { body: { action: "password", current, next } });
          setMsg("Password changed. Other devices were signed out.");
          setCurrent("");
          setNext("");
        } catch (er) {
          setErr(er instanceof ApiError ? er.message : "Failed.");
        }
      }}
    >
      <div className="form-grid two">
        <div className="field">
          <label htmlFor="cur">Current password</label>
          <input id="cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="new">New password (10+ characters)</label>
          <input id="new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
      </div>
      <button className="btn btn-small" style={{ justifySelf: "start" }}>
        Change password
      </button>
      <div role="status">
        {msg ? <p className="alert alert-success">{msg}</p> : null}
        {err ? <p className="alert alert-error">{err}</p> : null}
      </div>
    </form>
  );
}

export function MfaForm({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [current, setCurrent] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  if (enabled) {
    return (
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          try {
            await api("/api/account", { body: { action: "mfa-disable", current, code } });
            window.location.reload();
          } catch (er) {
            setErr(er instanceof ApiError ? er.message : "Failed.");
          }
        }}
      >
        <p className="alert alert-success" style={{ margin: 0 }}>
          Two-step sign-in is on.
        </p>
        <details>
          <summary>Turn it off</summary>
          <div className="form-grid two" style={{ marginTop: 8 }}>
            <div className="field">
              <label htmlFor="d-pw">Password</label>
              <input id="d-pw" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="d-code">Current 6-digit code</label>
              <input id="d-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
          <button className="btn btn-quiet btn-small" style={{ marginTop: 8 }}>
            Turn off two-step sign-in
          </button>
        </details>
        {err ? <p className="alert alert-error">{err}</p> : null}
      </form>
    );
  }

  return (
    <div className="form-grid">
      {!setup ? (
        <button
          type="button"
          className="btn btn-small"
          style={{ justifySelf: "start" }}
          onClick={async () => {
            setErr("");
            try {
              const r = await api<{ secret: string; uri: string }>("/api/account", { body: { action: "mfa-start" } });
              const qr = await QRCode.toDataURL(r.uri, { margin: 1, width: 220 });
              setSetup({ secret: r.secret, qr });
            } catch (er) {
              setErr(er instanceof ApiError ? er.message : "Failed.");
            }
          }}
        >
          Set up two-step sign-in
        </button>
      ) : (
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr("");
            try {
              await api("/api/account", { body: { action: "mfa-enable", code } });
              setMsg("Two-step sign-in is on.");
              setTimeout(() => window.location.reload(), 800);
            } catch (er) {
              setErr(er instanceof ApiError ? er.message : "Failed.");
            }
          }}
        >
          <p style={{ margin: 0 }}>1. Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="QR code for your authenticator app" width={220} height={220} />
          <p className="hint" style={{ margin: 0 }}>
            Can’t scan? Enter this key: <span className="kbd">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</span>
          </p>
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="mfa-code">2. Enter the 6-digit code it shows</label>
            <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </div>
          <button className="btn btn-small" style={{ justifySelf: "start" }}>
            Turn on
          </button>
        </form>
      )}
      <div role="status">
        {msg ? <p className="alert alert-success">{msg}</p> : null}
        {err ? <p className="alert alert-error">{err}</p> : null}
      </div>
    </div>
  );
}

export function SignOutButton() {
  return (
    <button
      type="button"
      className="btn btn-quiet btn-small"
      onClick={async () => {
        await api("/api/auth/logout", { body: {} }).catch(() => {});
        window.location.href = "/dashboard/login";
      }}
    >
      Sign out
    </button>
  );
}
