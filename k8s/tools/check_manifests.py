#!/usr/bin/env python3
"""Offline consistency checks for the Kubernetes manifests. No cluster is needed.

    python k8s/tools/check_manifests.py

It renders k8s/ with `kubectl kustomize` (override the binary with the KUBECTL environment
variable) and checks the rules a schema validator cannot: labels line up, Services reach real
container ports, every referenced ConfigMap/Secret key exists, the settings match
docker-compose.yml, and the files copied into ConfigMaps still equal their originals.
Exit code 0 means every check passed.
"""
import os
import pathlib
import subprocess
import sys
from urllib.parse import urlparse

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
K8S = pathlib.Path(os.environ.get("K8S_DIR", ROOT / "k8s"))  # K8S_DIR lets the self-test point at a mutated copy
KUBECTL = os.environ.get("KUBECTL", "kubectl")

EXPECTED_STATEFULSETS = {"postgres", "kafka"}
EXPECTED_DEPLOYMENTS = {"redis", "mosquitto", "kong", "user-service", "ticketing-service", "tracking-service", "web-portal"}
EXPECTED_SERVICES = EXPECTED_STATEFULSETS | EXPECTED_DEPLOYMENTS
JAVA_SERVICES = {"user-service", "ticketing-service"}
# Autoscaling is only safe for services that keep no per-pod state. tracking-service holds its
# WebSocket rooms in memory, so extra replicas would silently drop live updates.
AUTOSCALED = {"user-service", "ticketing-service"}
NEVER_AUTOSCALED = {"tracking-service", "kong", "postgres", "kafka", "redis", "mosquitto", "web-portal"}

errors = []
checks = 0


def check(condition, message):
    global checks
    checks += 1
    if not condition:
        errors.append(message)


def render():
    result = subprocess.run([KUBECTL, "kustomize", str(K8S)], capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr)
        sys.exit("FAIL: `kubectl kustomize k8s` did not render")
    return [d for d in yaml.safe_load_all(result.stdout) if d]


def normalised(text):
    return text.replace("\r\n", "\n").strip()


def read(path):
    return normalised(pathlib.Path(path).read_text(encoding="utf-8"))


def pod_spec(workload):
    return workload["spec"]["template"]["spec"]


def pod_labels(workload):
    return workload["spec"]["template"]["metadata"].get("labels", {})


def container_ports(workload):
    names, numbers = set(), set()
    for c in pod_spec(workload)["containers"]:
        for p in c.get("ports", []):
            numbers.add(p["containerPort"])
            if "name" in p:
                names.add(p["name"])
    return names, numbers


