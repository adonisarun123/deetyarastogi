"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "sending" | "success" | "error";
type Errors = Partial<Record<"name" | "email" | "message", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX = 3000;

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random());
}

export function ContactForm({ alternativeEmail }: { alternativeEmail?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [values, setValues] = useState({ name: "", email: "", reason: "", message: "", website: "" });
  const requestKey = useRef(newKey()); // idempotency: a double-click or retry stores one enquiry
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const statusRef = useRef<HTMLDivElement>(null);

  const validate = (v = values): Errors => {
    const e: Errors = {};
    if (!v.name.trim()) e.name = "Please tell us your name.";
    if (!v.email.trim()) e.email = "Please add your email so we can reply.";
    else if (!EMAIL.test(v.email.trim())) e.email = "That email doesn’t look right — please check it.";
    if (!v.message.trim()) e.message = "Please write a message.";
    else if (v.message.length > MAX) e.message = `Please keep the message under ${MAX} characters.`;
    return e;
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (status === "sending") return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      const first = Object.keys(e)[0];
      document.getElementById(`c-${first}`)?.focus();
      return;
    }
    setStatus("sending");
    setServerError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, requestKey: requestKey.current, elapsed: Date.now() - startedAt.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        throw new Error(data.error || "We couldn’t send your note.");
      }
      setStatus("success");
      setTimeout(() => statusRef.current?.focus(), 0);
    } catch (err) {
      setServerError((err as Error).message || "We couldn’t send your note.");
      setStatus("error");
      setTimeout(() => statusRef.current?.focus(), 0);
    }
  };

  if (status === "success") {
    return (
      <div ref={statusRef} tabIndex={-1} className="alert alert-success" role="status">
        <p style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>
          <strong>Thanks — your note has been sent.</strong>
        </p>
        <p style={{ margin: "0 0 16px" }}>It’s safely in our private inbox and will be read soon.</p>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => {
            setValues({ name: "", email: "", reason: "", message: "", website: "" });
            requestKey.current = newKey();
            startedAt.current = Date.now();
            setStatus("idle");
          }}
        >
          Write another note
        </button>
      </div>
    );
  }

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const v = { ...values, [k]: e.target.value };
    setValues(v);
    if (errors[k as keyof Errors]) setErrors(validate(v));
  };

  return (
    <form onSubmit={onSubmit} noValidate className="form-grid" aria-describedby="contact-privacy">
      <div ref={statusRef} tabIndex={-1} role="status" aria-live="polite">
        {status === "error" ? (
          <div className="alert alert-error">
            <p style={{ margin: 0 }}>
              <strong>{serverError}</strong> Your message is still here — please try again.
              {alternativeEmail ? (
                <>
                  {" "}
                  Or email <a href={`mailto:${alternativeEmail}`}>{alternativeEmail}</a>.
                </>
              ) : null}
            </p>
          </div>
        ) : null}
      </div>

      <div className="form-grid two">
        <div className="field">
          <label htmlFor="c-name">Your name</label>
          <input id="c-name" name="name" type="text" autoComplete="name" required maxLength={100} value={values.name} onChange={set("name")} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "c-name-err" : undefined} />
          {errors.name ? (
            <span id="c-name-err" className="error-text">
              {errors.name}
            </span>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input id="c-email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={200} value={values.email} onChange={set("email")} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "c-email-err" : undefined} />
          {errors.email ? (
            <span id="c-email-err" className="error-text">
              {errors.email}
            </span>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="c-reason">
          Reason for writing <span className="muted">(optional)</span>
        </label>
        <select id="c-reason" name="reason" value={values.reason} onChange={set("reason")}>
          <option value="">Choose one…</option>
          <option>Learning opportunity</option>
          <option>Collaboration</option>
          <option>General message</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="c-message">Message</label>
        <textarea id="c-message" name="message" required rows={6} maxLength={MAX + 200} value={values.message} onChange={set("message")} aria-invalid={Boolean(errors.message)} aria-describedby={`c-message-hint${errors.message ? " c-message-err" : ""}`} />
        <span id="c-message-hint" className="hint">
          Plain text, up to {MAX} characters ({values.message.length} used).
        </span>
        {errors.message ? (
          <span id="c-message-err" className="error-text">
            {errors.message}
          </span>
        ) : null}
      </div>

      {/* Spam trap: hidden from people and assistive tech. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="c-website">Leave this empty</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
      </div>

      <div className="row">
        <button type="submit" className="btn" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : status === "error" ? "Try again" : "Send a note"}
        </button>
      </div>
    </form>
  );
}
