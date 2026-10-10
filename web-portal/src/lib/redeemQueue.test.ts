import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RedeemQueue } from './redeemQueue.ts';
import type { KeyValueStorage, Redeem } from './redeemQueue.ts';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

test('enqueue stores a ticket once', () => {
  const queue = new RedeemQueue(memoryStorage(), async () => ({ valid: true, reason: 'OK' }));
  assert.equal(queue.enqueue('qr-1'), true);
  assert.equal(queue.enqueue('qr-1'), false);
  assert.deepEqual(queue.pending(), ['qr-1']);
});

test('queue survives being re-created over the same storage', () => {
  const storage = memoryStorage();
  new RedeemQueue(storage, async () => ({ valid: true, reason: 'OK' })).enqueue('qr-1');
  const again = new RedeemQueue(storage, async () => ({ valid: true, reason: 'OK' }));
  assert.deepEqual(again.pending(), ['qr-1']);
});

test('flush redeems everything in order and empties the queue', async () => {
  const seen: string[] = [];
  const redeem: Redeem = async (qr) => {
    seen.push(qr);
    return { valid: true, reason: 'OK' };
  };
  const queue = new RedeemQueue(memoryStorage(), redeem);
  queue.enqueue('qr-1');
  queue.enqueue('qr-2');

  const outcomes = await queue.flush();

  assert.deepEqual(seen, ['qr-1', 'qr-2']);
  assert.deepEqual(outcomes, [
    { qrCode: 'qr-1', valid: true, reason: 'OK' },
    { qrCode: 'qr-2', valid: true, reason: 'OK' },
  ]);
  assert.deepEqual(queue.pending(), []);
});

test('a server "invalid" answer is an outcome, not a retry', async () => {
  const queue = new RedeemQueue(memoryStorage(), async () => ({ valid: false, reason: 'Ticket already used' }));
  queue.enqueue('qr-1');

  const outcomes = await queue.flush();

  assert.deepEqual(outcomes, [{ qrCode: 'qr-1', valid: false, reason: 'Ticket already used' }]);
  assert.deepEqual(queue.pending(), []);
});

test('flush stops at the first unreachable-server error and keeps the rest', async () => {
  let calls = 0;
  const redeem: Redeem = async () => {
    calls++;
    if (calls === 2) throw new Error('network down');
    return { valid: true, reason: 'OK' };
  };
  const queue = new RedeemQueue(memoryStorage(), redeem);
  queue.enqueue('qr-1');
  queue.enqueue('qr-2');
  queue.enqueue('qr-3');

  const outcomes = await queue.flush();

  assert.deepEqual(outcomes.map((o) => o.qrCode), ['qr-1']);
  assert.deepEqual(queue.pending(), ['qr-2', 'qr-3']);
  assert.equal(calls, 2);
});

test('corrupt stored data is treated as an empty queue', () => {
  const queue = new RedeemQueue(
    memoryStorage({ transitlk_redeem_queue: '{not json' }),
    async () => ({ valid: true, reason: 'OK' }),
  );
  assert.deepEqual(queue.pending(), []);
  assert.equal(queue.enqueue('qr-1'), true);
});
