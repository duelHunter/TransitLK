# TransitLK Web Portal Staff Pages Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the conductor, operator and regulator working screens in the React web portal, restore the Live Map as a staff-only page, and add an offline-tolerant ticket validation mode.

**Architecture:** New pages call the backend endpoints built in Plan 1 through the existing axios client (Kong at `:8000`). Logic that can be wrong without anyone noticing (QR signature check, offline redeem queue, number formatting) lives in small pure modules under `src/lib/` and is unit-tested with `node:test`; pages stay thin.

**Tech Stack:** React 19, react-router-dom 7, axios, socket.io-client, react-leaflet, Vite 8, TypeScript 6; `node:test` with Node 22 built-in type stripping for unit tests (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-10-09-transitlk-local-demo-scope-design.md`
**Depends on:** `docs/superpowers/plans/2026-10-10-backend-foundation.md` (Plan 1) being implemented, because every page here calls its endpoints.

## Global Constraints

- Work in `web-portal/`. Package manager is npm; run `npm install` once before starting.
- Unit tests run with `npm test`, which this plan adds as `node --test "src/lib/*.test.ts"`. Node 22.18+ is required (type stripping). Test files import siblings with an explicit `.ts` extension, and library code uses no enums, namespaces or constructor parameter properties (`erasableSyntaxOnly` is on in `tsconfig.app.json`).
- Test files are excluded from `tsc -b` (Task 1) because `tsconfig.app.json` only loads `vite/client` types.
- Code style follows the existing pages: function components, `useState`/`useEffect`, `apiClient` for HTTP, error text from `err.response?.data?.message`, existing CSS classes (`card`, `trip-table`, `error`, `success`, `hint`, `status`).
- Roles seen by the portal: `PASSENGER | CONDUCTOR | OPERATOR | ADMIN | REGULATOR`. Demo logins (password `demo1234`): `operator@transitlk.lk`, `conductor@transitlk.lk`, `regulator@transitlk.lk`, `passenger@transitlk.lk`.
- Tracking-service now accepts only staff JWTs with role `OPERATOR` or `ADMIN` for the fleet view, so the Live Map link and route are limited to those two roles.
- Backend response shapes (from Plan 1): `TripDto`, `ManifestEntry`, `TripReconciliation { trip, ticketsIssued, ticketsValidated }`, `OperatorSummary { totalRevenue, totalTicketsSold, trips[] }`, `RegulatorAnalytics { totalTrips, totalTicketsSold, totalRevenue, routes[] }`. Types are defined in Task 1.
- The offline validation mode shares the ticket signing secret with the browser through `VITE_TICKET_SIGNING_SECRET`. This is a demo simplification (the report's design uses public-key verification) and must be described as a simulated offline mode.

## File Structure

- Modify: `package.json`, `tsconfig.app.json`, `.env.example`, `Dockerfile`, `../docker-compose.yml`, `src/api/types.ts`, `src/App.tsx`, `src/components/NavBar.tsx`, `src/pages/ValidateTicketPage.tsx`, `src/pages/LiveMapPage.tsx`, `src/index.css`
- Create: `src/api/errors.ts`, `src/lib/format.ts`, `src/lib/ticketSignature.ts`, `src/lib/redeemQueue.ts`, `src/pages/TripsPage.tsx`, `src/pages/OperatorPage.tsx`, `src/pages/RegulatorPage.tsx`
- Tests: `src/lib/format.test.ts`, `src/lib/ticketSignature.test.ts`, `src/lib/redeemQueue.test.ts`

---

### Task 1: Types, formatting helpers and test tooling

**Files:**
- Modify: `web-portal/package.json`, `web-portal/tsconfig.app.json`, `web-portal/src/api/types.ts`
- Create: `web-portal/src/api/errors.ts`, `web-portal/src/lib/format.ts`
- Test: `web-portal/src/lib/format.test.ts`

**Interfaces:**
- Produces:
  - `formatMoney(value: number | string): string` -> `"Rs. 222.50"`; `formatPercent(fraction: number): string` -> `"20%"`; `formatDelay(minutes: number | null): string` -> `"10.0 min"` or `"n/a"`; `formatDateTime(iso: string | null): string` -> locale string or `"-"`.
  - `errorMessage(err: unknown, fallback: string): string`.
  - Types in `api/types.ts`: `TripStatus`, `TripDto`, `ManifestEntry`, `TripReconciliation`, `OperatorTripStats`, `OperatorSummary`, `CreateTripRequest`, `RouteAnalytics`, `RegulatorAnalytics`; `Role` gains `'REGULATOR'`.

- [ ] **Step 1: Install and add the test script and tsconfig exclusion**

Run (in `web-portal`): `npm install`

In `package.json` add to `scripts`:

```json
    "test": "node --test \"src/lib/*.test.ts\"",
```

In `tsconfig.app.json` add after `"include": ["src"]`:

```json
  ,
  "exclude": ["src/**/*.test.ts"]
```

(so the end of the file reads `"include": ["src"],` newline `"exclude": ["src/**/*.test.ts"]`).

- [ ] **Step 2: Write the failing test**

Create `src/lib/format.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDelay, formatMoney, formatPercent, formatDateTime } from './format.ts';

test('formatMoney renders rupees with two decimals', () => {
  assert.equal(formatMoney(222.5), 'Rs. 222.50');
  assert.equal(formatMoney('100'), 'Rs. 100.00');
});

test('formatPercent rounds a 0..1 fraction to a whole percent', () => {
  assert.equal(formatPercent(0.2), '20%');
  assert.equal(formatPercent(0.3333), '33%');
  assert.equal(formatPercent(0), '0%');
});

test('formatDelay shows minutes or n/a', () => {
  assert.equal(formatDelay(10), '10.0 min');
  assert.equal(formatDelay(null), 'n/a');
});

