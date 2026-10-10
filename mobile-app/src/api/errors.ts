import { isAxiosError } from 'axios';

export function errorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) {
    return fallback;
  }
  if (!err.response) {
    return 'Cannot reach the server. Check EXPO_PUBLIC_API_HOST in .env and that the phone is on the same Wi-Fi.';
  }
  return err.response.data?.message ?? err.message;
}
