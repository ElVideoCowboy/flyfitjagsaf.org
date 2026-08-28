import { jsonResponse, SESSION_COOKIE } from '../_lib/auth.js';

export async function onRequestPost() {
  return jsonResponse(
    { ok: true },
    200,
    { 'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0` }
  );
}
