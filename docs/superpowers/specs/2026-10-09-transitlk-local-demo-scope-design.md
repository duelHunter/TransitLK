# TransitLK Local Demo - Scope Design

Date: 2026-10-09. Time budget: under 1 week. Runs fully locally (Docker Compose + Expo on a phone/emulator).

## Goal

Extend the existing CA-03 prototype (user, ticketing, tracking services; Kong; React web portal) so a local demo shows every stakeholder in the report doing a real task:

- Passenger (new Expo mobile app): book, hold QR ticket, track only the bus they paid for, receive notifications.
- Conductor: start/complete trips, validate QR tickets, optional offline-tolerant validation.
- Operator: manage own trips, see revenue and occupancy.
- Regulator (NTC): see aggregated route/operator analytics.

Out of scope: real payment gateway, real SMS, separate Payment/Analytics/Notification/Route services, Kubernetes/CI-CD, observability stack, "vehicle approaching" alert.

## Existing baseline (verified in code)

- ticketing-service already has `POST /api/trips/{id}/start` and `/complete` with issued-vs-validated reconciliation, and QR validation (`POST /api/tickets/validate`, single use).
- Kafka topics `ticket-events`, `payment-events`, `user-events` are published; nothing consumes them.
- tracking-service has no authentication and broadcasts every vehicle to every WebSocket client (`server.emit('location:update')`).
- `Role` = PASSENGER, CONDUCTOR, OPERATOR, ADMIN. Web portal has no trip-control UI.

## A. Conductor trip controls

- Backend: `GET /api/trips` (status filter; CONDUCTOR/OPERATOR/ADMIN), `GET /api/trips/{id}/tickets` (manifest). Record `startedAt` on start. Existing start/complete unchanged.
- Web portal `/trips` page: Start for SCHEDULED, Complete for ONGOING, reconciliation shown as "issued vs validated"; link to Validate page.
- Offline-tolerant validation (cuttable, first to cut): portal verifies QR signature locally using the shared key, shows "signature valid, will sync", queues the redeem call and retries when reachable. Labelled as simulated offline mode.

## B. Notifications

- Lives in user-service (no new container). `@KafkaListener` on `ticket-events`, `payment-events` and a new trip event topic creates a `notifications` row per user and logs a mock "SMS sent to ...".
- Mapping: TICKET_ISSUED -> booking confirmation; PAYMENT_SUCCESS -> receipt; trip cancelled -> delay alert.
- `GET /api/notifications`, `POST /api/notifications/{id}/read`. Kong route added.
- Delivery to the app: polling every few seconds while open, with badge and toast. Expo push is optional (cut second).
- OTP stays in logs.

## C. Operator dashboard

- Add `operatorId` to Route/Trip; seeded data assigned to a demo operator. Operators see only their own.
- `GET/POST /api/operator/trips`, `POST /api/operator/trips/{id}/cancel` (publishes trip-cancelled event), `GET /api/operator/reports/summary` (revenue, tickets sold, occupancy per trip).
- Web portal `/operator`: tables and totals, link to staff live map.

## D. Regulator analytics

- New `REGULATOR` role. `GET /api/regulator/analytics` (REGULATOR/ADMIN): per route and operator - tickets, revenue, average occupancy, punctuality (startedAt vs scheduled departure).
- Computed live with SQL aggregates (deliberate simplification of the report's Analytics service). Web portal `/regulator`: tables and totals.

## E. Ticket-gated live tracking

- ticketing-service: `POST /api/tickets/{id}/track-token`. Requires ticket owner, status ISSUED/VALIDATED, trip ONGOING. Returns a short-lived JWT with claim `vehicleReg`.
- tracking-service verifies the token with a shared secret (same pattern as QR signing); it never calls ticketing.
- Remove the global broadcast. `subscribeVehicle` and `GET /api/vehicles/:reg` require a valid token and only join the room in the token. OPERATOR/ADMIN JWTs may view the whole fleet.
- Web "Live Map" becomes staff-only.

## F. Expo passenger app (`mobile-app/`)

- TypeScript, Expo Router. Screens: Login, Register, OTP, Search and Book, My Tickets (QR), Track Bus, Notifications.
- API via Kong at the laptop LAN IP (single config file). WebSocket connects directly to tracking-service port.
- Map: react-native-maps; fallback is a plotted OpenStreetMap WebView.
- Phone and laptop on same Wi-Fi, or Android emulator.

## Build order (each step demoable)

1. Roles, `operatorId`, `startedAt`, trip list endpoints.
2. Notifications (user-service).
3. Ticket-gated tracking.
4. Expo app.
5. Web pages: `/trips`, `/operator`, `/regulator`.
6. Offline validation queue.
7. Seed data, polish, rehearsal.

Cut order if late: offline queue, Expo push, punctuality metric, map fallback polish. Never cut: ticket-gated tracking and booking-to-notification flow.

## Testing

Tests written first for new rules: track-token ownership and status checks, tracking-service token enforcement, operator data isolation, trip state transitions, notification creation from events. Plus a scripted end-to-end run of the demo story.

## Demo script

1. Passenger books in Expo app; confirmation notification appears.
2. Conductor starts the trip.
3. Passenger taps Track Bus and sees only that bus (vehicle simulator running).
4. Conductor validates QR; ticket shows used.
5. Conductor completes trip; reconciliation shown.
6. Operator sees revenue and occupancy.
7. Regulator sees aggregates.

## Risks

- Expo app is the largest item; Expo Go version mismatches are a common time sink.
- Under 1 week with all features kept (user accepted this risk).
- Map tiles on Expo Go can be unreliable; fallback defined above.
