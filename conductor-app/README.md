# TransitLK conductor app

Expo (React Native, TypeScript, Expo Router) app for bus conductors: start and complete trips, see
the passenger list, and validate tickets by scanning their QR code, including when the phone has
no connection to the server.

It is separate from the passenger app (`../mobile-app`) and talks to the backend through Kong
(`:8000`). Booking, tickets and notifications are passenger-only and are refused for conductors.

## Setup

```bash
cd conductor-app
npm install
cp .env.example .env      # then set EXPO_PUBLIC_API_HOST to your laptop's LAN IP
npx expo start -c --port 8091
```

Scan the QR code with Expo Go. Use port **8091** so it does not clash with the passenger app (8090)
or the user-service (8081). Allow inbound TCP 8091 in the Windows firewall (private network).

- Physical phone: `EXPO_PUBLIC_API_HOST` is the laptop's Wi-Fi IPv4 address (e.g. `192.168.1.50`).
- Android emulator: `EXPO_PUBLIC_API_HOST=10.0.2.2`.
- `EXPO_PUBLIC_TICKET_SIGNING_SECRET` must equal ticketing-service's `TICKET_SIGNING_SECRET`. It lets
  the phone verify a ticket's signature with no connection. A production system would ship only a
  public key, not the shared secret.

## Demo account

`conductor@transitlk.lk` / `demo1234` (prefilled on the sign-in screen).

## What it does

| Tab | Features |
|---|---|
| Trips | Scheduled and ongoing trips. Start a trip (passengers get a "bus is on the way" alert), complete it (shows tickets issued vs. validated), and list the passengers of a trip. |
| Scan tickets | Scan a ticket's QR with the camera, or paste its code. Valid, already used and invalid tickets are shown clearly. |

### Offline validation

If the server cannot be reached (or **Simulate offline** is switched on), the phone checks the ticket's
signature and expiry itself and queues the boarding. Queued boardings are recorded automatically
every few seconds once the server is reachable again. The same ticket cannot be queued twice.

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Jest unit tests: signature check (known-answer vectors), offline queue, error and session helpers |
| `npx tsc --noEmit` | Type-check |
| `npx expo export --platform android` | Bundle check without a device |

## Known limits

- The camera scanner has not been exercised on a physical device from the development environment;
  the paste field is the fallback.
- The signed ticket is verified with a shared secret (see above).