test('formatDateTime handles missing values', () => {
  assert.equal(formatDateTime(null), '-');
  assert.notEqual(formatDateTime('2026-10-10T08:00:00Z'), '-');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, "Cannot find module './format.ts'".

- [ ] **Step 4: Implement**

`src/lib/format.ts`:

```ts
export function formatMoney(value: number | string): string {
  return `Rs. ${Number(value).toFixed(2)}`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatDelay(minutes: number | null): string {
  return minutes === null ? 'n/a' : `${minutes.toFixed(1)} min`;
}

export function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '-';
}
```

`src/api/errors.ts`:

```ts
import { isAxiosError } from 'axios';

export function errorMessage(err: unknown, fallback: string): string {
  return isAxiosError(err) ? (err.response?.data?.message ?? err.message) : fallback;
}
```

In `src/api/types.ts` change the first line to `export type Role = 'PASSENGER' | 'CONDUCTOR' | 'OPERATOR' | 'ADMIN' | 'REGULATOR';` and append:

```ts
export type TripStatus = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

export interface TripDto {
  tripId: string;
  routeId: string;
  routeName: string;
  origin: string;
  destination: string;
  vehicleReg: string;
  departureTime: string;
  arrivalTime: string;
  status: TripStatus;
  totalSeats: number;
  availableSeats: number;
  operatorId: string | null;
  startedAt: string | null;
}

export interface ManifestEntry {
  ticketId: string;
  passengerId: string;
  seatNo: number | null;
  status: TicketStatus;
  validatedAt: string | null;
}

export interface TripReconciliation {
  trip: TripDto;
  ticketsIssued: number;
  ticketsValidated: number;
}

export interface OperatorTripStats {
  tripId: string;
  routeName: string;
  vehicleReg: string;
  departureTime: string;
  status: TripStatus;
  ticketsSold: number;
  revenue: number;
  totalSeats: number;
  occupancy: number;
}

export interface OperatorSummary {
  totalRevenue: number;
  totalTicketsSold: number;
  trips: OperatorTripStats[];
}

export interface CreateTripRequest {
  routeId: string;
  vehicleReg: string;
  departureTime: string;
  arrivalTime: string;
  totalSeats: number;
}

export interface RouteAnalytics {
  routeName: string;
  operatorId: string | null;
  trips: number;
  cancelledTrips: number;
  ticketsSold: number;
  revenue: number;
  avgOccupancy: number;
  avgDelayMinutes: number | null;
}

export interface RegulatorAnalytics {
  totalTrips: number;
  totalTicketsSold: number;
  totalRevenue: number;
  routes: RouteAnalytics[];
}
```

- [ ] **Step 5: Run test and type-check**

Run: `npm test && npx tsc -b`
Expected: tests PASS (4); `tsc -b` exits 0.

- [ ] **Step 6: Commit**

```bash
git add web-portal
git commit -m "feat(web): staff API types, format helpers and unit-test tooling"
```

---

### Task 2: Offline ticket signature check

**Files:**
- Create: `web-portal/src/lib/ticketSignature.ts`
- Test: `web-portal/src/lib/ticketSignature.test.ts`

**Interfaces:**
- Produces: `interface SignatureCheck { ok: boolean; reason: string; ticketId?: string }` and `verifyTicketSignature(qrCode: string, secret: string, nowMs?: number): Promise<SignatureCheck>`. Verifies an HS256/HS384/HS512 JWT produced by the ticketing service's `TicketSigningService` (claims `sub` = ticket id, `exp` in seconds) using Web Crypto, with no network access.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyTicketSignature } from './ticketSignature.ts';

const SECRET = 'transitlk-ticket-signing-secret-32bytes-min';

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

function makeToken(claims: Record<string, unknown>, secret = SECRET, alg = 'HS256') {
  const header = b64url(JSON.stringify({ alg }));
  const payload = b64url(JSON.stringify(claims));
  const hmac = alg === 'HS256' ? 'sha256' : alg === 'HS384' ? 'sha384' : 'sha512';
  const sig = createHmac(hmac, secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

const NOW = Date.parse('2026-10-10T08:00:00Z');
const future = Math.floor(NOW / 1000) + 3600;
const past = Math.floor(NOW / 1000) - 60;

test('accepts a correctly signed, unexpired ticket and returns its id', async () => {
  const result = await verifyTicketSignature(makeToken({ sub: 'ticket-1', exp: future }), SECRET, NOW);
  assert.deepEqual(result, { ok: true, reason: 'Signature valid', ticketId: 'ticket-1' });
});

test('accepts HS384 and HS512 tokens', async () => {
  for (const alg of ['HS384', 'HS512']) {
    const result = await verifyTicketSignature(makeToken({ sub: 't', exp: future }, SECRET, alg), SECRET, NOW);
    assert.equal(result.ok, true, alg);
  }
});

test('rejects a token signed with a different secret', async () => {
  const result = await verifyTicketSignature(makeToken({ sub: 't', exp: future }, 'another-secret-another-secret-123456'), SECRET, NOW);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'Invalid signature');
});

test('rejects a tampered payload', async () => {
  const [h, , s] = makeToken({ sub: 't', exp: future }).split('.');
  const forged = `${h}.${b64url(JSON.stringify({ sub: 'someone-else', exp: future }))}.${s}`;
  const result = await verifyTicketSignature(forged, SECRET, NOW);
  assert.equal(result.ok, false);
});

test('rejects an expired ticket', async () => {
  const result = await verifyTicketSignature(makeToken({ sub: 't', exp: past }), SECRET, NOW);
  assert.deepEqual(result, { ok: false, reason: 'Ticket expired' });
});

test('rejects input that is not a JWT', async () => {
  assert.equal((await verifyTicketSignature('hello', SECRET, NOW)).ok, false);
  assert.equal((await verifyTicketSignature('a.b.c', SECRET, NOW)).ok, false);
  assert.equal((await verifyTicketSignature('', SECRET, NOW)).ok, false);
});

test('rejects an unsupported algorithm', async () => {
  const header = b64url(JSON.stringify({ alg: 'none' }));
  const payload = b64url(JSON.stringify({ sub: 't', exp: future }));
  const result = await verifyTicketSignature(`${header}.${payload}.x`, SECRET, NOW);
  assert.deepEqual(result, { ok: false, reason: 'Unsupported signature algorithm' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, "Cannot find module './ticketSignature.ts'".

- [ ] **Step 3: Implement**

```ts
export interface SignatureCheck {
  ok: boolean;
  reason: string;
  ticketId?: string;
}

const HASH_BY_ALG: Record<string, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
};

function decodeSegment(segment: string) {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function decodeJson(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeSegment(segment)));
}

/**
 * Checks a ticket's signature and expiry locally (report section 6.4: validators verify
 * authenticity offline; only the single-use check needs the server).
 */
export async function verifyTicketSignature(
  qrCode: string,
  secret: string,
  nowMs: number = Date.now(),
): Promise<SignatureCheck> {
  const parts = qrCode.trim().split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'Not a signed ticket' };
  }
  try {
    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    const hash = HASH_BY_ALG[String(header.alg)];
    if (!hash) {
      return { ok: false, reason: 'Unsupported signature algorithm' };
    }
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash }, false, ['verify']);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeSegment(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) {
      return { ok: false, reason: 'Invalid signature' };
    }
    if (typeof claims.exp === 'number' && claims.exp * 1000 <= nowMs) {
      return { ok: false, reason: 'Ticket expired' };
    }
    return { ok: true, reason: 'Signature valid', ticketId: String(claims.sub) };
  } catch {
    return { ok: false, reason: 'Malformed ticket' };
  }
}
```

- [ ] **Step 4: Run test and type-check**

Run: `npm test && npx tsc -b`
Expected: all tests PASS; `tsc -b` exits 0.

- [ ] **Step 5: Commit**

```bash
git add web-portal
git commit -m "feat(web): local QR ticket signature verification"
```

---

### Task 3: Offline redeem queue

**Files:**
- Create: `web-portal/src/lib/redeemQueue.ts`
- Test: `web-portal/src/lib/redeemQueue.test.ts`

**Interfaces:**
- Produces:
  - `interface KeyValueStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }`
  - `interface RedeemOutcome { qrCode: string; valid: boolean; reason: string }`
  - `type Redeem = (qrCode: string) => Promise<{ valid: boolean; reason: string }>` (must **throw** when the server cannot be reached; must **return** for any real server answer, including "invalid")
  - `class RedeemQueue` with `constructor(storage: KeyValueStorage, redeem: Redeem)`, `pending(): string[]`, `enqueue(qrCode: string): boolean` (false if already queued), `flush(): Promise<RedeemOutcome[]>` (redeems in order, removes each processed item, stops at the first thrown error leaving the rest queued).

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RedeemQueue } from './redeemQueue.ts';
import type { KeyValueStorage, Redeem } from './redeemQueue.ts';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

test('enqueue stores a ticket once', () => {
  const queue = new RedeemQueue(memoryStorage(), async () => ({ valid: true, reason: 'OK' }));
  assert.equal(queue.enqueue('qr-1'), true);
  assert.equal(queue.enqueue('qr-1'), false);
  assert.deepEqual(queue.pending(), ['qr-1']);
});

test('queue survives being re-created over the same storage', () => {
  const storage = memoryStorage();
  new RedeemQueue(storage, async () => ({ valid: true, reason: 'OK' })).enqueue('qr-1');
  const again = new RedeemQueue(storage, async () => ({ valid: true, reason: 'OK' }));
  assert.deepEqual(again.pending(), ['qr-1']);
});

test('flush redeems everything in order and empties the queue', async () => {
  const seen: string[] = [];
  const redeem: Redeem = async (qr) => {
    seen.push(qr);
    return { valid: true, reason: 'OK' };
  };
  const queue = new RedeemQueue(memoryStorage(), redeem);
  queue.enqueue('qr-1');
  queue.enqueue('qr-2');

  const outcomes = await queue.flush();

  assert.deepEqual(seen, ['qr-1', 'qr-2']);
  assert.deepEqual(outcomes, [
    { qrCode: 'qr-1', valid: true, reason: 'OK' },
    { qrCode: 'qr-2', valid: true, reason: 'OK' },
  ]);
  assert.deepEqual(queue.pending(), []);
});

test('a server "invalid" answer is an outcome, not a retry', async () => {
  const queue = new RedeemQueue(memoryStorage(), async () => ({ valid: false, reason: 'Ticket already used' }));
  queue.enqueue('qr-1');

  const outcomes = await queue.flush();

  assert.deepEqual(outcomes, [{ qrCode: 'qr-1', valid: false, reason: 'Ticket already used' }]);
  assert.deepEqual(queue.pending(), []);
});

test('flush stops at the first unreachable-server error and keeps the rest', async () => {
  let calls = 0;
  const redeem: Redeem = async () => {
    calls++;
    if (calls === 2) throw new Error('network down');
    return { valid: true, reason: 'OK' };
  };
  const queue = new RedeemQueue(memoryStorage(), redeem);
  queue.enqueue('qr-1');
  queue.enqueue('qr-2');
  queue.enqueue('qr-3');

  const outcomes = await queue.flush();

  assert.deepEqual(outcomes.map((o) => o.qrCode), ['qr-1']);
  assert.deepEqual(queue.pending(), ['qr-2', 'qr-3']);
  assert.equal(calls, 2);
});

test('corrupt stored data is treated as an empty queue', () => {
  const queue = new RedeemQueue(memoryStorage({ transitlk_redeem_queue: '{not json' }), async () => ({ valid: true, reason: 'OK' }));
  assert.deepEqual(queue.pending(), []);
  assert.equal(queue.enqueue('qr-1'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, "Cannot find module './redeemQueue.ts'".

- [ ] **Step 3: Implement**

```ts
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RedeemOutcome {
  qrCode: string;
  valid: boolean;
  reason: string;
}

/** Must throw when the server is unreachable; must return for any real answer, including "invalid". */
export type Redeem = (qrCode: string) => Promise<{ valid: boolean; reason: string }>;

const STORAGE_KEY = 'transitlk_redeem_queue';

/**
 * Tickets accepted while offline (signature valid) wait here until the server can record
 * the single-use redemption. Persisted so a page reload does not lose accepted boardings.
 */
export class RedeemQueue {
  private storage: KeyValueStorage;
  private redeem: Redeem;

  constructor(storage: KeyValueStorage, redeem: Redeem) {
    this.storage = storage;
    this.redeem = redeem;
  }

  pending(): string[] {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  enqueue(qrCode: string): boolean {
    const items = this.pending();
    if (items.includes(qrCode)) {
      return false;
    }
    this.save([...items, qrCode]);
    return true;
  }

  async flush(): Promise<RedeemOutcome[]> {
    const outcomes: RedeemOutcome[] = [];
    let items = this.pending();
    while (items.length > 0) {
      const qrCode = items[0];
      let result: { valid: boolean; reason: string };
      try {
        result = await this.redeem(qrCode);
      } catch {
        break; // still offline: keep this and the remaining items queued
      }
      outcomes.push({ qrCode, valid: result.valid, reason: result.reason });
      items = items.slice(1);
      this.save(items);
    }
    return outcomes;
  }

  private save(items: string[]) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}
```

- [ ] **Step 4: Run test and type-check**

Run: `npm test && npx tsc -b`
Expected: all tests PASS; `tsc -b` exits 0.

- [ ] **Step 5: Commit**

```bash
git add web-portal
git commit -m "feat(web): persistent offline redeem queue"
```

---

### Task 4: Conductor trips page

**Files:**
- Create: `web-portal/src/pages/TripsPage.tsx`
- Modify: `web-portal/src/App.tsx`, `web-portal/src/components/NavBar.tsx`, `web-portal/src/index.css`

**Interfaces:**
- Consumes: `GET /api/trips?status=`, `GET /api/trips/{id}/tickets`, `POST /api/trips/{id}/start`, `POST /api/trips/{id}/complete` (Plan 1); `TripDto`, `ManifestEntry`, `TripReconciliation`, `TripStatus`, `errorMessage`, `formatDateTime` (Task 1).
- Produces: route `/trips` for roles `CONDUCTOR`, `OPERATOR`, `ADMIN`; `TripsPage` component.

- [ ] **Step 1: Write the page**

`src/pages/TripsPage.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { errorMessage } from '../api/errors';
import type { ManifestEntry, TripDto, TripReconciliation, TripStatus } from '../api/types';
import { formatDateTime } from '../lib/format';

const FILTERS: Array<TripStatus | 'ALL'> = ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ALL'];

export function TripsPage() {
  const [filter, setFilter] = useState<TripStatus | 'ALL'>('SCHEDULED');
  const [trips, setTrips] = useState<TripDto[]>([]);
  const [completed, setCompleted] = useState<TripReconciliation[]>([]);
  const [manifestTripId, setManifestTripId] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await apiClient.get<TripDto[]>('/api/trips', {
        params: filter === 'ALL' ? {} : { status: filter },
      });
      setTrips(data);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load trips'));
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(trip: TripDto, action: 'start' | 'complete') {
    setBusyId(trip.tripId);
    setError(null);
    try {
      const { data } = await apiClient.post(`/api/trips/${trip.tripId}/${action}`);
      if (action === 'complete') {
        setCompleted((prev) => [data as TripReconciliation, ...prev]);
      }
      await load();
    } catch (err) {
      setError(errorMessage(err, `Could not ${action} the trip`));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleManifest(tripId: string) {
    if (manifestTripId === tripId) {
      setManifestTripId(null);
      return;
    }
    try {
      const { data } = await apiClient.get<ManifestEntry[]>(`/api/trips/${tripId}/tickets`);
      setManifest(data);
      setManifestTripId(tripId);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the manifest'));
    }
  }

  return (
    <div className="card">
      <h1>Trips</h1>
      <p className="hint">Start a trip when the bus departs and complete it at the end of the journey.</p>

      <label>
        Show
        <select value={filter} onChange={(e) => setFilter(e.target.value as TripStatus | 'ALL')}>
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="error">{error}</p>}

      {completed.map((r) => (
        <div key={r.trip.tripId} className="validation-result valid">
          <h2>Trip completed - {r.trip.routeName}</h2>
          <p>
            Tickets issued: {r.ticketsIssued} | validated: {r.ticketsValidated} | not validated:{' '}
            {r.ticketsIssued - r.ticketsValidated}
          </p>
        </div>
      ))}

      {trips.length === 0 ? (
        <p className="empty">No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}trips.</p>
      ) : (
        <table className="trip-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Vehicle</th>
              <th>Departs</th>
              <th>Status</th>
              <th>Seats free</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <>
                <tr key={t.tripId}>
                  <td>{t.routeName}</td>
                  <td>{t.vehicleReg}</td>
                  <td>{formatDateTime(t.departureTime)}</td>
                  <td>
                    <span className={`status status-${t.status.toLowerCase()}`}>{t.status}</span>
                  </td>
                  <td>
                    {t.availableSeats}/{t.totalSeats}
                  </td>
                  <td className="row-actions">
                    {t.status === 'SCHEDULED' && (
                      <button disabled={busyId === t.tripId} onClick={() => act(t, 'start')}>
                        Start
                      </button>
                    )}
                    {t.status === 'ONGOING' && (
                      <>
                        <Link to="/validate">Validate tickets</Link>
                        <button disabled={busyId === t.tripId} onClick={() => act(t, 'complete')}>
                          Complete
                        </button>
                      </>
                    )}
                    <button className="secondary" onClick={() => toggleManifest(t.tripId)}>
                      {manifestTripId === t.tripId ? 'Hide manifest' : 'Manifest'}
                    </button>
                  </td>
                </tr>
                {manifestTripId === t.tripId && (
                  <tr key={`${t.tripId}-manifest`}>
                    <td colSpan={6}>
                      {manifest.length === 0 ? (
                        <span className="empty">No tickets sold yet.</span>
                      ) : (
                        <ul className="manifest">
                          {manifest.map((m) => (
                            <li key={m.ticketId}>
                              Seat {m.seatNo ?? '-'} - {m.status}
                              {m.validatedAt ? ` (validated ${formatDateTime(m.validatedAt)})` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

Note: the fragment inside `.map` needs a key. Replace `<>` with `<Fragment key={t.tripId}>` and `</>` with `</Fragment>`, add `Fragment` to the `react` import (`import { Fragment, useCallback, useEffect, useState } from 'react';`) and remove the `key={t.tripId}` from the first `<tr>`.

- [ ] **Step 2: Add styles**

Append to `src/index.css`:

```css
.row-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

button.secondary {
  background: transparent;
  color: inherit;
  border: 1px solid currentColor;
}

.manifest {
  margin: 0;
  padding-left: 1.2rem;
}

.stat-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin: 1rem 0;
}

.stat {
  flex: 1 1 10rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 8px;
}

.stat strong {
  display: block;
  font-size: 1.4rem;
}

.status-ongoing {
  color: #b45309;
}

.status-scheduled {
  color: #1d4ed8;
}

.status-completed {
  color: #15803d;
}
```

- [ ] **Step 3: Route and nav link**

In `src/App.tsx` add `import { TripsPage } from './pages/TripsPage';` and inside `<Routes>`:

```tsx
          <Route
            path="/trips"
            element={
              <ProtectedRoute roles={['CONDUCTOR', 'OPERATOR', 'ADMIN']}>
                <TripsPage />
              </ProtectedRoute>
            }
          />
```

In `src/components/NavBar.tsx` add inside `.nav-links`:

```tsx
        {user && (user.role === 'CONDUCTOR' || user.role === 'OPERATOR' || user.role === 'ADMIN') && (
          <Link to="/trips">Trips</Link>
        )}
```

- [ ] **Step 4: Verify it builds and lints**

Run: `npm run lint && npm run build`
Expected: both exit 0.

- [ ] **Step 5: Manual check** (needs the Plan 1 stack running on a fresh DB: `docker compose up -d --build` from the project root, then `npm run dev` in `web-portal`)

Log in as `conductor@transitlk.lk` / `demo1234` at http://localhost:5173. Open **Trips**: the seeded scheduled trips list. Press **Start** on NB-1234: it disappears from the SCHEDULED filter and appears under ONGOING. Press **Complete**: a green "Trip completed" block shows issued/validated counts. Press **Manifest** on a trip with tickets: seats list.

- [ ] **Step 6: Commit**

```bash
git add web-portal
git commit -m "feat(web): conductor trips page with start, complete and manifest"
```

---

### Task 5: Offline-tolerant ticket validation

**Files:**
- Modify: `web-portal/src/pages/ValidateTicketPage.tsx`, `web-portal/.env.example`, `web-portal/Dockerfile`, `docker-compose.yml`

**Interfaces:**
- Consumes: `verifyTicketSignature` (Task 2), `RedeemQueue`, `RedeemOutcome` (Task 3), `ValidationResult`, `errorMessage` (existing/Task 1).
- Produces: the Validate page keeps its online behaviour; when the server cannot be reached (or the "Simulate offline" box is ticked) a ticket with a valid signature is accepted, queued, and redeemed automatically when the server is reachable again. Env var `VITE_TICKET_SIGNING_SECRET` (must equal the ticketing service `TICKET_SIGNING_SECRET`).

- [ ] **Step 1: Configure the secret**

Append to `.env.example`:

```
VITE_TICKET_SIGNING_SECRET=transitlk-ticket-signing-secret-32bytes-min
```

Create `web-portal/.env.local` (git-ignored) with the same line for local `npm run dev`.

In `Dockerfile` add after the existing `ARG`/`ENV` lines:

```dockerfile
ARG VITE_TICKET_SIGNING_SECRET=transitlk-ticket-signing-secret-32bytes-min
ENV VITE_TICKET_SIGNING_SECRET=$VITE_TICKET_SIGNING_SECRET
```

In `docker-compose.yml`, under `web-portal.build.args` add:

```yaml
        VITE_TICKET_SIGNING_SECRET: transitlk-ticket-signing-secret-32bytes-min
```

- [ ] **Step 2: Rewrite the page**

Replace `src/pages/ValidateTicketPage.tsx` with:

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { apiClient } from '../api/client';
import { errorMessage } from '../api/errors';
import type { ValidationResult } from '../api/types';
import { RedeemQueue } from '../lib/redeemQueue';
import type { RedeemOutcome } from '../lib/redeemQueue';
import { verifyTicketSignature } from '../lib/ticketSignature';

const SIGNING_SECRET = import.meta.env.VITE_TICKET_SIGNING_SECRET as string | undefined;

/** True when the request never got a real answer (no response, or the server itself failed). */
function isUnreachable(err: unknown): boolean {
  return isAxiosError(err) && (!err.response || err.response.status >= 500);
}

async function redeemOnline(qrCode: string): Promise<{ valid: boolean; reason: string }> {
  try {
    const { data } = await apiClient.post<ValidationResult>('/api/tickets/validate', { qrCode });
    return { valid: data.valid, reason: data.reason };
  } catch (err) {
    if (isAxiosError(err) && err.response && err.response.status < 500 && err.response.status !== 401) {
      return { valid: false, reason: err.response.data?.message ?? err.message };
    }
    throw err; // unreachable or session expired: keep the ticket queued
  }
}

export function ValidateTicketPage() {
  const queue = useMemo(() => new RedeemQueue(localStorage, redeemOnline), []);
  const [qrCode, setQrCode] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forceOffline, setForceOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(queue.pending().length);
  const [synced, setSynced] = useState<RedeemOutcome[]>([]);

  useEffect(() => {
    if (forceOffline) return;
    let cancelled = false;
    async function sync() {
      const outcomes = await queue.flush();
      if (cancelled) return;
      if (outcomes.length > 0) setSynced((prev) => [...outcomes, ...prev]);
      setPendingCount(queue.pending().length);
    }
    sync();
    const timer = setInterval(sync, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [forceOffline, queue]);

  async function acceptOffline(ticket: string) {
    const check = SIGNING_SECRET
      ? await verifyTicketSignature(ticket, SIGNING_SECRET)
      : { ok: false, reason: 'Offline verification is not configured' };
    if (!check.ok) {
      setResult({ valid: false, reason: check.reason, ticketId: null, seatNo: null, validatedAt: null });
      return;
    }
    if (!queue.enqueue(ticket)) {
      setResult({ valid: false, reason: 'Already scanned on this device', ticketId: check.ticketId ?? null, seatNo: null, validatedAt: null });
      return;
    }
    setPendingCount(queue.pending().length);
    setResult({
      valid: true,
      reason: 'Signature valid - accepted offline, will sync when connected',
      ticketId: check.ticketId ?? null,
      seatNo: null,
      validatedAt: null,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    const ticket = qrCode.trim();
    try {
      if (!forceOffline) {
        try {
          const { data } = await apiClient.post<ValidationResult>('/api/tickets/validate', { qrCode: ticket });
          setResult(data);
          return;
        } catch (err) {
          if (!isUnreachable(err)) {
            setError(errorMessage(err, 'Validation request failed'));
            return;
          }
        }
      }
      await acceptOffline(ticket);
    } finally {
      setLoading(false);
      setQrCode('');
    }
  }

  return (
    <div className="card">
      <h1>Validate Ticket</h1>
      <p className="hint">
        Paste the raw QR payload (the signed token) from a passenger's ticket. A real conductor
        app would scan the QR image and extract this text automatically via the device camera.
        If the server cannot be reached, the signature is checked on this device and the boarding
        is recorded when the connection returns.
      </p>
      <label className="inline-check">
        <input type="checkbox" checked={forceOffline} onChange={(e) => setForceOffline(e.target.checked)} />
        Simulate offline (no server contact)
      </label>
      <form onSubmit={onSubmit}>
        <label>
          QR payload
          <textarea rows={4} value={qrCode} onChange={(e) => setQrCode(e.target.value)} required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Validating...' : 'Validate'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {result && (
        <div className={`validation-result ${result.valid ? 'valid' : 'invalid'}`}>
          <h2>{result.valid ? 'VALID - Boarding allowed' : 'INVALID'}</h2>
          <p>{result.reason}</p>
          {result.seatNo != null && <p>Seat: {result.seatNo}</p>}
        </div>
      )}

      {pendingCount > 0 && (
        <p className="hint">
          {pendingCount} offline boarding{pendingCount === 1 ? '' : 's'} waiting to sync.
        </p>
      )}
      {synced.map((s) => (
        <p key={s.qrCode} className={s.valid ? 'success' : 'error'}>
          Synced: {s.valid ? 'recorded' : `rejected - ${s.reason}`}
        </p>
      ))}
    </div>
  );
}
```

Append to `src/index.css`:

```css
.inline-check {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.inline-check input {
  width: auto;
}
```

- [ ] **Step 3: Verify it builds and lints**

Run: `npm test && npm run lint && npm run build`
Expected: all exit 0.

- [ ] **Step 4: Manual check**

With the stack running and `npm run dev`:
1. As a passenger, book a ticket (Search & Book), then open **My Tickets**; copy its `qrCode` from `GET /api/tickets/mine` (browser dev tools network tab).
2. As the conductor, open **Validate Ticket**, tick **Simulate offline**, paste the code, Validate: green "accepted offline" and "1 offline boarding waiting to sync".
3. Paste the same code again: "Already scanned on this device".
4. Untick **Simulate offline**: within 5 seconds "Synced: recorded" appears and the pending note disappears.
5. Paste the same code online: INVALID "Ticket already used".
6. Paste `garbage` offline: INVALID "Not a signed ticket".

- [ ] **Step 5: Commit**

```bash
git add web-portal docker-compose.yml
git commit -m "feat(web): offline-tolerant ticket validation with sync queue"
```

---

### Task 6: Operator dashboard

**Files:**
- Create: `web-portal/src/pages/OperatorPage.tsx`
- Modify: `web-portal/src/App.tsx`, `web-portal/src/components/NavBar.tsx`

**Interfaces:**
- Consumes: `GET /api/operator/reports/summary`, `POST /api/operator/trips`, `POST /api/operator/trips/{id}/cancel`, `GET /api/trips` (for the list of routes; there is no route-list endpoint, so routes are derived from the trips), `OperatorSummary`, `CreateTripRequest`, `TripDto`, `formatMoney`, `formatPercent`, `formatDateTime`, `errorMessage`.
- Produces: route `/operator` for role `OPERATOR` only.

- [ ] **Step 1: Write the page**

```tsx
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { errorMessage } from '../api/errors';
import type { CreateTripRequest, OperatorSummary, TripDto } from '../api/types';
import { formatDateTime, formatMoney, formatPercent } from '../lib/format';

interface RouteOption {
  routeId: string;
  routeName: string;
}

function routesFrom(trips: TripDto[]): RouteOption[] {
  const byId = new Map<string, RouteOption>();
  for (const t of trips) byId.set(t.routeId, { routeId: t.routeId, routeName: t.routeName });
  return [...byId.values()].sort((a, b) => a.routeName.localeCompare(b.routeName));
}

export function OperatorPage() {
  const [summary, setSummary] = useState<OperatorSummary | null>(null);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ routeId: '', vehicleReg: '', departureTime: '', arrivalTime: '', totalSeats: 40 });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [report, trips] = await Promise.all([
        apiClient.get<OperatorSummary>('/api/operator/reports/summary'),
        apiClient.get<TripDto[]>('/api/trips'),
      ]);
      setSummary(report.data);
      const options = routesFrom(trips.data);
      setRoutes(options);
      setForm((f) => (f.routeId || options.length === 0 ? f : { ...f, routeId: options[0].routeId }));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load the operator report'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const body: CreateTripRequest = {
      routeId: form.routeId,
      vehicleReg: form.vehicleReg,
      departureTime: new Date(form.departureTime).toISOString(),
      arrivalTime: new Date(form.arrivalTime).toISOString(),
      totalSeats: Number(form.totalSeats),
    };
    try {
      await apiClient.post('/api/operator/trips', body);
      setMessage('Trip created.');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not create the trip'));
    }
  }

  async function onCancel(tripId: string) {
    setError(null);
    setMessage(null);
    try {
      await apiClient.post(`/api/operator/trips/${tripId}/cancel`);
      setMessage('Trip cancelled. Passengers with tickets have been notified.');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not cancel the trip'));
    }
  }

  return (
    <div className="card">
      <h1>Operator Dashboard</h1>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      {summary && (
        <>
          <div className="stat-row">
            <div className="stat">
              <span>Revenue</span>
              <strong>{formatMoney(summary.totalRevenue)}</strong>
            </div>
            <div className="stat">
              <span>Tickets sold</span>
              <strong>{summary.totalTicketsSold}</strong>
            </div>
            <div className="stat">
              <span>Trips</span>
              <strong>{summary.trips.length}</strong>
            </div>
          </div>
          <p>
            <Link to="/live-map">Open the live fleet map</Link>
          </p>

          {summary.trips.length === 0 ? (
            <p className="empty">You have no trips yet.</p>
          ) : (
            <table className="trip-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Vehicle</th>
                  <th>Departs</th>
                  <th>Status</th>
                  <th>Sold</th>
                  <th>Occupancy</th>
                  <th>Revenue</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {summary.trips.map((t) => (
                  <tr key={t.tripId}>
                    <td>{t.routeName}</td>
                    <td>{t.vehicleReg}</td>
                    <td>{formatDateTime(t.departureTime)}</td>
                    <td>
                      <span className={`status status-${t.status.toLowerCase()}`}>{t.status}</span>
                    </td>
                    <td>
                      {t.ticketsSold}/{t.totalSeats}
                    </td>
                    <td>{formatPercent(t.occupancy)}</td>
                    <td>{formatMoney(t.revenue)}</td>
                    <td>
                      {t.status === 'SCHEDULED' && (
                        <button className="secondary" onClick={() => onCancel(t.tripId)}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <h2>Schedule a trip</h2>
      <form onSubmit={onCreate}>
        <label>
          Route
          <select value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })} required>
            {routes.map((r) => (
              <option key={r.routeId} value={r.routeId}>
                {r.routeName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vehicle registration
          <input value={form.vehicleReg} onChange={(e) => setForm({ ...form, vehicleReg: e.target.value })} required />
        </label>
        <label>
          Departure
          <input type="datetime-local" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} required />
        </label>
        <label>
          Arrival
          <input type="datetime-local" value={form.arrivalTime} onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })} required />
        </label>
        <label>
          Seats
          <input type="number" min={1} value={form.totalSeats} onChange={(e) => setForm({ ...form, totalSeats: Number(e.target.value) })} required />
        </label>
        <button type="submit">Create trip</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Route and nav link**

In `src/App.tsx` add `import { OperatorPage } from './pages/OperatorPage';` and:

```tsx
          <Route
            path="/operator"
            element={
              <ProtectedRoute roles={['OPERATOR']}>
                <OperatorPage />
              </ProtectedRoute>
            }
          />
```

In `NavBar.tsx` add inside `.nav-links`:

```tsx
        {user && user.role === 'OPERATOR' && <Link to="/operator">Operator</Link>}
```

- [ ] **Step 3: Verify it builds and lints**

Run: `npm run lint && npm run build`
Expected: both exit 0.

- [ ] **Step 4: Manual check**

Log in as `operator@transitlk.lk`. **Operator** shows the four seeded trips with revenue/tickets for any already booked. Create a trip for "Colombo - Kandy Express" with vehicle `NB-7777`, departing in the future: it appears in the table. Cancel a scheduled trip that has a booked ticket: success message; the passenger's notification list (checked in Plan 3, or `GET /api/notifications` with the passenger token) gains "Trip cancelled". Log in as the conductor: `/operator` redirects to `/`.

- [ ] **Step 5: Commit**

```bash
git add web-portal
git commit -m "feat(web): operator dashboard with revenue, occupancy and trip management"
```

---

### Task 7: Regulator analytics page

**Files:**
- Create: `web-portal/src/pages/RegulatorPage.tsx`
- Modify: `web-portal/src/App.tsx`, `web-portal/src/components/NavBar.tsx`

**Interfaces:**
- Consumes: `GET /api/regulator/analytics`, `RegulatorAnalytics`, `formatMoney`, `formatPercent`, `formatDelay`, `errorMessage`.
- Produces: route `/regulator` for roles `REGULATOR`, `ADMIN`.

- [ ] **Step 1: Write the page**

```tsx
import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { errorMessage } from '../api/errors';
import type { RegulatorAnalytics } from '../api/types';
import { formatDelay, formatMoney, formatPercent } from '../lib/format';

export function RegulatorPage() {
  const [data, setData] = useState<RegulatorAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<RegulatorAnalytics>('/api/regulator/analytics')
      .then(({ data }) => setData(data))
      .catch((err) => setError(errorMessage(err, 'Failed to load analytics')));
  }, []);

  return (
    <div className="card">
      <h1>Regulator Analytics</h1>
      <p className="hint">
        Aggregated service data across all operators, for route licensing and subsidy decisions.
        Punctuality is the average gap between scheduled and actual departure.
      </p>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <div className="stat-row">
            <div className="stat">
              <span>Trips</span>
              <strong>{data.totalTrips}</strong>
            </div>
            <div className="stat">
              <span>Tickets sold</span>
              <strong>{data.totalTicketsSold}</strong>
            </div>
            <div className="stat">
              <span>Revenue</span>
              <strong>{formatMoney(data.totalRevenue)}</strong>
            </div>
          </div>

          {data.routes.length === 0 ? (
            <p className="empty">No service data yet.</p>
          ) : (
            <table className="trip-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Operator</th>
                  <th>Trips</th>
                  <th>Cancelled</th>
                  <th>Tickets</th>
                  <th>Avg occupancy</th>
                  <th>Avg delay</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.routes.map((r) => (
                  <tr key={`${r.routeName}-${r.operatorId ?? 'none'}`}>
                    <td>{r.routeName}</td>
                    <td>{r.operatorId ? r.operatorId.slice(-4) : '-'}</td>
                    <td>{r.trips}</td>
                    <td>{r.cancelledTrips}</td>
                    <td>{r.ticketsSold}</td>
                    <td>{formatPercent(r.avgOccupancy)}</td>
                    <td>{formatDelay(r.avgDelayMinutes)}</td>
                    <td>{formatMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Route and nav link**

In `src/App.tsx` add `import { RegulatorPage } from './pages/RegulatorPage';` and:

```tsx
          <Route
            path="/regulator"
            element={
              <ProtectedRoute roles={['REGULATOR', 'ADMIN']}>
                <RegulatorPage />
              </ProtectedRoute>
            }
          />
```

In `NavBar.tsx` add inside `.nav-links`:

```tsx
        {user && (user.role === 'REGULATOR' || user.role === 'ADMIN') && <Link to="/regulator">Regulator</Link>}
```

- [ ] **Step 3: Verify it builds and lints**

Run: `npm run lint && npm run build`
Expected: both exit 0.

- [ ] **Step 4: Manual check**

Log in as `regulator@transitlk.lk`. **Regulator** shows totals and one row per route/operator. After a trip has been started late and completed (Task 4 manual check), its route shows an "Avg delay" in minutes; routes with no started trip show "n/a". Logging in as a passenger and opening `/regulator` redirects to `/`.

- [ ] **Step 5: Commit**

```bash
git add web-portal
git commit -m "feat(web): regulator analytics page"
```

---

### Task 8: Staff-only Live Map

**Files:**
- Modify: `web-portal/src/pages/LiveMapPage.tsx`, `web-portal/src/App.tsx`, `web-portal/src/components/NavBar.tsx`

**Interfaces:**
- Consumes: `GET /api/vehicles` (staff JWT via the axios interceptor), socket.io handshake `auth: { token }` (Plan 1, Task 6), `errorMessage`.
- Produces: `/live-map` restricted to `OPERATOR`, `ADMIN`; the map shows an error instead of failing silently when access is refused.

- [ ] **Step 1: Authenticate the REST call and the socket**

In `src/pages/LiveMapPage.tsx`:
- add `import { errorMessage } from '../api/errors';`
- add state `const [error, setError] = useState<string | null>(null);`
- replace the body of the `useEffect` with:

```tsx
  useEffect(() => {
    apiClient
      .get<LiveVehicle[]>('/api/vehicles')
      .then(({ data }) => {
        const map: Record<string, LiveVehicle> = {};
        for (const v of data) map[v.vehicleReg] = v;
        setVehicles(map);
      })
      .catch((err) => setError(errorMessage(err, 'Could not load vehicles')));

    const token = localStorage.getItem('transitlk_token');
    const socket = io(TRACKING_WS_URL, { transports: ['websocket', 'polling'], auth: { token } });
    socketRef.current = socket;
    socket.on('location:update', (payload: LiveVehicle) => {
      setVehicles((prev) => ({ ...prev, [payload.vehicleReg]: payload }));
    });
    socket.on('error', (message: unknown) => setError(`Live feed refused: ${String(message)}`));

    return () => {
      socket.disconnect();
    };
  }, []);
```

- render `{error && <p className="error">{error}</p>}` directly under the `<h1>`.
- change the hint to start with "Staff fleet view." and keep the simulator command text.

- [ ] **Step 2: Restrict the route and link**

In `src/App.tsx` replace `<Route path="/live-map" element={<LiveMapPage />} />` with:

```tsx
          <Route
            path="/live-map"
            element={
              <ProtectedRoute roles={['OPERATOR', 'ADMIN']}>
                <LiveMapPage />
              </ProtectedRoute>
            }
          />
```

In `NavBar.tsx` replace `<Link to="/live-map">Live Map</Link>` with:

```tsx
        {user && (user.role === 'OPERATOR' || user.role === 'ADMIN') && <Link to="/live-map">Live Map</Link>}
```

- [ ] **Step 3: Verify it builds and lints**

Run: `npm test && npm run lint && npm run build`
Expected: all exit 0.

- [ ] **Step 4: Manual check**

Run `node services/tracking-service/scripts/simulate-vehicle.js NB-1234` from the project root. Log in as `operator@transitlk.lk`: **Live Map** shows the NB-1234 marker moving. The nav link is absent for the passenger, conductor and regulator, and `/live-map` redirects them to `/`.

- [ ] **Step 5: Commit**

```bash
git add web-portal
git commit -m "feat(web): restrict live map to staff and authenticate its feed"
```

---

### Task 9: Containerised run and regression pass

**Files:** none new.

- [ ] **Step 1: Run all unit tests, lint and production build**

Run (in `web-portal`): `npm test && npm run lint && npm run build`
Expected: all exit 0; `npm test` reports 17 passing tests (4 + 7 + 6).

- [ ] **Step 2: Rebuild the container**

Run (project root): `docker compose up -d --build web-portal`
Expected: build succeeds; http://localhost:3000 loads.

- [ ] **Step 3: Walk the staff story in the container build**

At http://localhost:3000, with the simulator running for `NB-1234`:
1. Conductor: Trips -> Start NB-1234 -> Validate (online) -> Complete; reconciliation block appears.
2. Operator: Operator dashboard shows revenue and occupancy; Live Map shows the bus.
3. Regulator: Regulator page shows the route row with an average delay.
4. Passenger: sees no staff links; `/trips`, `/operator`, `/regulator`, `/live-map` all redirect to `/`.

Expected: every step works. Fix any failure before moving to Plan 3.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A web-portal
git commit -m "fix(web): regression fixes from staff walkthrough"
```

(Skip if there was nothing to fix.)

---

## Self-Review

**Spec coverage**
- A (conductor trip controls UI): Task 4. Offline-tolerant validation incl. local signature check and redeem queue, labelled as simulated: Tasks 2, 3, 5.
- C (operator dashboard: trips, create/cancel, revenue/occupancy, link to staff map): Task 6.
- D (regulator view: aggregates, punctuality): Task 7.
- E (web Live Map staff-only, authenticated feed): Task 8.
- B (notifications) and F (Expo app) are Plan 3; the spec's web notification bell was dropped when the user moved passenger notifications to the mobile app.
- Testing: unit tests for every pure module (format, signature, queue); pages verified by manual steps because the portal has no component-test setup and adding one is outside the one-week scope.

**Placeholder scan:** none; the only prose-described edit is the `Fragment` key fix in Task 4 Step 1, which gives exact replacements.

**Type consistency:** `TripDto`, `TripReconciliation`, `ManifestEntry`, `OperatorSummary`, `RegulatorAnalytics`, `RedeemQueue`, `RedeemOutcome`, `verifyTicketSignature` and `errorMessage` names and fields match between the tasks that define and consume them and the Plan 1 response shapes (`avgDelayMinutes` nullable, `occupancy`/`avgOccupancy` as 0..1 fractions).
