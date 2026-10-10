export interface SignatureCheck {
  ok: boolean;
  reason: string;
  ticketId?: string;
}

const HASH_BY_ALG: Record<string, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
};

function decodeSegment(segment: string) {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function decodeJson(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeSegment(segment)));
}

/**
 * Checks a ticket's signature and expiry locally (report section 6.4: validators verify
 * authenticity offline; only the single-use check needs the server).
 */
export async function verifyTicketSignature(
  qrCode: string,
  secret: string,
  nowMs: number = Date.now(),
): Promise<SignatureCheck> {
  const parts = qrCode.trim().split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'Not a signed ticket' };
  }
  try {
    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    const hash = HASH_BY_ALG[String(header.alg)];
    if (!hash) {
      return { ok: false, reason: 'Unsupported signature algorithm' };
    }
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash }, false, ['verify']);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeSegment(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) {
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
