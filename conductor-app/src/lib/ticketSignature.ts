import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { sha384, sha512 } from '@noble/hashes/sha512';

export interface SignatureCheck {
  ok: boolean;
  reason: string;
  ticketId?: string;
}

// React Native has no Web Crypto, so the HMAC is computed in pure JS.
const HASH_BY_ALG = new Map<string, typeof sha256>([
  ['HS256', sha256],
  ['HS384', sha384],
  ['HS512', sha512],
]);

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function decodeBase64Url(input: string): Uint8Array {
  const clean = input.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const ch of clean) {
    const value = BASE64URL.indexOf(ch);
    if (value < 0) throw new Error('not base64url');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
      buffer &= (1 << bits) - 1;
    }
  }
  return out.slice(0, index);
}

/** Ticket claims are ASCII (uuids, numbers), so a byte-per-character conversion is enough. */
function bytesToText(bytes: Uint8Array): string {
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return text;
}

function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Checks a ticket's signature and expiry on the device (report section 6.4: validators verify
 * authenticity offline; only the single-use check needs the server).
 */
export function verifyTicketSignature(qrCode: string, secret: string, nowMs: number = Date.now()): SignatureCheck {
  const parts = qrCode.trim().split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'Not a signed ticket' };
  }
  try {
    const header = JSON.parse(bytesToText(decodeBase64Url(parts[0])));
    const claims = JSON.parse(bytesToText(decodeBase64Url(parts[1])));
    const hash = HASH_BY_ALG.get(String(header.alg));
    if (!hash) {
      return { ok: false, reason: 'Unsupported signature algorithm' };
    }
    const expected = hmac(hash, asciiBytes(secret), asciiBytes(`${parts[0]}.${parts[1]}`));
    if (!sameBytes(expected, decodeBase64Url(parts[2]))) {
      return { ok: false, reason: 'Invalid signature' };
    }
    if (typeof claims.exp === 'number' && claims.exp * 1000 <= nowMs) {
      return { ok: false, reason: 'Ticket expired' };
    }
    return { ok: true, reason: 'Signature valid', ticketId: String(claims.sub) };
  } catch {
    return { ok: false, reason: 'Malformed ticket' };
  }
}
