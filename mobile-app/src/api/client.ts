import axios from 'axios';
import { API_BASE_URL, TRACKING_URL } from '../config';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 10000 });

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

/** Talks to tracking-service directly; callers pass the per-ticket track token themselves. */
export const trackingApi = axios.create({ baseURL: TRACKING_URL, timeout: 10000 });
