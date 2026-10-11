import { verifyTicketSignature } from './ticketSignature';

// Known-answer vectors, generated independently with Node's crypto (HMAC over "header.payload").
const SECRET = 'transitlk-ticket-signing-secret-32bytes-min';
const NOW = Date.parse('2026-10-10T08:00:00Z');

const VALID = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0aWNrZXQtMSIsImV4cCI6NDEwMjQ0NDgwMH0.7Ey2bHU8sr1Db8Umh74Hqxk2Zhs07oNXob4sInVJwSI'; // sub=ticket-1, exp=2100-01-01
const HS384 = 'eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJ0aWNrZXQtMzg0IiwiZXhwIjo0MTAyNDQ0ODAwfQ.BHY__0jFibo61qJxw5OqmSJ3WiXACWZGBLl2yyX8yerGIvcXHDANNXO52Gbrb0LB'; // sub=ticket-384
const HS512 = 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJ0aWNrZXQtNTEyIiwiZXhwIjo0MTAyNDQ0ODAwfQ.Gnw7fs1LCeoHADBs0yOjRo5g44GlMMpvUAl7wTgcUSRv3BnRnTKY2aUm0IuBhKrZOcIdapabL9IMx3mQ5w6NWQ'; // sub=ticket-512
const EXPIRED = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0aWNrZXQtb2xkIiwiZXhwIjoxMDAwMDAwMDAwfQ.igZZldlGPcIr723KPL8oplindoK5T2uYM-YdsW0RZZk'; // exp=2001-09-09
const OTHER_SECRET = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0aWNrZXQteCIsImV4cCI6NDEwMjQ0NDgwMH0.DkoRY8-dYt-cT9s25pOUR8WmK0-zEexi-oBwh7rQ0h8'; // signed with a different secret
const TAMPERED = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzb21lb25lLWVsc2UiLCJleHAiOjQxMDI0NDQ4MDB9.7Ey2bHU8sr1Db8Umh74Hqxk2Zhs07oNXob4sInVJwSI'; // payload swapped, signature kept
const NONE_ALG = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0IiwiZXhwIjo0MTAyNDQ0ODAwfQ.x';

describe('verifyTicketSignature', () => {
  it('accepts a correctly signed, unexpired ticket and returns its id', () => {
    expect(verifyTicketSignature(VALID, SECRET, NOW)).toEqual({
      ok: true,
      reason: 'Signature valid',
      ticketId: 'ticket-1',
    });
  });

  it('accepts HS384 and HS512 tokens', () => {
    expect(verifyTicketSignature(HS384, SECRET, NOW).ok).toBe(true);
    expect(verifyTicketSignature(HS512, SECRET, NOW).ok).toBe(true);
  });

  it('rejects a token signed with a different secret', () => {
    expect(verifyTicketSignature(OTHER_SECRET, SECRET, NOW)).toEqual({ ok: false, reason: 'Invalid signature' });
  });

  it('rejects a tampered payload', () => {
    expect(verifyTicketSignature(TAMPERED, SECRET, NOW).ok).toBe(false);
  });

  it('rejects an expired ticket', () => {
    expect(verifyTicketSignature(EXPIRED, SECRET, NOW)).toEqual({ ok: false, reason: 'Ticket expired' });
  });

  it('rejects input that is not a JWT', () => {
    expect(verifyTicketSignature('hello', SECRET, NOW).ok).toBe(false);
    expect(verifyTicketSignature('a.b.c', SECRET, NOW).ok).toBe(false);
    expect(verifyTicketSignature('', SECRET, NOW).ok).toBe(false);
  });

  it('rejects an unsupported algorithm', () => {
    expect(verifyTicketSignature(NONE_ALG, SECRET, NOW)).toEqual({
      ok: false,
      reason: 'Unsupported signature algorithm',
    });
  });
});
