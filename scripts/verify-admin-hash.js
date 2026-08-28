#!/usr/bin/env node
/**
 * Run LOCALLY:  node scripts/verify-admin-hash.js
 *
 * Checks whether a password matches an ADMIN_PASSWORD_HASH string, using exactly the
 * same PBKDF2 parameters the live site uses. Nothing is sent anywhere — this runs
 * entirely on your machine and prints only "match" or "no match".
 *
 * Use it when the admin login says "Invalid email or password" and you want to know
 * whether the problem is the password, the hash, or the email.
 */

const { webcrypto } = require('crypto');
const cryptoApi = webcrypto;

const CTRL_C = String.fromCharCode(3);
const CTRL_D = String.fromCharCode(4);
const BACKSPACE = String.fromCharCode(127);

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}
async function hashPassword(password, saltBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await cryptoApi.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256
  );
  return new Uint8Array(bits);
}
function prompt(query, hidden) {
  return new Promise((resolve) => {
    process.stdout.write(query);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (hidden && stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let input = '';
    const onData = (ch) => {
      ch = ch.toString();
      if (ch === '\n' || ch === '\r') { cleanup(); process.stdout.write('\n'); resolve(input); }
      else if (ch === CTRL_C || ch === CTRL_D) { cleanup(); process.stdout.write('\n'); process.exit(1); }
      else if (ch === BACKSPACE || ch === '\b') { input = input.slice(0, -1); }
      else { input += ch; if (!hidden) return; }
    };
    function cleanup() {
      if (hidden && stdin.isTTY) stdin.setRawMode(wasRaw);
      stdin.pause();
      stdin.removeListener('data', onData);
    }
    stdin.on('data', onData);
  });
}

(async () => {
  console.log('\nPaste the ADMIN_PASSWORD_HASH exactly as it appears in Cloudflare.');
  console.log('(It looks like 32 hex characters, a colon, then 64 hex characters.)\n');
  const rawHash = await prompt('ADMIN_PASSWORD_HASH: ', false);
  const password = await prompt('Password to test (hidden): ', true);

  const trimmed = rawHash.trim();
  if (rawHash !== trimmed) {
    console.log('\n  ! The value you pasted has leading or trailing whitespace.');
    console.log('    That alone can break the login. Re-paste it into Cloudflare without it.');
  }

  const parts = trimmed.split(':');
  if (parts.length !== 2) {
    console.log(`\n  X Wrong shape: expected one colon, found ${parts.length - 1}.`);
    process.exit(1);
  }
  const [saltHex, hashHex] = parts.map((s) => s.trim().toLowerCase());

  let bad = false;
  if (!/^[0-9a-f]+$/.test(saltHex) || saltHex.length !== 32) {
    console.log(`\n  X Salt should be 32 hex characters, got ${saltHex.length}.`); bad = true;
  }
  if (!/^[0-9a-f]+$/.test(hashHex) || hashHex.length !== 64) {
    console.log(`  X Hash should be 64 hex characters, got ${hashHex.length}.`); bad = true;
  }
  if (bad) {
    console.log('\n  The stored value is malformed — regenerate it with generate-admin-hash.js.');
    process.exit(1);
  }

  const computed = toHex(await hashPassword(password, fromHex(saltHex)));
  if (computed === hashHex) {
    console.log('\n  OK  This password MATCHES this hash.');
    console.log('      If the site still rejects you, the problem is ADMIN_EMAIL, not the password.');
  } else {
    console.log('\n  X   This password does NOT match this hash.');
    console.log('      Either the password is different, or the hash in Cloudflare came from');
    console.log('      a different run. Regenerate with generate-admin-hash.js and re-paste.');
  }
})();
