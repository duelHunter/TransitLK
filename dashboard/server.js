'use strict';
// TransitLK status dashboard. Run on the host:  node dashboard/server.js
// Read-only: it probes service health endpoints and runs a few read-only docker commands.
// No dependencies beyond Node 18+.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const lib = require('./lib');

const PORT = parseInt(process.env.DASHBOARD_PORT || '8099', 10);
// 0.0.0.0 = reachable from the Wi-Fi (no login, by design for the demo). Use 127.0.0.1 to keep it local.
const HOST = process.env.DASHBOARD_HOST || '0.0.0.0';
const WINDOWS_DOCKER = 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';
const DOCKER = process.env.DOCKER || (fs.existsSync(WINDOWS_DOCKER) ? WINDOWS_DOCKER : 'docker');

const FAST_MS = 5000; // services, containers
const SLOW_MS = 15000; // data tier (starts a JVM inside Kafka, so not every few seconds)
const LOG_MS = 30000; // error scan

const PROBES = [
  { id: 'user-service', label: 'User service', url: 'http://localhost:8081/actuator/health' },
  { id: 'ticketing-service', label: 'Ticketing service', url: 'http://localhost:8082/actuator/health' },
  { id: 'tracking-service', label: 'Tracking service', url: 'http://localhost:8083/health' },
  { id: 'kong', label: 'API gateway (Kong)', url: 'http://localhost:8001/status' },
  { id: 'web-portal', label: 'Operator web portal', url: 'http://localhost:3000/' },
];
const LOG_CONTAINERS = ['transitlk-user-service', 'transitlk-ticketing-service', 'transitlk-tracking-service', 'transitlk-kong'];

function run(args, timeoutMs = 15000) {
  return new Promise((resolve) => {
    // execFile, never a shell: nothing here is ever interpreted as a command line.
    execFile(DOCKER, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: String(stdout || ''), err: String(stderr || (err && err.message) || '') });
    });
  });
}

async function probe(p) {
  const started = Date.now();
  try {
    const res = await fetch(p.url, { signal: AbortSignal.timeout(3000) });
    return { id: p.id, label: p.label, status: res.status, ms: Date.now() - started };
  } catch (e) {
    return { id: p.id, label: p.label, error: e.name === 'TimeoutError' ? 'timeout' : 'unreachable', ms: Date.now() - started };
  }
}

async function collectServices() {
  const results = await Promise.all(PROBES.map(probe));
  return results.map((r) => ({ ...r, state: lib.probeState(r) }));
}

