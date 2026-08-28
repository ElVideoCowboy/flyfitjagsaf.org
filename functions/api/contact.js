import { jsonResponse } from '../_lib/auth.js';
import { sendMail, esc } from '../_lib/mail.js';

// Public contact / application endpoint for the homepage form.
//
// Everything a stranger can post is length-capped, validated, and HTML-escaped before it
// reaches an email body. The recipient address is read from the environment, never from
// the request — so this endpoint can't be turned into an open relay.

const LIMITS = { name: 120, email: 200, phone: 40, message: 4000, purpose: 60 };

const PURPOSES = [
  'Funding Application',
  'Partnership Inquiry',
  'Volunteering Inquiry',
  'General Question'
];

const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  // Honeypot: the form's hidden "company" field is invisible to humans. Anything that
  // fills it is a bot. Return a success shape so the bot doesn't learn it was caught.
  if (String(body.company || '').trim()) return jsonResponse({ ok: true });

  // Nobody reads a form and writes a considered message in under two seconds.
  const elapsed = Number(body.elapsed || 0);
  if (elapsed > 0 && elapsed < 2000) return jsonResponse({ ok: true });

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email).toLowerCase();
  const phone = clean(body.phone, LIMITS.phone);
  const messageRaw = String(body.message == null ? '' : body.message).trim().slice(0, LIMITS.message);
  let purpose = clean(body.purpose, LIMITS.purpose);
  if (!PURPOSES.includes(purpose)) purpose = 'General Question';

  if (!name) return jsonResponse({ error: 'Please add your name.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: 'That email address does not look right.' }, 400);
  if (messageRaw.length < 5) return jsonResponse({ error: 'Please tell us a little more.' }, 400);

  const messageHtml = esc(messageRaw).replace(/\r?\n/g, '<br>');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#111">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8f6a2c">
        Fly Fit Jags &middot; Website Form
      </p>
      <h2 style="margin:0 0 18px;font-size:19px">${esc(purpose)}</h2>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px">
        <tr><td style="padding:4px 18px 4px 0;color:#666">Name</td><td style="padding:4px 0"><b>${esc(name)}</b></td></tr>
        <tr><td style="padding:4px 18px 4px 0;color:#666">Email</td><td style="padding:4px 0"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
        ${phone ? `<tr><td style="padding:4px 18px 4px 0;color:#666">Phone</td><td style="padding:4px 0">${esc(phone)}</td></tr>` : ''}
      </table>
      <div style="border-left:3px solid #c69649;padding:2px 0 2px 14px;color:#222">${messageHtml}</div>
      <p style="margin-top:26px;font-size:12px;color:#999">
        Sent from the contact form at flyfitjagsaf.org. Reply directly to this email to reach ${esc(name)}.
      </p>
    </div>`;

  const text =
    `${purpose}\n\nName: ${name}\nEmail: ${email}${phone ? `\nPhone: ${phone}` : ''}\n\n${messageRaw}\n`;

  try {
    const result = await sendMail(env, {
      subject: `[Fly Fit Jags] ${purpose} — ${name}`,
      html,
      text,
      replyTo: email
    });
    if (!result.sent) {
      return jsonResponse({ error: 'Email is not configured on this site yet. Please write to hello@flyfitjags.foundation.' }, 503);
    }
  } catch (err) {
    console.error('contact form send failed:', String((err && err.message) || err));
    return jsonResponse({ error: 'We could not send that just now. Please email hello@flyfitjags.foundation.' }, 502);
  }

  return jsonResponse({ ok: true });
}
