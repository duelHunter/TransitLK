# TransitLK Expo Passenger App Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the passenger mobile app: sign in, search and book, hold QR tickets, track only the bus you paid for, and receive in-app notifications.

**Architecture:** A new `mobile-app/` Expo (React Native, TypeScript, Expo Router) project that talks to the existing backend over HTTP through Kong (`:8000`) and opens a WebSocket straight to tracking-service (`:8083`). Anything that can be wrong without anyone noticing (formatting, notification diffing, the map script, error messages) is a small pure module with jest tests; screens stay thin. The live map is a Leaflet page inside a `react-native-webview`, moved by injected JavaScript.

**Tech Stack:** Expo SDK (current stable at scaffold time), Expo Router, React Native, TypeScript, axios, socket.io-client, expo-secure-store, react-native-webview, jest-expo.

**Spec:** `docs/superpowers/specs/2026-10-09-transitlk-local-demo-scope-design.md`
**Depends on:** `docs/superpowers/plans/2026-10-10-backend-foundation.md` (Plan 1) being implemented and the stack running. Plan 2 is independent of this plan.

## Global Constraints

- Project folder is `mobile-app/` at the repository root (sibling of `web-portal/`). Do not add Expo packages by version number; use `npx expo install <pkg>` so versions match the installed SDK.
- Backend base URLs come from one file, `src/config.ts`, built from `EXPO_PUBLIC_API_HOST`: API `http://<host>:8000` (Kong) and tracking `http://<host>:8083`. Physical phone: the laptop's LAN IP. Android emulator: `10.0.2.2`. The phone and laptop must be on the same Wi-Fi, and the laptop firewall must allow inbound TCP 8000, 8083 and 8081 (Metro) on the private network.
- API calls used (all through Kong unless stated): `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/otp/verify`, `GET /api/routes/search?origin&destination`, `POST /api/bookings` (`{ tripId, paymentMethod: "CARD" }`), `GET /api/tickets/mine`, `POST /api/tickets/{id}/track-token`, `GET /api/notifications`, `POST /api/notifications/{id}/read`; direct to tracking: `GET /api/vehicles/{reg}` with `Authorization: Bearer <track token>` and socket.io with handshake `auth: { token }`, event `location:update`.
- Ticket QR is shown from the `qrImageBase64` PNG that `GET /api/tickets/mine` already returns, so no QR library is needed.
- Demo login prefilled on the login screen: `passenger@transitlk.lk` / `demo1234` (seeded by Plan 1). Registration always creates role `PASSENGER`; its OTP is printed in the user-service container log (`docker compose logs user-service | grep "OTP for"`), as in the web portal.
- Notifications are in-app only (polling every 5 seconds while the app is open). Expo push notifications are out of scope (first cut in the spec's cut order).
- Deviation from the spec: the map is a single Leaflet-in-WebView implementation rather than `react-native-maps` with a WebView fallback. It behaves the same in Expo Go on iOS and Android, needs no API keys and avoids the Google Maps setup; it needs internet access on the phone for the Leaflet script and OpenStreetMap tiles.
- Pure-module tests run with `npm test` (jest-expo). Screens are verified manually on a device/emulator.

## File Structure

```
mobile-app/
  app.json                      scheme + plugins
  package.json                  main = expo-router/entry, jest preset
  .env / .env.example           EXPO_PUBLIC_API_HOST
  app/
    _layout.tsx                 providers + root Stack
    index.tsx                   redirect by auth state
    (auth)/_layout.tsx, login.tsx, register.tsx, verify-otp.tsx
    (tabs)/_layout.tsx, book.tsx, tickets.tsx, notifications.tsx
    track/[ticketId].tsx
  src/
    config.ts
    api/types.ts, client.ts, errors.ts
    auth/AuthContext.tsx
    notifications/NotificationsProvider.tsx
    hooks/useBusTracking.ts
    lib/format.ts, notifications.ts, mapHtml.ts
    ui/theme.ts, components.tsx, Toast.tsx
  src/lib/*.test.ts, src/api/errors.test.ts
```

---

### Task 1: Scaffold the Expo project

**Files:**
- Create: `mobile-app/` (generated), `mobile-app/.env.example`, `mobile-app/.env`, `mobile-app/src/config.ts`, `mobile-app/app/_layout.tsx`, `mobile-app/app/index.tsx`
- Modify: `mobile-app/package.json`, `mobile-app/app.json`, `mobile-app/.gitignore`
- Delete: `mobile-app/App.tsx`, `mobile-app/index.ts` (if generated)

**Interfaces:**
- Produces: `API_BASE_URL: string`, `TRACKING_URL: string` exported from `src/config.ts`; a running Expo Router app showing a placeholder screen; `npm test` wired to jest-expo.

- [ ] **Step 1: Generate the project and install dependencies**

Run from the repository root:

```bash
npx create-expo-app@latest mobile-app --template blank-typescript
cd mobile-app
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar expo-secure-store react-native-webview
npm install axios socket.io-client
npm install --save-dev jest-expo jest @types/jest
npx expo install --check
```

Expected: every command exits 0 (`expo install --check` may offer to fix versions: accept).

- [ ] **Step 2: Wire Expo Router and jest**

In `package.json` set `"main": "expo-router/entry"`, add to `scripts`: `"test": "jest"`, and add a top-level block:

```json
  "jest": {
    "preset": "jest-expo"
  }
```

In `app.json`, inside the `expo` object add:

```json
    "scheme": "transitlk",
    "plugins": ["expo-router", "expo-secure-store"]
```

(keep any existing `plugins` entries and append these two).

Delete `App.tsx` and `index.ts` if they exist. Append `.env` to `mobile-app/.gitignore`.

- [ ] **Step 3: Add config and placeholder screens**

`src/config.ts`:

```ts
// The laptop running docker compose. Phone: its LAN IP (e.g. 192.168.1.50).
// Android emulator: 10.0.2.2. Set it in mobile-app/.env as EXPO_PUBLIC_API_HOST.
const host = process.env.EXPO_PUBLIC_API_HOST ?? 'localhost';

export const API_BASE_URL = `http://${host}:8000`;
export const TRACKING_URL = `http://${host}:8083`;
```

`.env.example`:

```
EXPO_PUBLIC_API_HOST=192.168.1.50
```

Create `.env` with the laptop's real LAN IP (find it with `ipconfig` on Windows, the "IPv4 Address" of the Wi-Fi adapter).

`app/_layout.tsx`:

```tsx
import { Slot } from 'expo-router';

export default function RootLayout() {
  return <Slot />;
}
```

`app/index.tsx`:

```tsx
import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>TransitLK</Text>
    </View>
  );
}
```

- [ ] **Step 4: Verify it boots**

Run: `npx tsc --noEmit` then `npx expo start`
Expected: `tsc` exits 0; Metro starts. Scan the QR code with the Expo Go app (or press `a` for an Android emulator): the phone shows the word "TransitLK". Stop Metro with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add mobile-app
git commit -m "feat(mobile): scaffold Expo Router app"
```

