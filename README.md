# TransitLK - CA-03 Prototype

Functional prototype of the three core services scoped out of the CA-01 architecture
report (`../latex/EG_2020_4202.pdf`): **User & Identity**, **Ticketing & Booking**
(with QR e-tickets), and **Vehicle Tracking** (live GPS + ETA), fronted by a Kong API
gateway and demonstrated through a React web portal.

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

1. **Register** a passenger at http://localhost:3000/register.
2. The account needs OTP activation (FR1). No real SMS gateway is wired up, so read
   the 6-digit code from the `user-service` container logs:
   ```bash
   docker compose logs -f user-service | grep "OTP for"
   ```
3. Enter the code on the **Verify OTP** screen - this logs you in.
4. **Search & Book**: search "Colombo" -> "Kandy", book a trip. This calculates the
   fare, "charges" the mock payment gateway, decrements the seat count, issues a
   digitally-signed QR ticket, and publishes `ticket-events`/`payment-events` to Kafka.
5. **My Tickets** shows the ticket with its QR code image.
6. Register a second account with role **Conductor** (also needs OTP verification),
   log in as that user, open **Validate Ticket**, and paste the `qrCode` value (visible
   in the My Tickets API response, or via `GET /api/tickets/{id}`) to redeem it. A
   second attempt correctly reports "already used".
7. **Live Map**: run the bundled simulator to see a vehicle move across the map in
   real time over WebSocket:
   ```bash
   node services/tracking-service/scripts/simulate-vehicle.js NB-1234
   ```

## Demo accounts

`user-service` seeds four enabled accounts on first start (password `demo1234`), so the
demo needs no OTP step:

| Role | Login |
|---|---|
| Passenger | `passenger@transitlk.lk` |
| Conductor | `conductor@transitlk.lk` |
| Operator | `operator@transitlk.lk` |
| Regulator (NTC) | `regulator@transitlk.lk` |

After upgrading from an older checkout, run `docker compose down -v` once so the seeded
trips get an operator. `node scripts/smoke-backend.mjs` runs the whole backend demo story
(book, start trip, ticket-gated tracking, notifications, validate, complete, reports)
against a running stack and exits non-zero if any step fails.

## Mobile app

The passenger app (Expo / React Native) lives in `mobile-app/`; see
[mobile-app/README.md](mobile-app/README.md) for setup on a phone or emulator.

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
| FR9 Reporting/analytics | `ticketing-service` (`OperatorController` summary, `RegulatorController` analytics computed live, no separate Analytics service) |
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
