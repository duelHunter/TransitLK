/**
 * Whether a signed-out user must be sent to the sign-in screen. Decided at the root of the app so it
 * applies to every screen, including ones stacked on top of the tabs (e.g. Track bus), where a
 * redirect inside a nested layout would never fire.
 */
export function shouldRedirectToLogin(
  ready: boolean,
  signedIn: boolean,
  firstSegment: string | undefined,
): boolean {
  if (!ready || signedIn) return false;
  if (firstSegment === undefined) return false; // the index route redirects by itself
  return firstSegment !== '(auth)';
}
