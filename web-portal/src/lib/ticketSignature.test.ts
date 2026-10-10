import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyTicketSignature } from './ticketSignature.ts';

const SECRET = 'transitlk-ticket-signing-secret-32bytes-min';

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

function makeToken(claims: Record<string, unknown>, secret = SECRET, alg = 'HS256') {
  const header = b64url(JSON.stringify({ alg }));
  const payload = b64url(JSON.stringify(claims));
  const hmac = alg === 'HS256' ? 'sha256' : alg === 'HS384' ? 'sha384' : 'sha512';
  const sig = createHmac(hmac, secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

const NOW = Date.parse('2026-10-10T08:00:00Z');
const future = Math.floor(NOW / 1000) + 3600;
const past = Math.floor(NOW / 1000) - 60;

test('accepts a correctly signed, unexpired ticket and returns its id', async () => {
  const result = await verifyTicketSignature(makeToken({ sub: 'ticket-1', exp: future }), SECRET, NOW);
  assert.deepEqual(result, { ok: true, reason: 'Signature valid', ticketId: 'ticket-1' });
});

test('accepts HS384 and HS512 tokens', async () => {
  for (const alg of ['HS384', 'HS512']) {
    const result = await verifyTicketSignature(makeToken({ sub: 't', exp: future }, SECRET, alg), SECRET, NOW);
    assert.equal(result.ok, true, alg);
  }
});

test('rejects a token signed with a different secret', async () => {
  const result = await verifyTicketSignature(
    makeToken({ sub: 't', exp: future }, 'another-secret-another-secret-123456'),
    SECRET,
    NOW,
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'Invalid signature');
});

test('rejects a tampered payload', async () => {
  const [h, , s] = makeToken({ sub: 't', exp: future }).split('.');
  const forged = `${h}.${b64url(JSON.stringify({ sub: 'someone-else', exp: future }))}.${s}`;
  const result = await verifyTicketSignature(forged, SECRET, NOW);
  assert.equal(result.ok, false);
});

test('rejects an expired ticket', async () => {
  const result = await verifyTicketSignature(makeToken({ sub: 't', exp: past }), SECRET, NOW);
  assert.deepEqual(result, { ok: false, reason: 'Ticket expired' });
});

test('rejects input that is not a JWT', async () => {
  assert.equal((await verifyTicketSignature('hello', SECRET, NOW)).ok, false);
  assert.equal((await verifyTicketSignature('a.b.c', SECRET, NOW)).ok, false);
  assert.equal((await verifyTicketSignature('', SECRET, NOW)).ok, false);
});

test('rejects an unsupported algorithm', async () => {
  const header = b64url(JSON.stringify({ alg: 'none' }));
  const payload = b64url(JSON.stringify({ sub: 't', exp: future }));
  const result = await verifyTicketSignature(`${header}.${payload}.x`, SECRET, NOW);
  assert.deepEqual(result, { ok: false, reason: 'Unsupported signature algorithm' });
});