---

### Task 2: Pure helper modules

**Files:**
- Create: `mobile-app/src/lib/format.ts`, `mobile-app/src/lib/notifications.ts`, `mobile-app/src/lib/mapHtml.ts`
- Test: `mobile-app/src/lib/format.test.ts`, `mobile-app/src/lib/notifications.test.ts`, `mobile-app/src/lib/mapHtml.test.ts`

**Interfaces:**
- Produces:
  - `formatMoney(value: number | string): string` -> `"Rs. 222.50"`; `formatDateTime(iso: string): string`; `canTrack(status: string): boolean` (true for `ISSUED`, `VALIDATED`); `statusLabel(status: string): string` (`ISSUED`->`Valid`, `VALIDATED`->`Used`, `CANCELLED`->`Cancelled`, `EXPIRED`->`Expired`, otherwise the input).
  - `interface AppNotification { notificationId: string; type: string; title: string; message: string; seen: boolean; createdAt: string }`; `unreadCount(list: AppNotification[]): number`; `freshUnseen(known: ReadonlySet<string>, list: AppNotification[]): AppNotification[]` (unseen items whose id is not in `known`, oldest first).
  - `buildMapHtml(): string` (a complete Leaflet page defining `window.moveBus(lat, lon)`); `buildMoveScript(lat: number, lon: number): string | null` (JavaScript to inject, `null` for non-finite input).

- [ ] **Step 1: Write the failing tests**

`src/lib/format.test.ts`:

```ts
import { canTrack, formatMoney, statusLabel } from './format';

describe('formatMoney', () => {
  it('renders rupees with two decimals', () => {
    expect(formatMoney(222.5)).toBe('Rs. 222.50');
    expect(formatMoney('100')).toBe('Rs. 100.00');
  });
});

describe('canTrack', () => {
  it('allows only active tickets', () => {
    expect(canTrack('ISSUED')).toBe(true);
    expect(canTrack('VALIDATED')).toBe(true);
    expect(canTrack('CANCELLED')).toBe(false);
    expect(canTrack('EXPIRED')).toBe(false);
  });
});

describe('statusLabel', () => {
  it('maps backend statuses to passenger wording', () => {
    expect(statusLabel('ISSUED')).toBe('Valid');
    expect(statusLabel('VALIDATED')).toBe('Used');
    expect(statusLabel('CANCELLED')).toBe('Cancelled');
    expect(statusLabel('EXPIRED')).toBe('Expired');
    expect(statusLabel('SOMETHING')).toBe('SOMETHING');
  });
});
```

`src/lib/notifications.test.ts`:

```ts
import { freshUnseen, unreadCount } from './notifications';
import type { AppNotification } from './notifications';

const n = (id: string, seen: boolean, createdAt: string): AppNotification => ({
  notificationId: id,
  type: 'TICKET_ISSUED',
  title: `title ${id}`,
  message: 'm',
  seen,
  createdAt,
});

describe('unreadCount', () => {
  it('counts unseen notifications', () => {
    expect(unreadCount([n('a', false, '2026-10-10T08:00:00Z'), n('b', true, '2026-10-10T08:01:00Z'), n('c', false, '2026-10-10T08:02:00Z')])).toBe(2);
    expect(unreadCount([])).toBe(0);
  });
});

describe('freshUnseen', () => {
  it('returns unseen items not yet known, oldest first', () => {
    const list = [
      n('new2', false, '2026-10-10T08:03:00Z'),
      n('known', false, '2026-10-10T08:01:00Z'),
      n('seen', true, '2026-10-10T08:02:00Z'),
      n('new1', false, '2026-10-10T08:02:30Z'),
    ];
    const fresh = freshUnseen(new Set(['known']), list);
    expect(fresh.map((x) => x.notificationId)).toEqual(['new1', 'new2']);
  });

  it('returns nothing when everything is known', () => {
    expect(freshUnseen(new Set(['a']), [n('a', false, '2026-10-10T08:00:00Z')])).toEqual([]);
  });
});
```

`src/lib/mapHtml.test.ts`:

