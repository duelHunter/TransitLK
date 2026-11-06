# TransitLK status dashboard

A small page that shows whether the running system is healthy. It runs on your laptop (not in
Docker), needs no extra packages, and uses about 40 MB.

```powershell
cd "E:\Aca\Semester-08\Software Architecture\project\project"
node dashboard/server.js          # then open http://localhost:8099
```

Stop it with Ctrl+C. The Docker stack should already be running (`docker compose up -d`).

## What it shows

| Section | Source | Refresh |
|---|---|---|
| Services: user, ticketing, tracking, Kong, web portal (up/down, response time) | their health endpoints | 5 s |
| Containers: state, health, uptime, restarts, CPU, memory | `docker ps`, `docker inspect`, `docker stats` | 5 s |
| Data tier: Postgres up and size, Redis up and buses reporting live, Kafka topics and notification-consumer lag | `docker exec` into those containers | 15 s |
| Live counts: trips and tickets by status, accounts by role (numbers only) | read-only SQL counts | 15 s |
| Recent errors: last 5 real error lines per service | `docker logs` (routine start-up noise filtered, tokens and secrets redacted) | 30 s |

The overall badge shows the worst state present: green OK, amber needs attention (for example a restart,
a service still starting, or a Kafka consumer with no members), red something is down.
`GET /api/status` returns the same data as JSON.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `DASHBOARD_PORT` | `8099` | port to listen on |
| `DASHBOARD_HOST` | `0.0.0.0` | `127.0.0.1` keeps it to this laptop only |
| `DOCKER` | Docker Desktop's `docker.exe`, else `docker` | path to the docker CLI |

## Who can see it

By default it is open to anyone on your Wi-Fi with no login (set up that way for the demo). It is
read-only: it accepts only GET, has no buttons that change anything, and shows no passenger names,
emails, ticket codes or secrets, only counts. To open it from a phone, allow inbound TCP 8099 in the
Windows firewall (private network). Set `DASHBOARD_HOST=127.0.0.1` to keep it local.

It runs on the host, not in a container, on purpose: reading container CPU and memory from inside a
container needs the Docker socket mounted, which gives that container full control of Docker, and
that should not sit behind a page with no login.

## Tests

```powershell
node --test dashboard/lib.test.js dashboard/server.test.js    # 19 tests
```

They cover the output parsing, the health classification, log filtering and redaction, and the HTTP
behaviour (read-only, 404s, no credentials in the data).

## Limits

- Shows the current state only, with no history or graphs (Prometheus and Grafana would add that).
- Works only on the machine running Docker, since it calls the `docker` command.
- The `/api/status` snapshot is shared: opening the page in several browsers does not add load.
- The error list can include genuine start-up messages, for example the tracking service's Kafka
  "does not host this topic-partition" line right after a cold start.
