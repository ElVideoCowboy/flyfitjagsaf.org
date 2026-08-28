import { getCookie, verifySessionToken, jsonResponse, SESSION_COOKIE } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = getCookie(request, SESSION_COOKIE);
  const session = await verifySessionToken(token, env.SESSION_SECRET);

  if (!session) return jsonResponse({ loggedIn: false });
  return jsonResponse({ loggedIn: true, email: session.email });
}