```ts
import { buildMapHtml, buildMoveScript } from './mapHtml';

describe('buildMoveScript', () => {
  it('builds a call to window.moveBus with the coordinates', () => {
    expect(buildMoveScript(6.9271, 79.8612)).toBe('window.moveBus(6.9271, 79.8612); true;');
  });

  it('refuses non-finite coordinates', () => {
    expect(buildMoveScript(NaN, 79.8)).toBeNull();
    expect(buildMoveScript(6.9, Infinity)).toBeNull();
  });
});

describe('buildMapHtml', () => {
  it('defines moveBus and loads Leaflet', () => {
    const html = buildMapHtml();
    expect(html).toContain('window.moveBus');
    expect(html).toContain('leaflet');
    expect(html).toContain('<div id="map">');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (in `mobile-app`): `npm test`
Expected: FAIL, "Cannot find module './format'" (and the two others).

- [ ] **Step 3: Implement**

`src/lib/format.ts`:

```ts
export function formatMoney(value: number | string): string {
  return `Rs. ${Number(value).toFixed(2)}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function canTrack(status: string): boolean {
  return status === 'ISSUED' || status === 'VALIDATED';
}

const STATUS_LABELS: Record<string, string> = {
  ISSUED: 'Valid',
  VALIDATED: 'Used',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
```

`src/lib/notifications.ts`:

```ts
export interface AppNotification {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  seen: boolean;
  createdAt: string;
}

export function unreadCount(list: AppNotification[]): number {
  return list.filter((n) => !n.seen).length;
}

/** Unseen notifications the app has not announced yet, oldest first. */
export function freshUnseen(known: ReadonlySet<string>, list: AppNotification[]): AppNotification[] {
  return list
    .filter((n) => !n.seen && !known.has(n.notificationId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
```

`src/lib/mapHtml.ts`:

```ts
/** Leaflet page for the WebView; the app moves the bus by injecting buildMoveScript(...). */
export function buildMapHtml(): string {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0;padding:0}</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('map').setView([7.5, 80.5], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
var marker = null;
window.moveBus = function (lat, lon) {
  if (!marker) {
    marker = L.marker([lat, lon]).addTo(map);
    map.setView([lat, lon], 12);
  } else {
    marker.setLatLng([lat, lon]);
    map.panTo([lat, lon]);
  }
};
</script>
</body>
</html>`;
}

