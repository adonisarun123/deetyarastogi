"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { PrivateSettings } from "@/lib/site";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"author" | "owner">("author");
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr("");
        setLink("");
        try {
          const r = await api<{ url: string }>("/api/admin", { body: { action: "invite", email, role } });
          setLink(`${window.location.origin}${r.url}`);
        } catch (er) {
          setErr(er instanceof ApiError ? er.message : "Failed.");
        }
      }}
    >
      <div className="form-grid two">
        <div className="field">
          <label htmlFor="inv-email">Email</label>
          <input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="inv-role">Role</label>
          <select id="inv-role" value={role} onChange={(e) => setRole(e.target.value === "owner" ? "owner" : "author")}>
            <option value="author">Baker / author (creates and publishes own work)</option>
            <option value="owner">Owner (full access)</option>
          </select>
        </div>
      </div>
      <button className="btn btn-small" type="submit" style={{ justifySelf: "start" }}>
        Create invite link
      </button>
      {err ? <p className="error-text">{err}</p> : null}
      {link ? <LinkBox link={link} note="Send this link to them directly (it works once, for 72 hours). It isn’t shown again." /> : null}
    </form>
  );
}

export function ResetLinkButton({ email }: { email: string }) {
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  return (
    <>
      <button
        type="button"
        className="tool-btn"
        onClick={async () => {
          try {
            const r = await api<{ url: string }>("/api/admin", { body: { action: "reset-link", email } });
            setLink(`${window.location.origin}${r.url}`);
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : "Failed.");
          }
        }}
      >
        Password reset link
      </button>
      {err ? <span className="error-text">{err}</span> : null}
      {link ? <LinkBox link={link} note="One-time, 72 hours." /> : null}
    </>
  );
}

function LinkBox({ link, note }: { link: string; note: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="alert alert-info" style={{ display: "grid", gap: 8 }}>
      <label htmlFor="link-box" className="sr-only">
        Link
      </label>
      <input id="link-box" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      <span className="row">
        <button
          type="button"
          className="tool-btn"
          onClick={async () => {
            await navigator.clipboard.writeText(link).catch(() => {});
            setCopied(true);
          }}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <span className="hint">{note}</span>
      </span>
    </div>
  );
}

export function PrivateSettingsForm({ initial }: { initial: PrivateSettings }) {
  const [p, setP] = useState(initial);
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
          await api("/api/site", { method: "PUT", body: { section: "private", data: p } });
          setMsg("Saved.");
        } catch (er) {
          setErr(er instanceof ApiError ? er.message : "Failed.");
        }
      }}
    >
      <div className="field">
        <label htmlFor="inbox">Parent-managed inbox email (for new-message notifications)</label>
        <input id="inbox" type="email" value={p.inboxEmail} onChange={(e) => setP({ ...p, inboxEmail: e.target.value })} />
        <span className="hint">Email notifications need RESEND_API_KEY configured on the server. Messages are always kept in this studio inbox either way.</span>
      </div>
      <div className="field">
        <label htmlFor="hook">Notification webhook (optional, https)</label>
        <input id="hook" type="url" value={p.notifyWebhook} onChange={(e) => setP({ ...p, notifyWebhook: e.target.value })} />
        <span className="hint">Receives only “you have a new note” — never the message itself.</span>
      </div>
      <button className="btn btn-small" type="submit" style={{ justifySelf: "start" }}>
        Save
      </button>
      <div role="status">
        {msg ? <p className="alert alert-success">{msg}</p> : null}
        {err ? <p className="alert alert-error">{err}</p> : null}
      </div>
    </form>
  );
}