def main():
    docs = render()
    by_kind = {}
    for d in docs:
        by_kind.setdefault(d["kind"], {})[d["metadata"]["name"]] = d

    statefulsets = by_kind.get("StatefulSet", {})
    deployments = by_kind.get("Deployment", {})
    services = by_kind.get("Service", {})
    configmaps = by_kind.get("ConfigMap", {})
    secrets = by_kind.get("Secret", {})
    hpas = by_kind.get("HorizontalPodAutoscaler", {})
    workloads = {**statefulsets, **deployments}

    # --- the expected set of objects exists -------------------------------------------------
    check(set(statefulsets) == EXPECTED_STATEFULSETS, f"StatefulSets {sorted(statefulsets)} != {sorted(EXPECTED_STATEFULSETS)}")
    check(set(deployments) == EXPECTED_DEPLOYMENTS, f"Deployments {sorted(deployments)} != {sorted(EXPECTED_DEPLOYMENTS)}")
    check(set(services) == EXPECTED_SERVICES, f"Services {sorted(services)} != {sorted(EXPECTED_SERVICES)}")
    check("transitlk" in by_kind.get("Namespace", {}), "Namespace 'transitlk' is not defined")

    for d in docs:
        if d["kind"] not in ("Namespace", "ClusterRole", "ClusterRoleBinding"):
            check(d["metadata"].get("namespace") == "transitlk",
                  f"{d['kind']}/{d['metadata']['name']} is not in namespace 'transitlk'")

    # --- every workload is well formed -------------------------------------------------------
    for name, w in workloads.items():
        spec, labels = pod_spec(w), pod_labels(w)
        selector = w["spec"]["selector"]["matchLabels"]
        check(all(labels.get(k) == v for k, v in selector.items()), f"{name}: selector labels are not on the pod template")
        check(spec.get("automountServiceAccountToken") is False, f"{name}: should set automountServiceAccountToken: false")
        check(spec.get("enableServiceLinks") is False, f"{name}: should set enableServiceLinks: false (Service env vars such as KAFKA_PORT leak into the container)")
        for c in spec["containers"]:
            res = c.get("resources", {})
            check("cpu" in res.get("requests", {}) and "memory" in res.get("requests", {}), f"{name}/{c['name']}: needs cpu and memory requests")
            check("memory" in res.get("limits", {}), f"{name}/{c['name']}: needs a memory limit")
            check("readinessProbe" in c, f"{name}/{c['name']}: needs a readinessProbe")
            check("livenessProbe" in c or "startupProbe" in c, f"{name}/{c['name']}: needs a livenessProbe or startupProbe")
        for c in spec["containers"] + spec.get("initContainers", []):
            image = c["image"]
            tag = image.rsplit(":", 1)[1] if ":" in image.rsplit("/", 1)[-1] else ""
            check(tag not in ("", "latest"), f"{name}/{c['name']}: image '{image}' must be pinned to a tag")
        if name in JAVA_SERVICES:
            check(any("startupProbe" in c for c in spec["containers"]), f"{name}: a JVM service needs a startupProbe")
            check(spec.get("initContainers"), f"{name}: should wait for postgres and kafka in initContainers")

    for name in ("postgres", "kafka"):
        if name in statefulsets:
            check(statefulsets[name]["spec"].get("volumeClaimTemplates"), f"{name}: needs a volumeClaimTemplate (data must survive restarts)")

    # --- Services reach real pods and ports --------------------------------------------------
    for name, svc in services.items():
        selector = svc["spec"].get("selector", {})
        targets = [w for w in workloads.values() if all(pod_labels(w).get(k) == v for k, v in selector.items())]
        check(len(targets) == 1, f"Service {name}: selector matches {len(targets)} workloads, expected exactly 1")
        if len(targets) != 1:
            continue
        names, numbers = container_ports(targets[0])
        for p in svc["spec"]["ports"]:
            target = p.get("targetPort", p["port"])
            ok = target in names if isinstance(target, str) else target in numbers
            check(ok, f"Service {name}: targetPort {target} is not a container port of {targets[0]['metadata']['name']}")
        if name in statefulsets:
            check(targets[0]["spec"]["serviceName"] == name, f"StatefulSet {name}: serviceName must be '{name}'")

    # --- referenced ConfigMaps / Secrets / keys exist ----------------------------------------
    def keys_of(obj):
        return set(obj.get("data", {})) | set(obj.get("stringData", {}))

    effective_env = {}
    for name, w in workloads.items():
        spec = pod_spec(w)
        names = set()
        for c in spec["containers"] + spec.get("initContainers", []):
            for ef in c.get("envFrom", []):
                for kind, store in (("configMapRef", configmaps), ("secretRef", secrets)):
                    if kind in ef:
                        ref = ef[kind]["name"]
                        check(ref in store, f"{name}: envFrom {kind} '{ref}' does not exist")
                        names |= keys_of(store.get(ref, {}))
            for e in c.get("env", []):
                names.add(e["name"])
                src = e.get("valueFrom", {})
                for kind, store in (("configMapKeyRef", configmaps), ("secretKeyRef", secrets)):
                    if kind in src:
                        ref, key = src[kind]["name"], src[kind]["key"]
                        check(ref in store, f"{name}: {kind} '{ref}' does not exist")
                        check(key in keys_of(store.get(ref, {})), f"{name}: key '{key}' missing in '{ref}'")
        effective_env[name] = names
        for v in spec.get("volumes", []):
            for kind, store in (("configMap", configmaps), ("secret", secrets)):
                if kind in v:
                    check(v[kind]["name"] in store, f"{name}: volume '{v['name']}' uses missing {kind} '{v[kind]['name']}'")
        mounted = {m["name"] for c in spec["containers"] for m in c.get("volumeMounts", [])}
        defined = {v["name"] for v in spec.get("volumes", [])} | {
            t["metadata"]["name"] for t in w["spec"].get("volumeClaimTemplates", [])}
        check(mounted <= defined, f"{name}: volumeMounts without a volume: {sorted(mounted - defined)}")

    # --- same settings as docker-compose.yml -------------------------------------------------
    compose = yaml.safe_load((ROOT / "docker-compose.yml").read_text(encoding="utf-8"))
    for name in ("user-service", "ticketing-service", "tracking-service"):
        wanted = set(compose["services"][name].get("environment", {}))
        missing = wanted - effective_env.get(name, set())
        check(not missing, f"{name}: compose sets {sorted(missing)} but the Deployment does not")

    # --- every host name used resolves to a Service ------------------------------------------
    hosts = {}
    for name in ("user-service", "ticketing-service", "tracking-service"):
        w = deployments.get(name)
        if not w:
            continue
        for c in pod_spec(w)["containers"]:
            for e in c.get("env", []):
                if "value" in e:
                    hosts[(name, e["name"])] = e["value"]
        for ef in (ef for c in pod_spec(w)["containers"] for ef in c.get("envFrom", [])):
            if "configMapRef" in ef:
                for k, v in configmaps.get(ef["configMapRef"]["name"], {}).get("data", {}).items():
                    hosts[(name, k)] = v
    for (owner, key), value in hosts.items():
        host = None
        if key in ("DB_HOST", "REDIS_HOST"):
            host = value
        elif key == "KAFKA_BOOTSTRAP_SERVERS":
            host = value.split(":")[0]
        elif key == "MQTT_URL":
            host = urlparse(value).hostname
        if host:
            check(host in services, f"{owner}: {key}={value} points at '{host}', which is not a Service")

    kong_cm = next((cm for cm in configmaps.values() if "kong.yml" in cm.get("data", {})), None)
    check(kong_cm is not None, "no ConfigMap carries kong.yml")
    if kong_cm:
        kong = yaml.safe_load(kong_cm["data"]["kong.yml"])
        for s in kong["services"]:
            host = urlparse(s["url"]).hostname
            check(host in services, f"kong.yml: service {s['name']} -> {host}, which is not a Service")

    # --- copied files still equal the originals ----------------------------------------------
    parity = {
        "kong.yml": ROOT / "gateway" / "kong.yml",
        "init-multiple-dbs.sh": ROOT / "infra" / "postgres" / "init-multiple-dbs.sh",
        "mosquitto.conf": ROOT / "infra" / "mosquitto" / "mosquitto.conf",
    }
    for key, original in parity.items():
        carried = next((cm["data"][key] for cm in configmaps.values() if key in cm.get("data", {})), None)
        check(carried is not None, f"no ConfigMap carries {key}")
        if carried is not None:
            check(normalised(carried) == read(original), f"{key} in k8s/ differs from {original.relative_to(ROOT)} - copy it again")

    # --- autoscaling -------------------------------------------------------------------------
    targets = set()
    for name, hpa in hpas.items():
        ref = hpa["spec"]["scaleTargetRef"]
        targets.add(ref["name"])
        check(ref["kind"] == "Deployment" and ref["name"] in deployments, f"HPA {name}: target {ref['kind']}/{ref['name']} does not exist")
        check(ref["name"] not in NEVER_AUTOSCALED, f"HPA {name}: {ref['name']} must not be autoscaled (it keeps in-memory state)")
        check(hpa["spec"]["minReplicas"] >= 1 and hpa["spec"]["maxReplicas"] > hpa["spec"]["minReplicas"], f"HPA {name}: bad replica range")
        if ref["name"] in deployments:
            cpu = [c.get("resources", {}).get("requests", {}).get("cpu") for c in pod_spec(deployments[ref["name"]])["containers"]]
            check(all(cpu), f"HPA {name}: {ref['name']} needs a cpu request for utilisation scaling")
    check(targets == AUTOSCALED, f"HPAs target {sorted(targets)}, expected {sorted(AUTOSCALED)}")
    for name in AUTOSCALED & set(deployments):
        check("replicas" not in deployments[name]["spec"] or deployments[name]["spec"]["replicas"] == 1,
              f"{name}: leave replicas at 1 and let the HPA scale (also avoids concurrent first-boot seeding)")

    # --- client-facing ports stay the same as in compose -------------------------------------
    def service_ports(name):
        return {p["port"] for p in services.get(name, {}).get("spec", {}).get("ports", [])}

    check(8000 in service_ports("kong"), "Service kong must expose 8000 (the apps call it)")
    check(8083 in service_ports("tracking-service"), "Service tracking-service must expose 8083 (the apps connect to it directly)")
    check(80 in service_ports("web-portal"), "Service web-portal must expose 80")

    print(f"{checks} checks run, {len(errors)} failed")
    for e in errors:
        print(f"  FAIL  {e}")
    if not errors:
        print("All manifest checks passed.")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