export function buildMoveScript(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return `window.moveBus(${lat}, ${lon}); true;`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (9 tests across 3 suites).

- [ ] **Step 5: Commit**

```bash
git add mobile-app
git commit -m "feat(mobile): format, notification and map helpers with tests"
```

---

### Task 3: API client, error helper and auth state

**Files:**
- Create: `mobile-app/src/api/types.ts`, `mobile-app/src/api/client.ts`, `mobile-app/src/api/errors.ts`, `mobile-app/src/auth/AuthContext.tsx`
- Test: `mobile-app/src/api/errors.test.ts`

**Interfaces:**
- Consumes: `API_BASE_URL`, `TRACKING_URL` (Task 1).
- Produces:
  - `api` (axios instance on Kong, adds `Authorization: Bearer <token>` once `setAuthToken(token)` has been called), `trackingApi` (axios instance on tracking-service, no automatic auth), `setAuthToken(token: string | null): void`.
  - `errorMessage(err: unknown, fallback: string): string` (server `message` if present; a "cannot reach the server" text when there was no response; else the fallback).
  - Types: `UserResponse`, `AuthResponse`, `TripSearchResult`, `TicketResponse`, `TrackTokenResponse`, `LivePosition`.
  - `AuthProvider`, `useAuth(): { user: UserResponse | null; ready: boolean; login(emailOrPhone, password): Promise<void>; register(data: RegisterData): Promise<string>; verifyOtp(emailOrPhone, otp): Promise<void>; logout(): Promise<void> }`; `RegisterData = { name: string; email: string; phone: string; password: string }`.

- [ ] **Step 1: Write the failing test**

`src/api/errors.test.ts`:

```ts
import { AxiosError } from 'axios';
import { errorMessage } from './errors';

function withResponse(status: number, data: unknown) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: {} as never,
    data,
  });
}

describe('errorMessage', () => {
  it('uses the server message when there is one', () => {
    expect(errorMessage(withResponse(409, { message: 'Trip is not in progress' }), 'fallback')).toBe('Trip is not in progress');
  });

  it('explains an unreachable server', () => {
    const noResponse = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(errorMessage(noResponse, 'fallback')).toMatch(/cannot reach the server/i);
  });

  it('falls back for anything else', () => {
    expect(errorMessage(new Error('boom'), 'Something failed')).toBe('Something failed');
    expect(errorMessage(withResponse(500, {}), 'Something failed')).toBe('Request failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- errors`
Expected: FAIL, "Cannot find module './errors'".

- [ ] **Step 3: Implement the helpers**

`src/api/errors.ts`:

```ts
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
```

`src/api/types.ts`:

```ts
export interface UserResponse {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  enabled: boolean;
  walletBalance: number;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresInSeconds: number;
  user: UserResponse;
}

export interface TripSearchResult {
  tripId: string;
  routeName: string;
  origin: string;
  destination: string;
  vehicleReg: string;
  departureTime: string;
  arrivalTime: string;
  fare: number;
  availableSeats: number;
  totalSeats: number;
}

export interface TicketResponse {
  ticketId: string;
  tripId: string;
  routeName: string;
  origin: string;
  destination: string;
  departureTime: string;
  seatNo: number | null;
  fare: number;
  status: string;
  qrCode: string;
  qrImageBase64: string;
  issuedAt: string;
  validatedAt: string | null;
}

export interface TrackTokenResponse {
  token: string;
  vehicleReg: string;
  expiresAt: string;
}

export interface LivePosition {
  vehicleReg: string;
  lat: number;
  lon: number;
  speedKmh: number;
  heading: number;
  timestamp: string;
}
```

`src/api/client.ts`:

```ts
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
```

- [ ] **Step 4: Write the auth context**

`src/auth/AuthContext.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, setAuthToken } from '../api/client';
import type { AuthResponse, UserResponse } from '../api/types';

const TOKEN_KEY = 'transitlk_token';
const USER_KEY = 'transitlk_user';

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface AuthContextValue {
  user: UserResponse | null;
  ready: boolean;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<string>;
  verifyOtp: (emailOrPhone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [token, rawUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (token && rawUser) {
          setAuthToken(token);
          setUser(JSON.parse(rawUser) as UserResponse);
        }
      } catch {
        // unreadable secure storage: start signed out
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (auth: AuthResponse) => {
    setAuthToken(auth.token);
    await SecureStore.setItemAsync(TOKEN_KEY, auth.token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(auth.user));
    setUser(auth.user);
  }, []);

  const login = useCallback(
    async (emailOrPhone: string, password: string) => {
      const { data } = await api.post<AuthResponse>('/api/auth/login', { emailOrPhone, password });
      await persist(data);
    },
    [persist],
  );

  const register = useCallback(async (payload: RegisterData) => {
    const { data } = await api.post<{ message: string }>('/api/auth/register', { ...payload, role: 'PASSENGER' });
    return data.message;
  }, []);

  const verifyOtp = useCallback(
    async (emailOrPhone: string, otp: string) => {
      const { data } = await api.post<AuthResponse>('/api/auth/otp/verify', { emailOrPhone, otp });
      await persist(data);
    },
    [persist],
  );

  const logout = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    await SecureStore.deleteItemAsync(USER_KEY).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, verifyOtp, logout }),
    [user, ready, login, register, verifyOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
```

- [ ] **Step 5: Run tests and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS (12 total); `tsc` exits 0.

- [ ] **Step 6: Commit**

```bash
git add mobile-app
git commit -m "feat(mobile): API client, error helper and secure auth state"
```

---

### Task 4: Shared UI, root layout and auth screens

**Files:**
- Create: `mobile-app/src/ui/theme.ts`, `mobile-app/src/ui/components.tsx`, `mobile-app/app/(auth)/_layout.tsx`, `mobile-app/app/(auth)/login.tsx`, `mobile-app/app/(auth)/register.tsx`, `mobile-app/app/(auth)/verify-otp.tsx`
- Modify: `mobile-app/app/_layout.tsx`, `mobile-app/app/index.tsx`

**Interfaces:**
- Consumes: `useAuth`, `AuthProvider` (Task 3), `errorMessage`.
- Produces:
  - `colors` from `src/ui/theme.ts`.
  - `Screen`, `Card`, `Field`, `PrimaryButton`, `ErrorText`, `HintText` from `src/ui/components.tsx` (`Field` takes `label` plus all `TextInput` props; `PrimaryButton` takes `title`, `onPress`, optional `loading`, `disabled`, `secondary`).
  - Routing: `/` redirects to `/(tabs)/book` when signed in, otherwise `/(auth)/login`; login success calls `router.replace('/(tabs)/book')`.

- [ ] **Step 1: Theme and components**

`src/ui/theme.ts`:

```ts
export const colors = {
  primary: '#1d4ed8',
  background: '#f3f4f6',
  card: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  border: '#d1d5db',
  error: '#b91c1c',
  success: '#15803d',
};
```

`src/ui/components.tsx`:

```tsx
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { colors } from './theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.muted} autoCapitalize="none" {...props} />
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  secondary,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={[styles.button, secondary && styles.buttonSecondary, inactive && styles.buttonDisabled]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? <Text style={styles.error}>{message}</Text> : null;
}

export function HintText({ children }: { children: ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: 16, gap: 12 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 6 },
  field: { gap: 4 },
  label: { color: colors.text, fontWeight: '600' },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  button: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700' },
  buttonTextSecondary: { color: colors.primary },
  error: { color: colors.error },
  hint: { color: colors.muted },
});
```

- [ ] **Step 2: Root layout and redirect**

`app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/auth/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="track/[ticketId]" options={{ headerShown: true, title: 'Track your bus' }} />
      </Stack>
    </AuthProvider>
  );
}
```

`app/index.tsx`:

```tsx
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';

export default function Index() {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Redirect href={user ? '/(tabs)/book' : '/(auth)/login'} />;
}
```

- [ ] **Step 3: Auth screens**

`app/(auth)/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerTitle: 'TransitLK' }} />;
}
```

`app/(auth)/login.tsx`:

```tsx
import { useState } from 'react';
import { Text } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { errorMessage } from '../../src/api/errors';
import { useAuth } from '../../src/auth/AuthContext';
import { Card, ErrorText, Field, HintText, PrimaryButton, Screen } from '../../src/ui/components';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  // Prefilled with the seeded demo passenger so the demo needs no typing.
  const [emailOrPhone, setEmailOrPhone] = useState('passenger@transitlk.lk');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    setError(null);
    setLoading(true);
    try {
      await login(emailOrPhone.trim(), password);
      router.replace('/(tabs)/book');
    } catch (err) {
      setError(errorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Sign in</Text>
        <Field label="Email or phone" value={emailOrPhone} onChangeText={setEmailOrPhone} keyboardType="email-address" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <ErrorText message={error} />
        <PrimaryButton title="Sign in" onPress={onLogin} loading={loading} />
        <HintText>Demo passenger is prefilled.</HintText>
      </Card>
      <Link href="/(auth)/register" style={{ textAlign: 'center' }}>
        No account? Register
      </Link>
    </Screen>
  );
}
```

`app/(auth)/register.tsx`:

```tsx
import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { errorMessage } from '../../src/api/errors';
import { useAuth } from '../../src/auth/AuthContext';
import { Card, ErrorText, Field, HintText, PrimaryButton, Screen } from '../../src/ui/components';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function onRegister() {
    setError(null);
    setLoading(true);
    try {
      await register({ ...form, email: form.email.trim(), phone: form.phone.trim() });
      router.push({ pathname: '/(auth)/verify-otp', params: { emailOrPhone: form.email.trim() } });
    } catch (err) {
      setError(errorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Create a passenger account</Text>
        <Field label="Name" value={form.name} onChangeText={update('name')} autoCapitalize="words" />
        <Field label="Email" value={form.email} onChangeText={update('email')} keyboardType="email-address" />
        <Field label="Phone" value={form.phone} onChangeText={update('phone')} keyboardType="phone-pad" />
        <Field label="Password" value={form.password} onChangeText={update('password')} secureTextEntry />
        <ErrorText message={error} />
        <PrimaryButton title="Register" onPress={onRegister} loading={loading} />
        <HintText>
          The activation code is printed in the user-service log: docker compose logs user-service | grep "OTP for"
        </HintText>
      </Card>
    </Screen>
  );
}
```

`app/(auth)/verify-otp.tsx`:

```tsx
import { useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { errorMessage } from '../../src/api/errors';
import { useAuth } from '../../src/auth/AuthContext';
import { Card, ErrorText, Field, HintText, PrimaryButton, Screen } from '../../src/ui/components';

export default function VerifyOtpScreen() {
  const { verifyOtp } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ emailOrPhone: string }>();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onVerify() {
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(params.emailOrPhone, otp.trim());
      router.replace('/(tabs)/book');
    } catch (err) {
      setError(errorMessage(err, 'Verification failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Enter your code</Text>
        <HintText>Account: {params.emailOrPhone}</HintText>
        <Field label="6-digit code" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
        <ErrorText message={error} />
        <PrimaryButton title="Verify and sign in" onPress={onVerify} loading={loading} />
      </Card>
    </Screen>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Manual check** (Plan 1 stack running; `npx expo start`; open in Expo Go)

The app opens on **Sign in** with the demo passenger prefilled. Press **Sign in**: since the tabs screens do not exist yet, the next screen shows an "Unmatched route" page. That is expected until Task 5. A wrong password shows the server's "Invalid credentials". Turn the laptop's Wi-Fi off briefly or change the API host: the "Cannot reach the server" message shows.

- [ ] **Step 6: Commit**

```bash
git add mobile-app
git commit -m "feat(mobile): shared UI, root routing and auth screens"
```

---

### Task 5: Tabs and Search & Book screen

**Files:**
- Create: `mobile-app/app/(tabs)/_layout.tsx`, `mobile-app/app/(tabs)/book.tsx`, `mobile-app/app/(tabs)/tickets.tsx` (stub), `mobile-app/app/(tabs)/notifications.tsx` (stub)

**Interfaces:**
- Consumes: `api`, `errorMessage`, `useAuth`, `formatMoney`, `formatDateTime`, `TripSearchResult`, UI components.
- Produces: tab layout with screens `book`, `tickets`, `notifications`; the layout redirects to login when signed out and shows a Logout button in the header.

- [ ] **Step 1: Tabs layout**

`app/(tabs)/_layout.tsx`:

```tsx
import { Pressable, Text } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { colors } from '../../src/ui/theme';

export default function TabsLayout() {
  const { user, ready, logout } = useAuth();
  if (!ready) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: 14, marginBottom: 12 },
        tabBarActiveTintColor: colors.primary,
        headerRight: () => (
          <Pressable onPress={logout} style={{ marginRight: 16 }}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Logout</Text>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="book" options={{ title: 'Book' }} />
      <Tabs.Screen name="tickets" options={{ title: 'My Tickets' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts' }} />
    </Tabs>
  );
}
```

Stubs, so the tabs resolve (each replaced in later tasks):

`app/(tabs)/tickets.tsx`:

```tsx
import { Text } from 'react-native';
import { Screen } from '../../src/ui/components';

export default function TicketsScreen() {
  return (
    <Screen>
      <Text>Tickets</Text>
    </Screen>
  );
}
```

`app/(tabs)/notifications.tsx`:

```tsx
import { Text } from 'react-native';
import { Screen } from '../../src/ui/components';

export default function NotificationsScreen() {
  return (
    <Screen>
      <Text>Alerts</Text>
    </Screen>
  );
}
```

- [ ] **Step 2: Search & Book screen**

`app/(tabs)/book.tsx`:

```tsx
import { useState } from 'react';
import { Text } from 'react-native';
import { api } from '../../src/api/client';
import { errorMessage } from '../../src/api/errors';
import type { TripSearchResult } from '../../src/api/types';
import { formatDateTime, formatMoney } from '../../src/lib/format';
import { Card, ErrorText, Field, HintText, PrimaryButton, Screen } from '../../src/ui/components';
import { colors } from '../../src/ui/theme';

export default function BookScreen() {
  const [origin, setOrigin] = useState('Colombo');
  const [destination, setDestination] = useState('Kandy');
  const [results, setResults] = useState<TripSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSearch() {
    setError(null);
    setMessage(null);
    setSearching(true);
    try {
      const { data } = await api.get<TripSearchResult[]>('/api/routes/search', {
        params: { origin: origin.trim(), destination: destination.trim() },
      });
      setResults(data);
    } catch (err) {
      setError(errorMessage(err, 'Search failed'));
    } finally {
      setSearching(false);
    }
  }

  async function onBook(trip: TripSearchResult) {
    setError(null);
    setMessage(null);
    setBookingId(trip.tripId);
    try {
      await api.post('/api/bookings', { tripId: trip.tripId, paymentMethod: 'CARD' });
      setMessage(`Booked ${trip.routeName} for ${formatMoney(trip.fare)}. Your QR ticket is in My Tickets.`);
      setResults((rs) =>
        rs ? rs.map((r) => (r.tripId === trip.tripId ? { ...r, availableSeats: r.availableSeats - 1 } : r)) : rs,
      );
    } catch (err) {
      setError(errorMessage(err, 'Booking failed'));
    } finally {
      setBookingId(null);
    }
  }

  return (
    <Screen>
      <Card>
        <Field label="From" value={origin} onChangeText={setOrigin} autoCapitalize="words" />
        <Field label="To" value={destination} onChangeText={setDestination} autoCapitalize="words" />
        <PrimaryButton title="Search trips" onPress={onSearch} loading={searching} />
      </Card>

      <ErrorText message={error} />
      {message && <Text style={{ color: colors.success }}>{message}</Text>}

      {results && results.length === 0 && <HintText>No trips found for that route.</HintText>}
      {results?.map((t) => (
        <Card key={t.tripId}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{t.routeName}</Text>
          <Text>
            {t.origin} to {t.destination} - bus {t.vehicleReg}
          </Text>
          <Text>Departs {formatDateTime(t.departureTime)}</Text>
          <Text>
            {formatMoney(t.fare)} - {t.availableSeats} of {t.totalSeats} seats free
          </Text>
          <PrimaryButton
            title="Book (pay by card)"
            onPress={() => onBook(t)}
            loading={bookingId === t.tripId}
            disabled={t.availableSeats <= 0}
          />
        </Card>
      ))}
    </Screen>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Manual check**

Sign in on the phone: the **Book** tab shows. Search Colombo to Kandy: seeded trips list with fare and seats. Tap **Book**: a green "Booked ..." message appears and the seat count drops by one. The header shows **Logout**; tapping it returns to **Sign in**.

- [ ] **Step 5: Commit**

```bash
git add mobile-app
git commit -m "feat(mobile): tab layout and search-and-book screen"
```

---

### Task 6: My Tickets screen

**Files:**
- Modify: `mobile-app/app/(tabs)/tickets.tsx`

**Interfaces:**
- Consumes: `api`, `errorMessage`, `TicketResponse`, `formatDateTime`, `formatMoney`, `canTrack`, `statusLabel`, UI components.
- Produces: list of the passenger's tickets with the QR image; a **Track bus** button on active tickets that navigates to `/track/<ticketId>` (built in Task 8).

- [ ] **Step 1: Write the screen**

```tsx
import { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import { errorMessage } from '../../src/api/errors';
import type { TicketResponse } from '../../src/api/types';
import { canTrack, formatDateTime, formatMoney, statusLabel } from '../../src/lib/format';
import { Card, ErrorText, HintText, PrimaryButton } from '../../src/ui/components';
import { colors } from '../../src/ui/theme';

export default function TicketsScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get<TicketResponse[]>('/api/tickets/mine');
      setTickets(data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your tickets'));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ErrorText message={error} />
      {loaded && tickets.length === 0 && !error && <HintText>No tickets yet. Book a trip first.</HintText>}
      {tickets.map((t) => (
        <Card key={t.ticketId}>
          <View style={styles.row}>
            <Text style={styles.title}>{t.routeName}</Text>
            <Text style={[styles.status, t.status === 'ISSUED' && { color: colors.success }]}>{statusLabel(t.status)}</Text>
          </View>
          <Text>
            {t.origin} to {t.destination}
          </Text>
          <Text>Departs {formatDateTime(t.departureTime)}</Text>
          <Text>
            Seat {t.seatNo ?? '-'} - {formatMoney(t.fare)}
          </Text>
          <Image source={{ uri: `data:image/png;base64,${t.qrImageBase64}` }} style={styles.qr} resizeMode="contain" />
          {canTrack(t.status) && (
            <PrimaryButton title="Track bus" onPress={() => router.push(`/track/${t.ticketId}`)} />
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', fontSize: 16, flexShrink: 1 },
  status: { fontWeight: '700', color: colors.muted },
  qr: { width: 200, height: 200, alignSelf: 'center', marginVertical: 8 },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Manual check**

Open **My Tickets**: the booked ticket shows route, time, seat, fare, a QR image and a **Track bus** button. Pull down to refresh. After the conductor validates the ticket (web portal), pull to refresh: the status changes from **Valid** to **Used**.

- [ ] **Step 4: Commit**

```bash
git add mobile-app
git commit -m "feat(mobile): my tickets screen with QR codes"
```

---

### Task 7: Notifications (provider, toast, badge, screen)

**Files:**
- Create: `mobile-app/src/notifications/NotificationsProvider.tsx`, `mobile-app/src/ui/Toast.tsx`
- Modify: `mobile-app/app/_layout.tsx`, `mobile-app/app/(tabs)/_layout.tsx`, `mobile-app/app/(tabs)/notifications.tsx`

**Interfaces:**
- Consumes: `api`, `useAuth`, `AppNotification`, `freshUnseen`, `unreadCount` (Task 2), `formatDateTime`.
- Produces:
  - `NotificationsProvider` and `useNotifications(): { items: AppNotification[]; unread: number; toast: AppNotification | null; dismissToast(): void; markSeen(id: string): Promise<void> }`. Polls `GET /api/notifications` every 5 seconds while a user is signed in. The first fetch seeds the known set so existing notifications do not pop up; later new unseen ones raise a toast for the newest of them.
  - `ToastHost` component showing the toast banner for 4 seconds (tap to dismiss).
  - Tab badge on **Alerts** showing the unread count.

- [ ] **Step 1: Provider**

`src/notifications/NotificationsProvider.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { freshUnseen, unreadCount } from '../lib/notifications';
import type { AppNotification } from '../lib/notifications';

const POLL_MS = 5000;

interface NotificationsValue {
  items: AppNotification[];
  unread: number;
  toast: AppNotification | null;
  dismissToast: () => void;
  markSeen: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const known = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setToast(null);
      known.current = new Set();
      seeded.current = false;
      return;
    }

    let cancelled = false;
    async function poll() {
      try {
        const { data } = await api.get<AppNotification[]>('/api/notifications');
        if (cancelled) return;
        setItems(data);
        if (!seeded.current) {
          data.forEach((n) => known.current.add(n.notificationId));
          seeded.current = true;
          return;
        }
        const fresh = freshUnseen(known.current, data);
        if (fresh.length > 0) {
          fresh.forEach((n) => known.current.add(n.notificationId));
          setToast(fresh[fresh.length - 1]);
        }
      } catch {
        // transient network error: try again on the next tick
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

  const markSeen = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.notificationId === id ? { ...n, seen: true } : n)));
    try {
      await api.post(`/api/notifications/${id}/read`);
    } catch {
      // the next poll restores the true state
    }
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const value = useMemo(
    () => ({ items, unread: unreadCount(items), toast, dismissToast, markSeen }),
    [items, toast, dismissToast, markSeen],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
```

- [ ] **Step 2: Toast**

`src/ui/Toast.tsx`:

```tsx
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useNotifications } from '../notifications/NotificationsProvider';

export function ToastHost() {
  const { toast, dismissToast } = useNotifications();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, 4000);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;
  return (
    <Pressable style={styles.toast} onPress={dismissToast}>
      <Text style={styles.title}>{toast.title}</Text>
      <Text style={styles.message}>{toast.message}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    elevation: 6,
  },
  title: { color: '#fff', fontWeight: '700' },
  message: { color: '#e5e7eb', marginTop: 2 },
});
```

- [ ] **Step 3: Wire provider, toast and badge**

`app/_layout.tsx`: import `NotificationsProvider` from `'../src/notifications/NotificationsProvider'` and wrap the `Stack` (inside `AuthProvider`):

```tsx
    <AuthProvider>
      <NotificationsProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="track/[ticketId]" options={{ headerShown: true, title: 'Track your bus' }} />
        </Stack>
      </NotificationsProvider>
    </AuthProvider>
```

`app/(tabs)/_layout.tsx`: import `View` from `react-native`, `useNotifications` and `ToastHost`; read `const { unread } = useNotifications();` after `useAuth()`; wrap the `Tabs` in `<View style={{ flex: 1 }}> ... <ToastHost /></View>`, and change the Alerts screen to:

```tsx
      <Tabs.Screen name="notifications" options={{ title: 'Alerts', tabBarBadge: unread > 0 ? unread : undefined }} />
```

Add the imports `import { useNotifications } from '../../src/notifications/NotificationsProvider';` and `import { ToastHost } from '../../src/ui/Toast';`.

- [ ] **Step 4: Notifications screen**

Replace `app/(tabs)/notifications.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateTime } from '../../src/lib/format';
import { useNotifications } from '../../src/notifications/NotificationsProvider';
import { Card, HintText, Screen } from '../../src/ui/components';
import { colors } from '../../src/ui/theme';

