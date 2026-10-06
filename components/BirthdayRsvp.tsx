"use client";

import { useState } from "react";

type Answer = "yes" | "maybe" | "no";

export function BirthdayRsvp({ whatsapp, phoneDisplay, shortDate, name }: { whatsapp: string; phoneDisplay: string; shortDate: string; name: string }) {
  const [answer, setAnswer] = useState<Answer>("yes");
  const [guests, setGuests] = useState(1);
  const [guestName, setGuestName] = useState("");

  const who = guestName.trim() ? ` — ${guestName.trim()}` : "";
  const text =
    answer === "yes"
      ? `Hi! Yes, we'll be at ${name}'s 16th birthday on ${shortDate}. We are ${guests} ${guests === 1 ? "person" : "people"}${who}`
      : answer === "maybe"
        ? `Hi! Thank you for inviting us to ${name}'s 16th birthday on ${shortDate}. We're not sure yet and will confirm soon${who}`
        : `Hi! Sorry, we can't make it to ${name}'s 16th birthday on ${shortDate}. Wishing her a wonderful day${who}`;
  const wa = `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;

  const opts: { id: Answer; label: string }[] = [
    { id: "yes", label: "Yes, I’ll be there!" },
    { id: "maybe", label: "Maybe" },
    { id: "no", label: "Sorry, can’t make it" },
  ];

  return (
    <div className="form-grid" style={{ gap: 22 }}>
      <fieldset>
        <legend className="eyebrow" style={{ color: "var(--muted-strong)", marginBottom: 10 }}>
          Your answer
        </legend>
        <div className="filters" style={{ marginBottom: 0 }}>
          {opts.map((o) => (
            <button key={o.id} type="button" className="chip" aria-pressed={answer === o.id} onClick={() => setAnswer(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="form-grid two" style={{ gap: 16 }}>
        <div className="field">
          <label htmlFor="rsvp-name">Your name</label>
          <input id="rsvp-name" type="text" autoComplete="name" maxLength={80} value={guestName} onChange={(e) => setGuestName(e.target.value)} />
        </div>
        {answer !== "no" ? (
          <div className="field">
            <span className="label-text" id="guests-label">
              How many of you?
            </span>
            <div className="row" style={{ flexWrap: "nowrap" }} role="group" aria-labelledby="guests-label">
              <button type="button" className="btn btn-quiet" style={{ minWidth: 48, padding: 0 }} onClick={() => setGuests((g) => Math.max(1, g - 1))} aria-label="One fewer guest">
                −
              </button>
              <span aria-live="polite" style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 650, minWidth: 40, textAlign: "center" }}>
                {guests}
              </span>
              <button type="button" className="btn btn-quiet" style={{ minWidth: 48, padding: 0 }} onClick={() => setGuests((g) => Math.min(10, g + 1))} aria-label="One more guest">
                +
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="btn-row">
        <a className="btn" href={wa} target="_blank" rel="noopener noreferrer">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.2-5.2A8.5 8.5 0 1 1 21 11.5z" />
          </svg>
          Send RSVP on WhatsApp
        </a>
        <a className="btn btn-secondary" href={`tel:+${whatsapp}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
          </svg>
          Call {phoneDisplay}
        </a>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
        WhatsApp opens with your reply ready to send. Nothing is stored on this website.
      </p>
    </div>
  );
}
