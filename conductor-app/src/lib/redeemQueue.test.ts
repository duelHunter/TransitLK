import { RedeemQueue } from './redeemQueue';
import type { AsyncKeyValueStorage, Redeem } from './redeemQueue';

function memoryStorage(initial: Record<string, string> = {}): AsyncKeyValueStorage {
  const data = { ...initial };
  return {
    getItem: async (key) => (key in data ? data[key] : null),
    setItem: async (key, value) => {
      data[key] = value;
    },
  };
}

const ok: Redeem = async () => ({ valid: true, reason: 'OK' });

describe('RedeemQueue', () => {
  it('enqueue stores a ticket once', async () => {
    const queue = new RedeemQueue(memoryStorage(), ok);
    expect(await queue.enqueue('qr-1')).toBe(true);
    expect(await queue.enqueue('qr-1')).toBe(false);
    expect(await queue.pending()).toEqual(['qr-1']);
  });

  it('survives being re-created over the same storage', async () => {
    const storage = memoryStorage();
    await new RedeemQueue(storage, ok).enqueue('qr-1');
    expect(await new RedeemQueue(storage, ok).pending()).toEqual(['qr-1']);
  });

  it('flush redeems everything in order and empties the queue', async () => {
    const seen: string[] = [];
    const redeem: Redeem = async (qr) => {
      seen.push(qr);
      return { valid: true, reason: 'OK' };
    };
    const queue = new RedeemQueue(memoryStorage(), redeem);
    await queue.enqueue('qr-1');
    await queue.enqueue('qr-2');

    const outcomes = await queue.flush();

    expect(seen).toEqual(['qr-1', 'qr-2']);
    expect(outcomes).toEqual([
      { qrCode: 'qr-1', valid: true, reason: 'OK' },
      { qrCode: 'qr-2', valid: true, reason: 'OK' },
    ]);
    expect(await queue.pending()).toEqual([]);
  });

  it('a server "invalid" answer is an outcome, not a retry', async () => {
    const queue = new RedeemQueue(memoryStorage(), async () => ({ valid: false, reason: 'Ticket already used' }));
    await queue.enqueue('qr-1');

    expect(await queue.flush()).toEqual([{ qrCode: 'qr-1', valid: false, reason: 'Ticket already used' }]);
    expect(await queue.pending()).toEqual([]);
  });

  it('flush stops at the first unreachable-server error and keeps the rest', async () => {
    let calls = 0;
    const redeem: Redeem = async () => {
      calls++;
      if (calls === 2) throw new Error('network down');
      return { valid: true, reason: 'OK' };
    };
    const queue = new RedeemQueue(memoryStorage(), redeem);
    await queue.enqueue('qr-1');
    await queue.enqueue('qr-2');
    await queue.enqueue('qr-3');

    const outcomes = await queue.flush();

    expect(outcomes.map((o) => o.qrCode)).toEqual(['qr-1']);
    expect(await queue.pending()).toEqual(['qr-2', 'qr-3']);
    expect(calls).toBe(2);
  });

  it('treats corrupt stored data as an empty queue', async () => {
    const queue = new RedeemQueue(memoryStorage({ transitlk_conductor_redeem_queue: '{not json' }), ok);
    expect(await queue.pending()).toEqual([]);
    expect(await queue.enqueue('qr-1')).toBe(true);
  });
});
