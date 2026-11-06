"""Self-test for check_manifests.py: break the manifests in known ways (in a temporary copy) and
confirm the checker fails on every one. A checker that cannot fail proves nothing.

    python k8s/tools/selftest_checker.py
"""
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
CHECKER = ROOT / "k8s" / "tools" / "check_manifests.py"

env_base = dict(os.environ)
env_base["KUBECTL"] = r"C:\Program Files\Docker\Docker\resources\bin\kubectl.exe"
env_base["PYTHONPATH"] = str(ROOT / ".tooling" / "pylib")


def replace(path, old, new, count=1):
    text = path.read_text(encoding="utf-8")
    assert old in text, f"mutation target not found in {path.name}: {old!r}"
    path.write_text(text.replace(old, new, count), encoding="utf-8")


def append(path, text):
    path.write_text(path.read_text(encoding="utf-8") + text, encoding="utf-8")


HPA_FOR_TRACKING = """---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: tracking-service
spec:
  scaleTargetRef: {apiVersion: apps/v1, kind: Deployment, name: tracking-service}
  minReplicas: 1
  maxReplicas: 3
  metrics:
    - type: Resource
      resource: {name: cpu, target: {type: Utilization, averageUtilization: 70}}
"""

MUTATIONS = [
    ("Service selector matches nothing", lambda d: replace(d / "apps/kong.yaml", "app.kubernetes.io/name: kong\n  ports:", "app.kubernetes.io/name: kongx\n  ports:")),
    ("Service targetPort is not a container port", lambda d: replace(d / "apps/user-service.yaml", "targetPort: http", "targetPort: web")),
    ("Secret key does not exist", lambda d: replace(d / "apps/user-service.yaml", "key: JWT_SECRET", "key: JWT_SECRETX")),
    ("memory limit removed", lambda d: replace(d / "data/redis.yaml", "            limits:\n              memory: 128Mi\n", "")),
    ("image not pinned", lambda d: replace(d / "data/redis.yaml", "redis:7-alpine", "redis:latest")),
    ("HPA added for tracking-service", lambda d: append(d / "hpa.yaml", HPA_FOR_TRACKING)),
    ("kong.yml copy drifts from gateway/kong.yml", lambda d: append(d / "files/kong.yml", "# drift\n")),
    ("DB_HOST points at a name that is not a Service", lambda d: replace(d / "config.yaml", "DB_HOST: postgres", "DB_HOST: postgress")),
    ("compose setting missing from the config", lambda d: replace(d / "config.yaml", '  JWT_EXPIRATION_SECONDS: "3600"\n', "")),
    ("enableServiceLinks turned on for kafka", lambda d: replace(d / "data/kafka.yaml", "enableServiceLinks: false", "enableServiceLinks: true")),
    ("readinessProbe removed from web-portal", lambda d: replace(d / "apps/web-portal.yaml", "          readinessProbe:\n            httpGet:\n              path: /\n              port: http\n            periodSeconds: 10\n", "")),
]

missed = 0
for name, mutate in MUTATIONS:
    with tempfile.TemporaryDirectory() as tmp:
        copy = pathlib.Path(tmp) / "k8s"
        shutil.copytree(ROOT / "k8s", copy)
        mutate(copy)
        env = dict(env_base, K8S_DIR=str(copy))
        run = subprocess.run([sys.executable, str(CHECKER)], capture_output=True, text=True, env=env)
    caught = run.returncode != 0
    first = next((ln.strip() for ln in run.stdout.splitlines() if "FAIL" in ln and "checks run" not in ln), "")
    print(("CAUGHT " if caught else "MISSED ") + name)
    if caught:
        print("        ->", first[:150])
    else:
        missed += 1

print(f"\n{len(MUTATIONS) - missed} of {len(MUTATIONS)} deliberate faults were caught")
sys.exit(1 if missed else 0)
