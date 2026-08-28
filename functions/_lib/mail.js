// Transactional email via Resend.
//
// SETUP: set RESEND_API_KEY in the Cloudflare Pages environment. Without it this
// returns { sent: false, reason: 'not-configured' } and the caller decides what to
// tell the visitor — it never throws into a request handler by surprise.
//
// MAIL_FROM  — the verified sender, e.g. "Fly Fit Jags <no-reply@flyfitjagsaf.org>".
//              Must be on a domain verified in Resend or delivery will be rejected.
// MAIL_TO    — where form submissions land. Comma-separate for multiple recipients.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Everything a visitor typed is escaped before it reaches an HTML email body.
export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendMail(env, { subject, html, text, replyTo }) {
  if (!env.RESEND_API_KEY) return { sent: false, reason: 'not-configured' };

  const from = env.MAIL_FROM || 'Fly Fit Jags <onboarding@resend.dev>';
  const to = String(env.MAIL_TO || 'hello@flyfitjags.foundation')
    .split(',').map((s) => s.trim()).filter(Boolean);

  const payload = { from, to, subject, html };
  if (text) payload.text = text;
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    // Detail goes to the Cloudflare tail. The API key never appears in the body.
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
  return { sent: true };
}