export default function NotificationsScreen() {
  const { items, markSeen } = useNotifications();

  return (
    <Screen>
      {items.length === 0 && <HintText>No notifications yet. Booking and trip updates appear here.</HintText>}
      {items.map((n) => (
        <Pressable key={n.notificationId} onPress={() => !n.seen && markSeen(n.notificationId)}>
          <Card>
            <View style={styles.row}>
              {!n.seen && <View style={styles.dot} />}
              <Text style={[styles.title, !n.seen && { color: colors.text }]}>{n.title}</Text>
            </View>
            <Text>{n.message}</Text>
            <Text style={{ color: colors.muted }}>{formatDateTime(n.createdAt)}</Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  title: { fontWeight: '700', fontSize: 16, color: colors.muted },
});
```

- [ ] **Step 5: Type-check and run tests**

Run: `npm test && npx tsc --noEmit`
Expected: tests PASS (12); `tsc` exits 0.

- [ ] **Step 6: Manual check**

On the phone, sign in as the demo passenger and stay on any tab. Make a booking (here or in the web portal as the same passenger): within about 5 seconds a dark banner "Booking confirmed" appears at the top, the **Alerts** tab shows a numeric badge, and **Alerts** lists "Booking confirmed" and "Payment received" with a blue dot. Tap a notification: the dot and the badge count drop. Have the conductor start the trip (web portal): a "Your bus is on the way" banner appears.

- [ ] **Step 7: Commit**

```bash
git add mobile-app
git commit -m "feat(mobile): polled in-app notifications with toast and tab badge"
```

---

### Task 8: Track Bus screen

**Files:**
- Create: `mobile-app/src/hooks/useBusTracking.ts`, `mobile-app/app/track/[ticketId].tsx`

**Interfaces:**
- Consumes: `api`, `trackingApi`, `TRACKING_URL`, `TrackTokenResponse`, `LivePosition`, `errorMessage`, `buildMapHtml`, `buildMoveScript`.
- Produces:
  - `useBusTracking(ticketId: string): TrackingState` where `TrackingState = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'live'; vehicleReg: string; position: LivePosition | null }`.
  - Screen `/track/[ticketId]`: requests a track token for the ticket, reads the bus's current position, subscribes to `location:update` over socket.io with `auth: { token }`, and moves a marker on a Leaflet map.

- [ ] **Step 1: Hook**

`src/hooks/useBusTracking.ts`:

```ts
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { api, trackingApi } from '../api/client';
import { errorMessage } from '../api/errors';
import type { LivePosition, TrackTokenResponse } from '../api/types';
import { TRACKING_URL } from '../config';

export type TrackingState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'live'; vehicleReg: string; position: LivePosition | null };

/** Tracks the one bus a ticket entitles the passenger to watch. */
export function useBusTracking(ticketId: string): TrackingState {
  const [state, setState] = useState<TrackingState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      try {
        const { data: grant } = await api.post<TrackTokenResponse>(`/api/tickets/${ticketId}/track-token`);
        if (cancelled) return;

        let initial: LivePosition | null = null;
        try {
          const res = await trackingApi.get<LivePosition>(`/api/vehicles/${grant.vehicleReg}`, {
            headers: { Authorization: `Bearer ${grant.token}` },
          });
          initial = res.data;
        } catch {
          // no position reported yet: wait for the first live update
        }
        if (cancelled) return;
        setState({ phase: 'live', vehicleReg: grant.vehicleReg, position: initial });

        socket = io(TRACKING_URL, { transports: ['websocket'], auth: { token: grant.token } });
        socket.on('location:update', (p: LivePosition) => {
          if (p.vehicleReg === grant.vehicleReg) {
            setState({ phase: 'live', vehicleReg: grant.vehicleReg, position: p });
          }
        });
        socket.on('error', (message: unknown) => {
          setState({ phase: 'error', message: `Live feed refused: ${String(message)}` });
        });
      } catch (err) {
        if (!cancelled) {
          setState({ phase: 'error', message: errorMessage(err, 'Could not start tracking') });
        }
      }
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [ticketId]);

  return state;
}
```

- [ ] **Step 2: Screen**

`app/track/[ticketId].tsx`:

```tsx
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useBusTracking } from '../../src/hooks/useBusTracking';
import { buildMapHtml, buildMoveScript } from '../../src/lib/mapHtml';
import { ErrorText } from '../../src/ui/components';
import { colors } from '../../src/ui/theme';

