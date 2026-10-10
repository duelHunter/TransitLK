// The laptop running docker compose. Phone: its LAN IP (e.g. 192.168.1.50).
// Android emulator: 10.0.2.2. Set it in mobile-app/.env as EXPO_PUBLIC_API_HOST.
const host = process.env.EXPO_PUBLIC_API_HOST ?? 'localhost';

export const API_BASE_URL = `http://${host}:8000`;
export const TRACKING_URL = `http://${host}:8083`;
