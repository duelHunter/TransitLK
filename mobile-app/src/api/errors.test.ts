import { AxiosError } from 'axios';
import { errorMessage, isSessionExpired } from './errors';

function withResponse(status: number, data: unknown) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: {} as never,
    data,
  });
}

describe('errorMessage', () => {
  it('uses the server message when there is one', () => {
    expect(errorMessage(withResponse(409, { message: 'Trip is not in progress' }), 'fallback')).toBe(
      'Trip is not in progress',
    );
  });

  it('explains an unreachable server', () => {
    const noResponse = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(errorMessage(noResponse, 'fallback')).toMatch(/cannot reach the server/i);
  });

  it('falls back for anything else', () => {
    expect(errorMessage(new Error('boom'), 'Something failed')).toBe('Something failed');
    expect(errorMessage(withResponse(500, {}), 'Something failed')).toBe('Request failed');
  });
});

describe("session expiry", () => {
  it("treats a 401 or 403 with no server message as an expired session", () => {
    expect(isSessionExpired(withResponse(403, ""))).toBe(true);
    expect(isSessionExpired(withResponse(401, undefined))).toBe(true);
    expect(isSessionExpired(withResponse(403, {}))).toBe(true);
  });

  it("does not treat business errors as an expired session", () => {
    expect(isSessionExpired(withResponse(403, { message: "Not your ticket" }))).toBe(false);
    expect(isSessionExpired(withResponse(401, { message: "Invalid credentials" }))).toBe(false);
    expect(isSessionExpired(withResponse(409, { message: "Trip is not in progress" }))).toBe(false);
    expect(isSessionExpired(withResponse(500, ""))).toBe(false);
    expect(isSessionExpired(new Error("boom"))).toBe(false);
  });

  it("tells the user to sign in again instead of showing a raw status code", () => {
    expect(errorMessage(withResponse(403, ""), "fallback")).toBe("Your session has expired. Please sign in again.");
  });
});
