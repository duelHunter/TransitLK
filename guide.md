# Complete guide to running TransitLK

Written for you as the person running the demo.

## 1. What you are running

| Part | What it is | Who uses it |
|---|---|---|
| Backend (Docker) | user-service, ticketing-service, tracking-service, Kong gateway, Postgres, Redis, Kafka, Mosquitto | everyone |
| Web portal (`web-portal/`) | operator dashboard, trips, live fleet map | **Operator** |
| Passenger app (`mobile-app/`) | search, book, QR tickets, live tracking, alerts | **Passenger** |
| Conductor app (`conductor-app/`) | trips, start/complete, QR scanning, offline validation | **Conductor** |

## 2. One-time prerequisites
- **Docker Desktop**, running. Your disk image is already on D:.
- **Node 22.18 or newer** (you have 22.19). The web unit tests need it.
- **Expo Go** on your phone, updated to the newest version (the apps use Expo SDK 57).
- **Phone and laptop on the same Wi-Fi.** Turn mobile data off on the phone.
- **JDK 17 and Maven** only if you want to run the Java tests yourself.
- **Keep caches off C:** these are the variables for each cmd window that runs npm. PowerShell equivalents follow.

```bat
set npm_config_cache=E:\Aca\Semester-08\Software Architecture\project\project\.tooling\npm-cache
set TMP=E:\Aca\Semester-08\Software Architecture\project\project\.tooling\tmp
set TEMP=E:\Aca\Semester-08\Software Architecture\project\project\.tooling\tmp
```

```powershell
$root = "E:\Aca\Semester-08\Software Architecture\project\project"
$env:npm_config_cache = "$root\.tooling\npm-cache"; $env:TMP = "$root\.tooling\tmp"; $env:TEMP = $env:TMP
```

## 3. Start the backend

```powershell
cd "E:\Aca\Semester-08\Software Architecture\project\project"
docker compose down -v          # optional: fresh data (do this before every demo)
docker compose up -d --build    # first build takes several minutes
docker compose ps               # expect 9 containers Up
```

- **Ready check:** wait about 60 to 90 seconds, then open `http://localhost:8000/api/routes/search?origin=Colombo&destination=Kandy`. It should return JSON with 2 trips.
- **Do not skip the reset.** Seeded trips depart a few hours after the first start, and the 24-hour search window then runs out, so old data shows "no trips".

| URL | What |
|---|---|
| http://localhost:3000 | operator web portal |
| http://localhost:8000 | API gateway (Kong); the apps use this |
| http://localhost:8083/health | tracking service (apps also connect here directly) |
| http://localhost:8081, 8082 | user and ticketing services (direct) |

## 4. Demo accounts
Password is **`demo1234`** for all of them.

| Role | Login | Client |
|---|---|---|
| Passenger | `passenger@transitlk.lk` | passenger app |
| Conductor | `conductor@transitlk.lk` | conductor app |
| Operator | `operator@transitlk.lk` | web portal |

New passenger or conductor accounts need an OTP. It is printed in the log:

```powershell
docker compose logs user-service | Select-String "OTP for"
```

## 5. Passenger app (Expo port 8090)

```bat
cd /d "E:\Aca\Semester-08\Software Architecture\project\project\mobile-app"
copy .env.example .env
notepad .env
```

Set `EXPO_PUBLIC_API_HOST` to your laptop's Wi-Fi IPv4 (`ipconfig`, it was `192.168.8.197`). Then, in a window with the cache variables set:

```bat
npm install
npx expo start -c --port 8090
```

Scan the QR code with Expo Go. **Allow inbound TCP 8000, 8083, 8090 and 8091** in Windows Firewall on the private network.

## 6. Conductor app (Expo port 8091)
Open a **second** command window and set the cache variables again.

```bat
cd /d "E:\Aca\Semester-08\Software Architecture\project\project\conductor-app"
copy .env.example .env
notepad .env
npm install
npx expo start -c --port 8091
```

- **`.env`:** set `EXPO_PUBLIC_API_HOST` to the same laptop IP. Keep `EXPO_PUBLIC_TICKET_SIGNING_SECRET` as it is.
- **Both apps at once:** use two Expo servers on different ports. Use 8090 and 8091, never 8081, because the user-service publishes 8081.
- **Switching apps:** open one app in Expo Go at a time.

