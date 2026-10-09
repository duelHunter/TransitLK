import axios from 'axios';

// Kong (or, in dev without the gateway running, whichever base URL is configured) routes
// requests to the right microservice by path prefix, so the web portal only needs one client.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
export const TRACKING_WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8083';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('transitlk_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
