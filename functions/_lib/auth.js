// Shared auth helpers for Cloudflare Pages Functions.
// Everything here uses the standard Web Crypto API (crypto.subtle), which is built into
// the Cloudflare Workers runtime — no external crypto libraries required.

export const SESSION_COOKIE = 'ffj_admin_session';

export function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

// PBKDF2-SHA256, 100k iterations, 256-bit output. This is the same function used by
// scripts/generate-admin-hash.js — both must stay in sync or logins will fail.
export async function hashPassword(password, saltBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return new Uint8Array(derivedBits);
}

// Constant-time string comparison — avoids leaking hash-match info via response timing.
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function hmacSign(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return toHex(new Uint8Array(sig));
}

const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000; // 8 hours

export async function createSessionToken(email, secret) {
  const payload = JSON.stringify({ email, exp: Date.now() + SESSION_LIFETIME_MS });
  const payloadB64 = btoa(payload);
  const sig = await hmacSign(payloadB64, secret);
  return payloadB64 + '.' + sig;
}

export async function verifySessionToken(token, secret) {
  if (!token || !secret || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  const expectedSig = await hmacSign(payloadB64, secret);
  if (!timingSafeEqual(sig, expectedSig)) return null;

  let payload;
  try {
    payload = JSON.parse(atob(payloadB64));
  } catch (e) {
    return null;
  }
  if (!payload || !payload.exp || Date.now() > payload.exp) return null;
  return payload; // { email, exp }
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function jsonResponse(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}