## 7. The full demo (about 10 minutes)

1. **Passenger app:** sign in (prefilled). On **Book**, pick **From Colombo**, **To Kandy**, **Search trips**, then **Book**. A "Booking confirmed" banner and an Alerts badge appear within about 5 seconds.
2. **Passenger app, My Tickets:** the ticket shows with its QR code. Tapping **Track bus** now says "Trip is not in progress", which is correct.
3. **Conductor app, Trips:** sign in, then **Start trip** on NB-1234. The passenger app shows "Your bus is on the way".
4. **Move the bus:** in a terminal, run `node services\tracking-service\scripts\simulate-vehicle.js NB-1234`.
5. **Passenger app:** **My Tickets**, then **Track bus**. The bus appears and moves every 5 seconds. Only the bus on the ticket is visible.
6. **Conductor app, Scan tickets:** point the camera at the passenger's QR (or use the paste box). The result is **VALID** with the seat. Scan the same ticket again and it reports **already used**.
7. **Offline mode:** switch on **Simulate offline** and scan another ticket. It is accepted from the phone's own signature check and queued. Switch offline off, and within about 5 seconds it syncs.
8. **Conductor app, Trips:** **Complete trip**. The summary shows tickets issued, validated and not validated.
9. **Web portal:** sign in as the operator. The dashboard shows revenue and occupancy, **Live Map** shows the fleet, and you can schedule or cancel a trip. A cancelled trip alerts its passengers.

## 8. Checking everything without a phone
Run these in a window with the cache variables set.

```bat
node scripts\smoke-backend.mjs
```

It runs the backend story and prints 22 PASS lines (use it on a fresh database; it consumes the NB-1234 trip).

| Project | Command | Expected |
|---|---|---|
| user-service | `cd services\user-service && ..\..\.tooling\mvn.sh test` | 19 pass |
| ticketing-service | `cd services\ticketing-service && ..\..\.tooling\mvn.sh test` | 35 pass |
| tracking-service | `cd services\tracking-service && npm test` | 6 pass |
| web-portal | `cd web-portal && npm test` | 7 pass |
| mobile-app | `cd mobile-app && npm test` | 24 pass |
| conductor-app | `cd conductor-app && npm test` | 29 pass |

`mvn.sh` is a bash helper (use Git Bash for it). It keeps the Maven repository on E:.

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| "Cannot reach the server" in an app | Wrong IP in `.env` (then restart Expo with `-c`), different Wi-Fi, mobile data on, or firewall. Test `http://<laptop-ip>:8000/api/routes/search?origin=Colombo&destination=Kandy` in the phone's browser. |
| Docker error "port 8081 not available" | Something else holds 8081, usually an old Expo server. Stop it, then `docker compose up -d`. |
| "Your session has expired" | Logins last 1 hour. Sign in again. |
| Search shows no trips | The seeded data is stale. `docker compose down -v`, then `up -d`. |
| Kong 503, or ticketing-service exits | The ticketing database is missing, usually from a damaged Postgres init. `docker compose down -v`, then `up -d`. `.gitattributes` now stops Windows line-ending damage. |
| HTTP 429 "rate limit" | Kong allows 120 requests a minute per service. Wait a minute. |
| Docker build says a snapshot "does not exist" | `docker builder prune -af`, then rebuild. |
| Expo "register two views with the same name" | Corrupted hot reload. Stop Expo, restart with `-c`, close Expo Go fully. Do not switch git branches while Expo runs. |
| Grey map | The phone has no internet, or OpenStreetMap refused the tiles. |
| Track bus map stays empty | The trip isn't started, or the simulator isn't running. |

## 10. Stop and clean up

```powershell
docker compose down          # stop, keep data
docker compose down -v       # stop and wipe data
```

Press Ctrl+C in each Expo window to stop it.

## Things to know before the demo
- **Camera scanner:** I could not test it on a real phone from here. The paste box is the fallback.
- **Admin role:** it still exists in the backend, with no screen.
- **Operators and trips:** an operator can also start and complete any trip through the web Trips page, although that is the conductor's job. I can restrict it to conductors if you want.

I can save this guide into the repository as `docs/RUNNING.md` if you want it shared with the team.


```bash
node services\tracking-service\scripts\simulate-vehicle.js NB-1234
```