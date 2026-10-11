import { isAxiosError } from 'axios';

/**
 * A 401/403 with no message in the body is how the backend rejects a missing, invalid or expired
 * login token. Business refusals (e.g. "Not your ticket") always carry a message.
 */
export function isSessionExpired(err: unknown): boolean {
  if (!isAxiosError(err) || !err.response) {
    return false;
  }
  const { status, data } = err.response;
  return (status === 401 || status === 403) && !data?.message;
}

export function errorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) {
    return fallback;
  }
  if (!err.response) {
    return 'Cannot reach the server. Check EXPO_PUBLIC_API_HOST in .env and that the phone is on the same Wi-Fi.';
  }
  if (isSessionExpired(err)) {
    return 'Your session has expired. Please sign in again.';
  }
  return err.response.data?.message ?? err.message;
}