export default function TrackScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const state = useBusTracking(ticketId);
  const webRef = useRef<WebView>(null);
  const html = useMemo(() => buildMapHtml(), []);
  const position = state.phase === 'live' ? state.position : null;
  const latestScript = useRef<string | null>(null);

  useEffect(() => {
    if (!position) return;
    const script = buildMoveScript(position.lat, position.lon);
    latestScript.current = script;
    if (script) webRef.current?.injectJavaScript(script);
  }, [position]);

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        {state.phase === 'loading' && <ActivityIndicator />}
        {state.phase === 'error' && <ErrorText message={state.message} />}
        {state.phase === 'live' && !position && (
          <Text style={styles.text}>Waiting for {state.vehicleReg} to report its location...</Text>
        )}
        {state.phase === 'live' && position && (
          <Text style={styles.text}>
            {state.vehicleReg} - {position.speedKmh.toFixed(0)} km/h - updated{' '}
            {new Date(position.timestamp).toLocaleTimeString()}
          </Text>
        )}
      </View>
      <WebView
        ref={webRef}
        style={styles.map}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://transitlk.example' }}
        javaScriptEnabled
        onLoadEnd={() => {
          // the page may finish loading after the first position arrived
          if (latestScript.current) webRef.current?.injectJavaScript(latestScript.current);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  info: { padding: 12, minHeight: 48, justifyContent: 'center' },
  text: { color: colors.text, fontWeight: '600' },
  map: { flex: 1 },
});
```

- [ ] **Step 3: Type-check and test**

Run: `npm test && npx tsc --noEmit`
Expected: tests PASS; `tsc` exits 0.

- [ ] **Step 4: Manual check**

With the stack running and a passenger ticket for `NB-1234`:
1. Tap **Track bus** before the conductor starts the trip: the screen shows "Trip is not in progress" (the server's 409 message).
2. Conductor starts the trip in the web portal. Run `node services/tracking-service/scripts/simulate-vehicle.js NB-1234`.
3. Tap **Track bus** again: the map zooms to Colombo with a marker and the info bar shows "NB-1234 - 4x km/h - updated hh:mm:ss"; the marker moves every 5 seconds.
4. Start a second simulator for another bus (`... SP-9012`): the passenger's map never shows it (verify the marker count stays one).

If map tiles stay grey, the WebView is loaded but OpenStreetMap refused it: change the tile URL in `src/lib/mapHtml.ts` to `https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png` (and the attribution to "&copy; OpenStreetMap contributors &copy; CARTO"), rerun `npm test`.

- [ ] **Step 5: Commit**

```bash
git add mobile-app
git commit -m "feat(mobile): ticket-gated live bus tracking screen"
```

---

### Task 9: README and full demo rehearsal

**Files:**
- Create: `mobile-app/README.md`
- Modify: `README.md` (repository root)

**Interfaces:** none new.

- [ ] **Step 1: Write the mobile README**

`mobile-app/README.md` must contain, in this order: (a) one paragraph on what the app is; (b) **Setup**: `npm install`, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_HOST` to the laptop LAN IP (Android emulator: `10.0.2.2`), `npx expo start`, scan with Expo Go; (c) **Network checklist**: same Wi-Fi, Windows firewall allows TCP 8000, 8083, 8081 on private networks, test `http://<laptop-ip>:8000/api/routes/search?origin=Colombo&destination=Kandy` in the phone browser; (d) **Demo account** `passenger@transitlk.lk` / `demo1234`; (e) **Known limits**: notifications are polled every 5 s while the app is open, no push; the map needs internet for Leaflet and tiles; offline mode does not exist in the app.

