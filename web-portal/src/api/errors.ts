import { isAxiosError } from 'axios';

export function errorMessage(err: unknown, fallback: string): string {
  return isAxiosError(err) ? (err.response?.data?.message ?? err.message) : fallback;
}