async function collectContainers() {
  const ps = await run(['ps', '-a', '--filter', 'name=transitlk-', '--format', '{{.Names}}']);
  if (!ps.ok) return { error: 'docker is not reachable', items: [] };
  const names = ps.out.split('\n').map((s) => s.trim()).filter(lib.safeContainerName);
  if (!names.length) return { items: [] };

  const fmt = '{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.RestartCount}}|{{.State.StartedAt}}';
  const [inspect, stats] = await Promise.all([
    run(['inspect', '-f', fmt, ...names]),
    run(['stats', '--no-stream', '--format', '{{json .}}', ...names], 20000),
  ]);

  const statByName = {};
  for (const line of stats.out.split('\n')) {
    const s = lib.parseStatsLine(line);
    if (s) statByName[s.name] = s;
  }
  const items = [];
  for (const line of inspect.out.split('\n')) {
    const [rawName, status, health, restarts, startedAt] = line.trim().split('|');
    if (!rawName) continue;
    const name = rawName.replace(/^\//, '');
    const started = Date.parse(startedAt);
    const info = { status, health, restarts: parseInt(restarts, 10) || 0 };
    items.push({
      name,
      status,
      health,
      restarts: info.restarts,
      state: lib.containerState(info),
      uptime: status === 'running' && !Number.isNaN(started) ? lib.formatUptime((Date.now() - started) / 1000) : null,
      stats: statByName[name] || null,
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  return { items };
}

async function collectData() {
  const exec = (container, cmd, timeout) => run(['exec', container, ...cmd], timeout);
  const [pgPing, trips, tickets, users, size, redisPing, redisKeys, lag, topics] = await Promise.all([
    exec('transitlk-postgres', ['pg_isready', '-h', '127.0.0.1', '-U', 'transitlk']),
    exec('transitlk-postgres', ['psql', '-U', 'transitlk', '-d', 'transitlk_ticketing', '-tA', '-F', '|', '-c', 'select status, count(*) from trips group by status order by 1']),
    exec('transitlk-postgres', ['psql', '-U', 'transitlk', '-d', 'transitlk_ticketing', '-tA', '-F', '|', '-c', 'select status, count(*) from tickets group by status order by 1']),
    exec('transitlk-postgres', ['psql', '-U', 'transitlk', '-d', 'transitlk_users', '-tA', '-F', '|', '-c', 'select role, count(*) from users group by role order by 1']),
    exec('transitlk-postgres', ['psql', '-U', 'transitlk', '-d', 'transitlk_users', '-tA', '-c', "select pg_database_size('transitlk_users') + pg_database_size('transitlk_ticketing')"]),
    exec('transitlk-redis', ['redis-cli', 'ping']),
    exec('transitlk-redis', ['redis-cli', '--scan', '--pattern', 'vehicle:live:*']),
    exec('transitlk-kafka', ['/opt/kafka/bin/kafka-consumer-groups.sh', '--bootstrap-server', 'localhost:9092', '--describe', '--group', 'user-service-notifications'], 30000),
    exec('transitlk-kafka', ['/opt/kafka/bin/kafka-topics.sh', '--bootstrap-server', 'localhost:9092', '--list'], 30000),
  ]);

  const dbBytes = parseInt(size.out.trim(), 10);
  const kafkaUp = topics.ok;
  const lagInfo = lib.parseConsumerLag(lag.out);
  return {
    postgres: {
      state: pgPing.ok ? 'ok' : 'down',
      sizeMb: Number.isFinite(dbBytes) ? Math.round((dbBytes / 1024 / 1024) * 10) / 10 : null,
    },
    redis: {
      state: redisPing.ok && redisPing.out.trim() === 'PONG' ? 'ok' : 'down',
      liveVehicles: redisKeys.ok ? redisKeys.out.split('\n').filter((l) => l.trim()).length : null,
    },
    kafka: {
      state: !kafkaUp ? 'down' : lagInfo.members === 0 ? 'warn' : lagInfo.total > 100 ? 'warn' : 'ok',
      topics: kafkaUp ? topics.out.split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('__')) : [],
      consumerMembers: lagInfo.members,
      lagTotal: lagInfo.total,
      lagByTopic: lagInfo.byTopic,
    },
    counts: {
      trips: lib.parseGroupCounts(trips.out),
      tickets: lib.parseGroupCounts(tickets.out),
      users: lib.parseGroupCounts(users.out),
    },
  };
}

async function collectErrors() {
  const out = {};
  await Promise.all(LOG_CONTAINERS.map(async (c) => {
    if (!lib.safeContainerName(c)) return;
    const r = await run(['logs', '--tail', '300', c], 15000);
    // docker writes container stderr to stderr, so look at both.
    out[c.replace('transitlk-', '')] = lib.relevantErrors(`${r.out}\n${r.err}`, 5);
  }));
  return out;
}

function makeCollector(collectors = { collectServices, collectContainers, collectData, collectErrors }) {
  const snap = { generatedAt: null, services: [], containers: { items: [] }, data: null, errors: {}, summary: 'unknown' };
  const running = { fast: false, slow: false, log: false };

  async function guard(key, fn) {
    if (running[key]) return;
    running[key] = true;
    try { await fn(); } catch (e) { snap.collectorError = e.message; } finally { running[key] = false; }
  }
  function recompute() {
    const states = [...snap.services.map((s) => s.state), ...snap.containers.items.map((c) => c.state)];
    if (snap.data) states.push(snap.data.postgres.state, snap.data.redis.state, snap.data.kafka.state);
    snap.summary = lib.overallState(states);
    snap.generatedAt = new Date().toISOString();
  }
  const fast = () => guard('fast', async () => {
    const [services, containers] = await Promise.all([collectors.collectServices(), collectors.collectContainers()]);
    snap.services = services;
    snap.containers = containers;
    recompute();
  });
  const slow = () => guard('slow', async () => { snap.data = await collectors.collectData(); recompute(); });
  const logs = () => guard('log', async () => { snap.errors = await collectors.collectErrors(); recompute(); });
  return {
    snapshot: () => snap,
    start() {
      fast(); slow(); logs();
      const timers = [setInterval(fast, FAST_MS), setInterval(slow, SLOW_MS), setInterval(logs, LOG_MS)];
      return () => timers.forEach(clearInterval);
    },
    refreshOnce: async () => { await fast(); await slow(); await logs(); },
  };
}

function createServer(collector) {
  const page = () => fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
  return http.createServer((req, res) => {
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
    };
    if (req.method !== 'GET') {
      res.writeHead(405, { ...headers, Allow: 'GET' });
      return res.end('Method not allowed');
    }
    const url = new URL(req.url, 'http://x').pathname;
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page());
    }
    if (url === '/api/status') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(collector.snapshot()));
    }
    res.writeHead(404, { ...headers, 'Content-Type': 'text/plain' });
    res.end('Not found');
  });
}

module.exports = { createServer, makeCollector, collectServices, collectContainers, collectData, collectErrors };

if (require.main === module) {
  const collector = makeCollector();
  collector.start();
  createServer(collector).listen(PORT, HOST, () => {
    console.log(`TransitLK dashboard on http://localhost:${PORT}  (bound to ${HOST})`);
    console.log(`docker: ${DOCKER}`);
  });
}
