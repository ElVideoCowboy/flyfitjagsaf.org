import { fromHex, toHex, hashPassword, timingSafeEqual, createSessionToken, jsonResponse, SESSION_COOKIE } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    return jsonResponse({ error: 'Email and password are required' }, 400);
  }

  const adminEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const stored = String(env.ADMIN_PASSWORD_HASH || '');
  const [saltHex, hashHex] = stored.split(':');

  if (!adminEmail || !saltHex || !hashHex || !env.SESSION_SECRET) {
    return jsonResponse({ error: 'Admin login is not configured yet — see README.md' }, 500);
  }

  // Always run the hash even on an email mismatch, so a wrong email doesn't respond
  // measurably faster than a wrong password (basic timing-attack hygiene).
  const computed = await hashPassword(password, fromHex(saltHex));
  const computedHex = toHex(computed);
  const passwordOk = timingSafeEqual(computedHex, hashHex);
  const emailOk = timingSafeEqual(email, adminEmail);

  if (!emailOk || !passwordOk) {
    return jsonResponse({ error: 'Invalid email or password' }, 401);
  }

  const token = await createSessionToken(adminEmail, env.SESSION_SECRET);
  return jsonResponse(
    { ok: true },
    200,
    { 'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800` }
  );
}
