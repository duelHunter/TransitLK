# TransitLK - CA-03 Prototype

Functional prototype of the three core services scoped out of the CA-01 architecture
report (`../latex/EG_2020_4202.pdf`): **User & Identity**, **Ticketing & Booking**
(with QR e-tickets), and **Vehicle Tracking** (live GPS + ETA), fronted by a Kong API
gateway and demonstrated through two mobile apps (passenger, conductor) and a React web
portal for fleet operators.

Route & Schedule, Payment, Analytics, and Notification are represented in the report's
architecture but are **not** separately deployed here - route/schedule data lives inside
`ticketing-service` and payments are a synchronous, always-approving mock, since a real
gateway integration is out of scope for a local prototype.

## Architecture at a glance

| Report concept | This prototype |
|---|---|
| Microservices + event-driven backbone | 3 Spring Boot / NestJS services, real Apache Kafka (KRaft, single broker) |
| API Gateway (Kong) | Kong 3.7, DB-less declarative config (`gateway/kong.yml`) |
| Database-per-service | Separate Postgres databases per Java service; Redis for tracking's live state |
| MQTT via AWS IoT Core | Local Mosquitto broker (`vehicles/+/telemetry`) |
| Digitally-signed, offline-verifiable QR tickets | HMAC-signed JWT payload rendered as a QR PNG (ZXing) |
| Kubernetes / AWS deployment | Out of scope locally - `docker-compose.yml` only |

## Prerequisites

- Docker Desktop (with Compose v2)
- For running services outside Docker during development: JDK 17, Maven, Node.js 20+

## Run everything with Docker Compose

```bash
docker compose up --build
```

This starts, in dependency order: Postgres, Redis, Kafka, Mosquitto, the three
services, Kong, and the web portal.

| Component | URL |
|---|---|
| Web portal | http://localhost:3000 |
| API gateway (use this for all API calls) | http://localhost:8000 |
| Kong admin API | http://localhost:8001 |
| user-service (direct) | http://localhost:8081 |
| ticketing-service (direct) | http://localhost:8082 |
| tracking-service (direct, REST + WebSocket) | http://localhost:8083 |
| Swagger UI | http://localhost:8081/swagger-ui.html, http://localhost:8082/swagger-ui.html |

Demo routes and trips (Colombo-Kandy, Colombo-Galle, Kandy-Jaffna) are seeded
automatically on first boot of `ticketing-service`.

## Demo walkthrough

Three roles, three clients (see "Demo accounts" for logins):

1. **Passenger - mobile app** (`mobile-app/`): sign in, choose **From** and **To** from the city
   dropdowns (try Colombo to Kandy) and book. The mock payment approves, a signed QR ticket is
   issued, and a booking alert appears.
2. **Conductor - conductor app** (`conductor-app/`): sign in, open **Trips** and **Start** the
   bus the passenger booked (NB-1234). The passenger gets a "your bus is on the way" alert.
3. Run the simulator so the bus moves, then on the passenger app open **My Tickets** and
   **Track bus**: the passenger sees only the bus on their ticket.
   ```bash
   node services/tracking-service/scripts/simulate-vehicle.js NB-1234
   ```
4. **Conductor app - Scan tickets**: scan the passenger's QR (or paste the code). A second scan of
   the same ticket reports "already used". Switch on **Simulate offline** to see signature
   checking on the phone and the sync queue. Then **Complete** the trip.
5. **Operator - web portal** at http://localhost:3000: the dashboard shows revenue and occupancy,
   **Live Map** shows the fleet, and trips can be scheduled or cancelled.

New passenger or conductor accounts need OTP activation (FR1). No SMS gateway is wired up, so read
the 6-digit code from the user-service log:
```bash
docker compose logs -f user-service | grep "OTP for"
```

Passengers and conductors have no web screens, and bookings, tickets and notifications are refused
for every role except passenger.

## Demo accounts

`user-service` seeds three enabled accounts on first start (password `demo1234`), so the
demo needs no OTP step:

| Role | Login |
|---|---|
| Passenger | `passenger@transitlk.lk` |
| Conductor | `conductor@transitlk.lk` |
| Operator | `operator@transitlk.lk` |

After upgrading from an older checkout, run `docker compose down -v` once so the seeded
trips get an operator. `node scripts/smoke-backend.mjs` runs the whole backend demo story
(book, start trip, ticket-gated tracking, notifications, validate, complete, reports)
against a running stack and exits non-zero if any step fails.

## Mobile app

There are two Expo / React Native apps, one per role:

| App | Folder | For | Expo port |
|---|---|---|---|
| Passenger | [mobile-app/](mobile-app/README.md) | search, book, QR tickets, live tracking, alerts | 8090 |
| Conductor | [conductor-app/](conductor-app/README.md) | trips, passenger list, QR scanning (offline-tolerant) | 8091 |

The web portal is for **fleet operators** only (dashboard, trips, live fleet map). Passengers and
conductors have no web screens. Ports 8081 (user-service) and 8000/8083 (API, tracking) must not be
used by Expo, hence the 8090 and 8091 dev-server ports.

## Running a single service locally (outside Docker)

Bring up just the infra you need, e.g.:

```bash
docker compose up postgres redis kafka mosquitto -d
```

Then, per service:

```bash
# user-service
cd services/user-service && mvn spring-boot:run

# ticketing-service
cd services/ticketing-service && mvn spring-boot:run

# tracking-service
cd services/tracking-service && npm install && npm run start:dev

# web-portal
cd web-portal && cp .env.example .env.local && npm install && npm run dev
```

Each service falls back to `localhost` for every dependency when its `*_HOST` /
`*_BOOTSTRAP_SERVERS` env vars are unset, so no extra config is needed for local runs.

## What maps to which functional requirement

| FR | Where |
|---|---|
| FR1 Registration/auth, OTP, RBAC | `user-service` (`AuthController`, `OtpService`, `JwtService`) |
| FR2 Route/schedule search | `ticketing-service` (`RouteController`, seeded `Route`/`Trip` data) |
| FR3 Real-time tracking, ETA | `tracking-service` (`TelemetryService`, `EtaService`, `LocationGateway`) |
| FR4 Booking, fare calc | `ticketing-service` (`BookingService`, `Route.calculateFare()`) |
| FR5 Payment | `ticketing-service` (`PaymentGatewayClient` mock) |
| FR6 QR issuance/validation | `ticketing-service` (`TicketSigningService`, `QrImageService`, `TicketValidationService`) |
| FR7 Notifications | `user-service` (`NotificationEventListener` consumes `ticket-events`, `payment-events`, `trip-events`; in-app list via `/api/notifications`; SMS is a log line) |
| FR8 Fleet/schedule mgmt | `ticketing-service` (`OperatorController`: create/cancel own trips, per-operator isolation) |
| FR9 Reporting/analytics | `ticketing-service` (`OperatorController` revenue and occupancy per trip, computed live; no separate Analytics service or regulator role) |
| FR10 Trip lifecycle | `ticketing-service` (`TripController` start/complete, ticket reconciliation) |

## Repository layout

```
project/
  services/
    user-service/        Spring Boot 3 (Java 17) - identity, auth, OTP
    ticketing-service/    Spring Boot 3 (Java 17) - routes, booking, QR tickets
    tracking-service/     NestJS (TypeScript) - telemetry, live location, ETA
  gateway/
    kong.yml               Declarative Kong config
  web-portal/               React 19 + TypeScript (Vite)
  infra/
    postgres/               Multi-DB init script
    mosquitto/              MQTT broker config
  docker-compose.yml
```
