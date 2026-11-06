const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer, makeCollector } = require('./server');

const fake = {
  collectServices: async () => [
    { id: 'kong', label: 'API gateway (Kong)', status: 200, ms: 12, state: 'ok' },
    { id: 'user-service', label: 'User service', error: 'unreachable', ms: 3000, state: 'down' },
  ],
  collectContainers: async () => ({
    items: [{ name: 'transitlk-kong', status: 'running', health: 'healthy', restarts: 0, state: 'ok', uptime: '3m', stats: null }],
  }),
  collectData: async () => ({
    postgres: { state: 'ok', sizeMb: 7.5 },
    redis: { state: 'ok', liveVehicles: 1 },
    kafka: { state: 'warn', topics: ['ticket-events'], consumerMembers: 0, lagTotal: 0, lagByTopic: {} },
    counts: { trips: { SCHEDULED: 3 }, tickets: {}, users: {} },
  }),
  collectErrors: async () => ({ 'user-service': ['ERROR boom'] }),
};

async function withServer(fn) {
  const collector = makeCollector(fake);
  await collector.refreshOnce();
  const server = createServer(collector);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

test('the status endpoint serves the snapshot and summarises the worst state', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/api/status`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const body = await res.json();
    assert.equal(body.summary, 'down'); // one service down beats the warn and the oks
    assert.equal(body.services.length, 2);
    assert.equal(body.data.counts.trips.SCHEDULED, 3);
    assert.deepEqual(body.errors['user-service'], ['ERROR boom']);
  }));

test('the page is served with a locked-down content security policy', () =>
  withServer(async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(await res.text(), /TransitLK status/);
  }));

test('it is read-only: anything but GET is refused', () =>
  withServer(async (base) => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const res = await fetch(`${base}/api/status`, { method });
      assert.equal(res.status, 405, method);
    }
  }));

test('unknown paths are 404 (no file serving, so no path traversal)', () =>
  withServer(async (base) => {
    for (const p of ['/nope', '/../server.js', '/lib.js', '/%2e%2e/server.js']) {
      const res = await fetch(`${base}${p}`);
      assert.equal(res.status, 404, p);
    }
  }));

test('the snapshot never carries credentials', () =>
  withServer(async (base) => {
    const text = await (await fetch(`${base}/api/status`)).text();
    assert.doesNotMatch(text, /password|secret|jwt|bearer/i);
  }));
