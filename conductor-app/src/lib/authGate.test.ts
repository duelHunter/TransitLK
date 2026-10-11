import { shouldRedirectToLogin } from './authGate';

describe('shouldRedirectToLogin', () => {
  it('sends a signed-out user on a protected screen to sign in', () => {
    expect(shouldRedirectToLogin(true, false, 'track')).toBe(true);
    expect(shouldRedirectToLogin(true, false, '(tabs)')).toBe(true);
  });

  it('leaves a signed-out user alone on the auth screens', () => {
    expect(shouldRedirectToLogin(true, false, '(auth)')).toBe(false);
  });

  it('does nothing for a signed-in user', () => {
    expect(shouldRedirectToLogin(true, true, '(tabs)')).toBe(false);
    expect(shouldRedirectToLogin(true, true, 'track')).toBe(false);
  });

  it('waits until stored credentials have been read', () => {
    expect(shouldRedirectToLogin(false, false, '(tabs)')).toBe(false);
  });

  it('does not act on the root index route, which redirects by itself', () => {
    expect(shouldRedirectToLogin(true, false, undefined)).toBe(false);
  });
});