In the repository `README.md`, add a short "Mobile app" section linking to `mobile-app/README.md`.

- [ ] **Step 2: Rehearse the demo script end to end**

Prerequisites: `docker compose down -v && docker compose up --build -d` (project root); web portal at http://localhost:3000; app running on the phone.

1. Passenger (app): sign in, search Colombo to Kandy, book NB-1234. Within 5 s a "Booking confirmed" banner appears and **Alerts** shows the badge.
2. Conductor (web portal, `conductor@transitlk.lk`): **Trips** -> Start NB-1234. The app shows a "Your bus is on the way" banner.
3. Run `node services/tracking-service/scripts/simulate-vehicle.js NB-1234`. In the app, **My Tickets** -> **Track bus**: the bus appears and moves. Run a second simulator for `SP-9012`: it never appears on the passenger map.
4. Conductor: **Validate Ticket**, paste the ticket's `qrCode` (from `GET /api/tickets/mine`): VALID. Paste again: "Ticket already used". In the app, pull to refresh **My Tickets**: status **Used**.
5. Conductor: **Complete** the trip; reconciliation shows 1 issued / 1 validated.
6. Operator (`operator@transitlk.lk`): **Operator** shows revenue and occupancy; **Live Map** shows the fleet.
7. Regulator (`regulator@transitlk.lk`): **Regulator** shows the route row with an average delay.
8. Optional: as operator, create a new trip, have the passenger book it, then **Cancel** it: the app shows a "Trip cancelled" banner.

