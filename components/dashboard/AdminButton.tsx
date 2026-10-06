"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";

export function AdminButton({
  body,
  label,
  confirmText,
  danger,
  endpoint = "/api/admin",
}: {
  body: Record<string, unknown>;
  label: string;
  confirmText?: string;
  danger?: boolean;
  endpoint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <>
      <button
        type="button"
        className={`tool-btn${danger ? " danger" : ""}`}
        disabled={busy}
        onClick={async () => {
          if (confirmText && !window.confirm(confirmText)) return;
          setBusy(true);
          setErr("");
          try {
            await api(endpoint, { body });
            window.location.reload();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : "Failed.");
            setBusy(false);
          }
        }}
      >
        {label}
      </button>
      {err ? <span className="error-text"> {err}</span> : null}
    </>
  );
}
