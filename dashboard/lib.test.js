const { test } = require('node:test');
const assert = require('node:assert/strict');
const lib = require('./lib');

test('parseSize understands Docker units', () => {
  assert.equal(lib.parseSize('9.863MiB'), 9.863 * 1024 ** 2);
  assert.equal(lib.parseSize('1.5GiB'), 1.5 * 1024 ** 3);
  assert.equal(lib.parseSize('512kB'), 512 * 1000);
  assert.equal(lib.parseSize('0B'), 0);
  assert.equal(lib.parseSize('garbage'), null);
});

test('parseStatsLine turns one docker stats JSON line into numbers', () => {
  const line = JSON.stringify({
    Name: 'transitlk-kong', CPUPerc: '19.98%', MemPerc: '10.77%', MemUsage: '845.9MiB / 7.667GiB', PIDs: '13',
  });
  const s = lib.parseStatsLine(line);
  assert.equal(s.name, 'transitlk-kong');
  assert.equal(s.cpuPercent, 19.98);
  assert.equal(s.memPercent, 10.77);
  assert.equal(Math.round(s.memUsedMb), 846);
  assert.equal(Math.round(s.memLimitMb), 7851);
});

test('parseStatsLine returns null for unreadable lines', () => {
  assert.equal(lib.parseStatsLine('not json'), null);
  assert.equal(lib.parseStatsLine(''), null);
});

test('containerState combines run state, health and restarts', () => {
  assert.equal(lib.containerState({ status: 'running', health: 'healthy', restarts: 0 }), 'ok');
  assert.equal(lib.containerState({ status: 'running', health: 'none', restarts: 0 }), 'ok');
  assert.equal(lib.containerState({ status: 'running', health: 'starting', restarts: 0 }), 'warn');
  assert.equal(lib.containerState({ status: 'running', health: 'unhealthy', restarts: 0 }), 'down');
  assert.equal(lib.containerState({ status: 'exited', health: 'none', restarts: 0 }), 'down');
  assert.equal(lib.containerState({ status: 'created', health: 'none', restarts: 0 }), 'down');
  assert.equal(lib.containerState({ status: 'running', health: 'healthy', restarts: 3 }), 'warn');
});

test('probeState: fast 2xx is ok, slow 2xx warns, anything else is down', () => {
  assert.equal(lib.probeState({ status: 200, ms: 40 }), 'ok');
  assert.equal(lib.probeState({ status: 200, ms: 1500 }), 'warn');
  assert.equal(lib.probeState({ status: 503, ms: 20 }), 'down');
  assert.equal(lib.probeState({ status: 0, ms: 5000 }), 'down');
  assert.equal(lib.probeState({ error: 'timeout' }), 'down');
});

test('overallState is the worst state present', () => {
  assert.equal(lib.overallState(['ok', 'ok']), 'ok');
  assert.equal(lib.overallState(['ok', 'warn', 'ok']), 'warn');
  assert.equal(lib.overallState(['ok', 'warn', 'down']), 'down');
  assert.equal(lib.overallState([]), 'unknown');
});

test('parseGroupCounts reads psql "label|count" rows', () => {
  assert.deepEqual(lib.parseGroupCounts('ONGOING|1\nSCHEDULED|43\n'), { ONGOING: 1, SCHEDULED: 43 });
  assert.deepEqual(lib.parseGroupCounts(''), {});
  assert.deepEqual(lib.parseGroupCounts('bad line\nX|notanumber\nOK|2'), { OK: 2 });
});

test('parseConsumerLag sums numeric lag per topic and ignores "-"', () => {
  const out = [
    '',
    'GROUP TOPIC PARTITION CURRENT-OFFSET LOG-END-OFFSET LAG CONSUMER-ID',
    'g trip-events 1 - 0 - c-1',
    'g payment-events 1 1 1 0 c-1',
    'g payment-events 0 5 8 3 c-1',
    'g ticket-events 2 1 4 3 c-1',
  ].join('\n');
  const r = lib.parseConsumerLag(out);
  assert.deepEqual(r.byTopic, { 'trip-events': 0, 'payment-events': 3, 'ticket-events': 3 });
  assert.equal(r.total, 6);
  assert.equal(r.members, 1);
});

test('parseConsumerLag reports no members when the group is empty or missing', () => {
  const r = lib.parseConsumerLag("Consumer group 'g' has no active members.");
  assert.equal(r.members, 0);
  assert.equal(r.total, 0);
});

test('relevantErrors keeps real problems and drops routine noise', () => {
  const log = [
    '2026-11-06T10:00:00Z  INFO 1 --- [main] Started UserServiceApplication',
    '2026-11-06T10:00:01Z  WARN 1 --- [main] SQL Warning Code: 0, SQLState: 00000',
    '2026-11-06T10:00:01Z  WARN 1 --- [main] constraint "uk123" of relation "users" does not exist, skipping',
    '2026-11-06T10:00:02Z ERROR 1 --- [nio-8082-exec-1] Unexpected error: boom',
    'java.lang.IllegalStateException: boom',
    '2026-11-06T10:00:03Z  INFO 1 --- [ntainer#0-0-C-1] o.a.k.c.c.internals.ConsumerCoordinator : Request joining group due to: error',
  ].join('\n');
  const found = lib.relevantErrors(log, 10);
  assert.equal(found.length, 2);
  assert.match(found[0], /ERROR/);
  assert.match(found[1], /IllegalStateException/);
});

test('relevantErrors keeps only the latest N', () => {
  const log = Array.from({ length: 12 }, (_, i) => `ERROR number ${i}`).join('\n');
  const found = lib.relevantErrors(log, 3);
  assert.deepEqual(found, ['ERROR number 9', 'ERROR number 10', 'ERROR number 11']);
});

test('redactErrorLine removes bearer tokens and long secrets', () => {
  const line = 'ERROR bad token Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.abcdefgh and password=hunter2';
  const out = lib.redactErrorLine(line);
  assert.doesNotMatch(out, /eyJhbGci/);
  assert.doesNotMatch(out, /hunter2/);
  assert.match(out, /\[redacted\]/);
});

test('safeContainerName accepts compose names only (guards the docker commands)', () => {
  assert.equal(lib.safeContainerName('transitlk-kong'), true);
  assert.equal(lib.safeContainerName('transitlk-user-service'), true);
  assert.equal(lib.safeContainerName('kong; rm -rf /'), false);
  assert.equal(lib.safeContainerName('../etc'), false);
  assert.equal(lib.safeContainerName(''), false);
});

test('formatUptime renders a short human duration', () => {
  assert.equal(lib.formatUptime(45), '45s');
  assert.equal(lib.formatUptime(125), '2m');
  assert.equal(lib.formatUptime(3 * 3600 + 120), '3h 2m');
  assert.equal(lib.formatUptime(2 * 86400 + 5 * 3600), '2d 5h');
});
