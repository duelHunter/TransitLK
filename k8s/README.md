# TransitLK on Kubernetes

Kustomize manifests for the whole stack, matching the report's target deployment (services on
Kubernetes behind an API gateway). `docker-compose.yml` stays the way the demo is normally run; this
folder is the same system expressed as Kubernetes objects.

## Status: validated, not deployed

| Verified | How |
|---|---|
| All 26 rendered objects are valid Kubernetes 1.32 resources, with no unknown fields | `kubeconform -strict` |
| 205 consistency checks pass: labels and selectors line up, every Service reaches a real container port, every referenced ConfigMap/Secret key exists, every service's settings match `docker-compose.yml`, every host name resolves to a Service, probes, resource limits and pinned images are present, copied files equal their originals | `python k8s/tools/check_manifests.py` |
| The checker itself can fail: 11 deliberate faults are each caught | `python k8s/tools/selftest_checker.py` |

**Not verified:** the manifests have never been applied to a running cluster. Behaviour that only a
live cluster shows (start-up timing, the Kafka and Postgres volumes, probe thresholds, autoscaling)
is untested. Expect to adjust probe timings on first run.

## What maps to what

| docker-compose | Kubernetes |
|---|---|
| `postgres` + volume + init script | StatefulSet `postgres` (1Gi volume), init script in a ConfigMap, Service `postgres` |
| `kafka` + volume | StatefulSet `kafka` (1Gi volume), headless Service `kafka` |
| `redis`, `mosquitto` | Deployments with Services; Mosquitto config in a ConfigMap |
| `user-service`, `ticketing-service` | Deployments + Services, autoscaled 1 to 3 pods on CPU (`hpa.yaml`) |
| `tracking-service` | Deployment + Service, **always one pod** (see below) |
| `kong` + `gateway/kong.yml` | Deployment + Service `kong` (port 8000), routes in a ConfigMap |
| `web-portal` | Deployment + Service `web-portal` (port 80) |
| `environment:` blocks | ConfigMap `transitlk-config` and Secret `transitlk-secrets` |
| `depends_on` | `wait-for-dependencies` init containers plus readiness probes |

Service names are identical to the compose names (`postgres`, `kafka`, `user-service`, ...), so the
applications' settings did not change. Resource requests total about 1.1 CPU and 2.3 GB of memory.

## Deploying to minikube

Free memory first: stop the compose stack, because the two do not fit side by side on a 16 GB
laptop. Keep minikube's files off the C: drive.

```powershell
$root = "E:\Aca\Semester-08\Software Architecture\project\project"
$env:MINIKUBE_HOME = "$root\.tooling\minikube"
docker compose down                       # in the repo root

minikube start --driver=docker --cpus=4 --memory=6144
minikube addons enable metrics-server     # needed by the autoscalers

# Build the images inside minikube's Docker so the cluster can use them without a registry.
& minikube docker-env --shell powershell | Invoke-Expression
docker build -t transitlk/user-service:dev     services/user-service
docker build -t transitlk/ticketing-service:dev services/ticketing-service
docker build -t transitlk/tracking-service:dev services/tracking-service
docker build -t transitlk/web-portal:dev --build-arg VITE_API_BASE_URL=http://localhost:8000 --build-arg VITE_WS_URL=http://localhost:8083 web-portal

kubectl apply -k k8s/
kubectl -n transitlk get pods -w          # wait until everything is Running and Ready
```

Reach it from your laptop and from phones on the same Wi-Fi (the apps keep their current `.env`):

```powershell
kubectl -n transitlk port-forward --address 0.0.0.0 svc/kong 8000:8000
kubectl -n transitlk port-forward --address 0.0.0.0 svc/tracking-service 8083:8083
kubectl -n transitlk port-forward svc/web-portal 3000:80
node scripts/smoke-backend.mjs            # the same 22 end-to-end checks as with compose
```

Remove everything with `kubectl delete -k k8s/` (the volumes go with the StatefulSets' claims only
if you also delete the PersistentVolumeClaims: `kubectl -n transitlk delete pvc --all`).

## Known limits

- **tracking-service cannot be scaled out yet.** Each pod keeps its WebSocket rooms in memory, so with
  several pods a ping received by one pod would never reach a client connected to another. It needs the
  Socket.IO Redis adapter and sticky sessions on the gateway first. There is deliberately no autoscaler
  for it, and the checker fails if one is added.
- **Kong rate limiting is per pod** (the `local` policy). Keep one Kong pod, or switch the plugin to the
  `redis` policy before adding more.
- **Secrets are development values** (the same defaults as compose). Replace them before any real use.
- **One Kafka broker and one Postgres instance**, as in compose: no replication or failover.
- **The web portal bundle has the API address compiled in.** Rebuild the image with the URLs the
  operator's browser will use.
- **No Ingress, TLS or NetworkPolicy.** Access is by port-forward. Network policies also need a network
  plugin that enforces them.
- **Demo data seeding** runs when `ticketing-service` starts. The autoscaler starts from one pod so two
  pods do not seed at the same moment.

## Checking the files yourself

```bash
pip install pyyaml
python k8s/tools/check_manifests.py        # needs kubectl on PATH, or set KUBECTL
python k8s/tools/selftest_checker.py       # proves the checker catches faults
kubectl kustomize k8s | kubeconform -strict -kubernetes-version 1.32.0 -summary -
```

`k8s/files/` holds copies of `gateway/kong.yml`, `infra/postgres/init-multiple-dbs.sh` and
`infra/mosquitto/mosquitto.conf` so this folder is self-contained. If you change an original, copy it
again; the checker fails when a copy has drifted.
