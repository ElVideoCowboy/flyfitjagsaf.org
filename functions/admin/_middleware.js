import { getCookie, verifySessionToken, SESSION_COOKIE } from '../_lib/auth.js';

// Protects every page under /admin/* at the edge. This isn't just hiding UI client-side —
// an unauthenticated request never even receives the admin page's HTML.
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // The login page itself has to stay reachable without a session, or nobody could log in.
  if (url.pathname === '/admin/login.html' || url.pathname === '/admin/login') {
    return next();
  }

  const token = getCookie(request, SESSION_COOKIE);
  const session = await verifySessionToken(token, env.SESSION_SECRET);

  if (!session) {
    return Response.redirect(new URL('/admin/login.html', url.origin).toString(), 302);
  }

  return next();
}
