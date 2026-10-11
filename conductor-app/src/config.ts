// The laptop running docker compose. Phone: its LAN IP (e.g. 192.168.1.50).
// Android emulator: 10.0.2.2. Set it in conductor-app/.env as EXPO_PUBLIC_API_HOST.
const host = process.env.EXPO_PUBLIC_API_HOST ?? 'localhost';

export const API_BASE_URL = `http://${host}:8000`;

/**
 * Same value as ticketing-service TICKET_SIGNING_SECRET. It lets the phone check a ticket's
 * signature with no connection. (A production system would ship only a public key.)
 */
export const TICKET_SIGNING_SECRET = process.env.EXPO_PUBLIC_TICKET_SIGNING_SECRET ?? '';
