import axios from 'axios';
import { API_BASE_URL, TRACKING_URL } from '../config';
import { isSessionExpired } from './errors';

let authToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Called once when a request made with a login token is rejected as unauthenticated. */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 10000 });

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // Only when we actually sent a token: a wrong password at sign-in is not an expired session.
    if (authToken && isSessionExpired(error)) {
      onSessionExpired?.();
    }
    return Promise.reject(error);
  },
);

/** Talks to tracking-service directly; callers pass the per-ticket track token themselves. */
export const trackingApi = axios.create({ baseURL: TRACKING_URL, timeout: 10000 });
