# TransitLK passenger app

Expo (React Native, TypeScript, Expo Router) app for passengers: sign in, search and book,
hold QR tickets, track only the bus a ticket covers, and receive in-app notifications.
It talks to the backend through Kong (`:8000`) and to the tracking service (`:8083`) directly.

## Setup

```bash
cd mobile-app
npm install
cp .env.example .env      # then set EXPO_PUBLIC_API_HOST to your laptop's LAN IP
npx expo start
```

Scan the QR code with the Expo Go app, or press `a` for an Android emulator.

- Physical phone: `EXPO_PUBLIC_API_HOST` is the laptop's Wi-Fi IPv4 address (e.g. `192.168.1.50`).
- Android emulator: `EXPO_PUBLIC_API_HOST=10.0.2.2`.
- `.npmrc` sets `legacy-peer-deps=true` because Expo's optional peers conflict with npm's resolver.

## Network checklist

1. Phone and laptop are on the same Wi-Fi.
2. The Windows firewall allows inbound TCP 8000 (Kong), 8083 (tracking) and 8081 (Metro) on the private network.
3. The backend is running: `docker compose up -d` from the repository root.
4. `http://<laptop-ip>:8000/api/routes/search?origin=Colombo&destination=Kandy` opens in the phone's browser.

## Demo account

`passenger@transitlk.lk` / `demo1234` (prefilled on the sign-in screen).

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Jest unit tests for the pure helpers (format, notifications, map script, error messages) |
| `npx tsc --noEmit` | Type-check |
| `npx expo export --platform android` | Bundle check without a device |

## Known limits

- Notifications are polled every 5 seconds while the app is open. There is no push.
- The live map needs internet access on the phone (Leaflet script and OpenStreetMap tiles).
  If tiles stay grey, switch the tile URL in `src/lib/mapHtml.ts` to another provider.
- Conductor validation, operator and regulator screens live in the web portal, not here.
