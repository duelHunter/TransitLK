/**
 * Where a signed-in user starts in the web portal. Passengers and conductors work in their own
 * mobile apps, so the portal has no screens for them (null).
 */
export function landingPath(role: string): string | null {
  if (role === 'OPERATOR') return '/operator';
  if (role === 'ADMIN') return '/trips';
  return null;
}