Expected: every step behaves as described. Write down anything that does not and fix it before the real demo.

- [ ] **Step 3: Commit**

```bash
git add mobile-app README.md
git commit -m "docs(mobile): setup guide and demo rehearsal"
```

---

## Self-Review

**Spec coverage (section F and its dependencies)**
- Screens Login, Register, OTP, Search & Book, My Tickets (QR), Track Bus, Notifications: Tasks 4-8.
- Same endpoints through Kong at the laptop LAN IP set in one config file; WebSocket direct to tracking-service: Tasks 1, 3, 8.
- Ticket-gated tracking from the passenger side (track token, scoped socket): Task 8.
- Notifications polled every few seconds with badge and toast; Expo push left out as the first cut: Task 7.
- Phone/laptop on same Wi-Fi or emulator, firewall note: Global Constraints and Task 9.
- Map: single WebView implementation (documented deviation from "react-native-maps with fallback").
- Demo script from the spec: Task 9 Step 2.

**Placeholder scan:** none. Every code step contains the code; the only prose-described edits are the three small `_layout.tsx` wiring changes in Task 7 Step 3, which list exact imports, hooks and JSX.

**Type consistency:** `AppNotification`, `freshUnseen`, `unreadCount`, `useNotifications`, `TrackTokenResponse`, `LivePosition`, `TrackingState`, `buildMapHtml`, `buildMoveScript`, `errorMessage`, `api`/`trackingApi`, `setAuthToken` and the route names `/(tabs)/book` and `/track/[ticketId]` are used with identical names and shapes wherever defined and consumed, and match the Plan 1 response shapes (`TrackTokenResponse { token, vehicleReg, expiresAt }`, notification fields, ticket fields).
