import "server-only";
import { q } from "./db";
import { opsEvent } from "./ops";
import { getPrivateSettings } from "./site";

/**
 * Optional delivery of a new-enquiry notice to the parent-managed inbox.
 * The enquiry is already stored durably before this runs; failure here is surfaced to the owner,
 * never reported to the visitor as a send failure.
 * Supported: RESEND_API_KEY (+ MAIL_FROM) or a private webhook URL in owner settings.
 */
export async function deliverEnquiry(id: string, e: { name: string; email: string; reason: string | null; message: string }) {
  const priv = await getPrivateSettings().catch(() => ({ inboxEmail: "", notifyWebhook: "" }));
  const to = priv.inboxEmail || process.env.CONTACT_INBOX || "";
  const resendKey = process.env.RESEND_API_KEY;
  try {
    if (resendKey && to) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || "Scrapbook <onboarding@resend.dev>",
          to: [to],
          reply_to: e.email,
          subject: `New note from ${e.name}${e.reason ? ` — ${e.reason}` : ""}`,
          text: `${e.message}\n\n— ${e.name} <${e.email}>\n\nOpen the studio inbox to reply or archive.`,
        }),
      });
      if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
    } else if (priv.notifyWebhook && /^https:\/\//.test(priv.notifyWebhook)) {
      const res = await fetch(priv.notifyWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only a notice — not the message body — leaves the system via webhook.
        body: JSON.stringify({ text: `New contact note from ${e.name}. Open the studio inbox to read it.` }),
      });
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
    } else {
      return; // Stored in the dashboard inbox only.
    }
    await q(`UPDATE contact_requests SET delivery_status = 'delivered', delivery_error = NULL WHERE id = $1`, [id]);
  } catch (err) {
    const msg = (err as Error).message.slice(0, 200);
    await q(`UPDATE contact_requests SET delivery_status = 'failed', delivery_error = $2 WHERE id = $1`, [id, msg]).catch(() => {});
    await opsEvent("contact_delivery_failed", id, msg);
  }
}
