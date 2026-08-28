#!/usr/bin/env node
/**
 * Run this LOCALLY on your own machine: node scripts/generate-admin-hash.js
 *
 * It asks for a password (typed, not shown on screen), hashes it the same way
 * functions/_lib/auth.js does, and prints a string to paste into Cloudflare
 * as the ADMIN_PASSWORD_HASH environment variable.
 *
 * The actual password is never saved to a file, printed, or sent anywhere —
 * only the hash ever leaves this terminal.
 */

const { webcrypto } = require('crypto');
const cryptoApi = webcrypto;

// Control characters built from char codes so this file stays plain ASCII text.
const CTRL_C = String.fromCharCode(3);
const CTRL_D = String.fromCharCode(4);
const BACKSPACE = String.fromCharCode(127);

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, saltBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const derivedBits = await cryptoApi.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return new Uint8Array(derivedBits);
}

function promptHidden(query) {
  return new Promise((resolve) => {
    process.stdout.write(query);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let input = '';
    const onData = (char) => {
      char = char.toString();
      if (char === '\n' || char === '\r') {
        cleanup();
        process.stdout.write('\n');
        resolve(input);
      } else if (char === CTRL_C || char === CTRL_D) {
        cleanup();
        process.stdout.write('\n');
        process.exit(1);
      } else if (char === BACKSPACE || char === '\b') {
        input = input.slice(0, -1);
      } else {
        input += char;
      }
    };
    function cleanup() {
      if (stdin.isTTY) stdin.setRawMode(wasRaw);
      stdin.pause();
      stdin.removeListener('data', onData);
    }
    stdin.on('data', onData);
  });
}

(async () => {
  const password = await promptHidden('Choose the admin password (input hidden): ');
  const confirm = await promptHidden('Type it again to confirm: ');

  if (password !== confirm) {
    console.error('\nPasswords did not match. Run the script again.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('\nUse at least 8 characters.');
    process.exit(1);
  }

  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);

  console.log('\nPaste this as ADMIN_PASSWORD_HASH in Cloudflare Pages settings:\n');
  console.log(toHex(salt) + ':' + toHex(hash));
  console.log('\nAlso generate a SESSION_SECRET with:  openssl rand -hex 32');
  console.log('The password itself was never saved, logged, or sent anywhere — only the hash above.');
})();
