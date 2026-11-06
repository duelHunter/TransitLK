'use strict';
// Pure helpers for the status dashboard: parsing command output and classifying health.
// No I/O here, so everything is unit tested (lib.test.js).

const UNITS = {
  B: 1,
  KB: 1000, MB: 1000 ** 2, GB: 1000 ** 3, TB: 1000 ** 4,
  KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3, TIB: 1024 ** 4,
};

/** "845.9MiB" -> bytes. Docker prints decimal (kB, MB) and binary (KiB, MiB) units. */
function parseSize(text) {
  const m = /^([\d.]+)\s*([A-Za-z]+)$/.exec(String(text).trim());
  if (!m) return null;
  const factor = UNITS[m[2].toUpperCase()];
  return factor === undefined ? null : parseFloat(m[1]) * factor;
}

/** One line of `docker stats --no-stream --format '{{json .}}'`. */
function parseStatsLine(line) {
  let raw;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (!raw || !raw.Name) return null;
  const [used, limit] = String(raw.MemUsage || '').split('/');
  const usedBytes = parseSize(used || '');
  const limitBytes = parseSize(limit || '');
  return {
    name: raw.Name,
    cpuPercent: parseFloat(raw.CPUPerc) || 0,
    memPercent: parseFloat(raw.MemPerc) || 0,
    memUsedMb: usedBytes === null ? null : usedBytes / 1024 ** 2,
    memLimitMb: limitBytes === null ? null : limitBytes / 1024 ** 2,
    pids: parseInt(raw.PIDs, 10) || 0,
  };
}

/** 'ok' | 'warn' | 'down' for one container. */
function containerState({ status, health, restarts }) {
  if (status !== 'running') return 'down';
  if (health === 'unhealthy') return 'down';
  if (health === 'starting') return 'warn';
  if (restarts > 0) return 'warn';
  return 'ok';
}

const SLOW_MS = 1000;

/** 'ok' | 'warn' | 'down' for one HTTP probe result. */
function probeState(result) {
  if (!result || result.error) return 'down';
  if (!(result.status >= 200 && result.status < 300)) return 'down';
  return result.ms > SLOW_MS ? 'warn' : 'ok';
}

function overallState(states) {
  if (!states.length) return 'unknown';
  if (states.includes('down')) return 'down';
  if (states.includes('warn')) return 'warn';
  return 'ok';
}

/** psql -tA -F'|' rows ("label|count") -> { label: count }. Unreadable rows are skipped. */
function parseGroupCounts(text) {
  const out = {};
  for (const line of String(text).split('\n')) {
    const m = /^([^|]+)\|(\d+)\s*$/.exec(line.trim());
    if (m) out[m[1]] = parseInt(m[2], 10);
  }
  return out;
}

/** Output of kafka-consumer-groups.sh --describe: total lag per topic and active member count. */
function parseConsumerLag(text) {
  const byTopic = {};
  const members = new Set();
  let total = 0;
  for (const line of String(text).split('\n')) {
    const cols = line.trim().split(/\s+/);
    // GROUP TOPIC PARTITION CURRENT-OFFSET LOG-END-OFFSET LAG CONSUMER-ID
    if (cols.length < 7 || cols[0] === 'GROUP' || !/^\d+$/.test(cols[2])) continue;
    const topic = cols[1];
    const lag = /^\d+$/.test(cols[5]) ? parseInt(cols[5], 10) : 0; // "-" means nothing committed yet
    byTopic[topic] = (byTopic[topic] || 0) + lag;
    total += lag;
    if (cols[6] && cols[6] !== '-') members.add(cols[6]);
  }
  return { byTopic, total, members: members.size };
}

// Lines that look like errors but are routine (seen on every healthy start).
const NOISE = [
  /SQL Warning Code: 0/,
  /does not exist, skipping/,
  /ConsumerCoordinator/,
  /SubscriptionState/,
];
const PROBLEM = /\b(ERROR|FATAL)\b|Exception\b|Caused by/;

/** Redacts anything that could be a credential before a log line is shown on the page. */
function redactErrorLine(line) {
  return String(line)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_.-]+/g, '[redacted]')
    .replace(/\b(password|secret|token|pwd)\s*[=:]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 300);
}

/** The latest `limit` genuine problem lines from a container log. */
function relevantErrors(logText, limit) {
  const hits = String(logText)
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => PROBLEM.test(l) && !NOISE.some((n) => n.test(l)))
    .map(redactErrorLine);
  return hits.slice(-limit);
}

/** Container names are interpolated into docker commands, so only accept our own compose names. */
function safeContainerName(name) {
  return /^transitlk-[a-z0-9-]+$/.test(String(name));
}

function formatUptime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

module.exports = {
  parseSize, parseStatsLine, containerState, probeState, overallState, parseGroupCounts,
  parseConsumerLag, relevantErrors, redactErrorLine, safeContainerName, formatUptime,
};
