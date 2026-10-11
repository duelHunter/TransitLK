export interface AsyncKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface RedeemOutcome {
  qrCode: string;
  valid: boolean;
  reason: string;
}

/** Must throw when the server is unreachable; must return for any real answer, including "invalid". */
export type Redeem = (qrCode: string) => Promise<{ valid: boolean; reason: string }>;

const STORAGE_KEY = 'transitlk_conductor_redeem_queue';

/**
 * Tickets accepted while offline (signature valid) wait here until the server can record the
 * single-use redemption. Persisted so closing the app does not lose accepted boardings.
 */
export class RedeemQueue {
  private storage: AsyncKeyValueStorage;
  private redeem: Redeem;

  constructor(storage: AsyncKeyValueStorage, redeem: Redeem) {
    this.storage = storage;
    this.redeem = redeem;
  }

  async pending(): Promise<string[]> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  /** False when this ticket is already waiting (a ticket can only board once). */
  async enqueue(qrCode: string): Promise<boolean> {
    const items = await this.pending();
    if (items.includes(qrCode)) {
      return false;
    }
    await this.save([...items, qrCode]);
    return true;
  }

  async flush(): Promise<RedeemOutcome[]> {
    const outcomes: RedeemOutcome[] = [];
    let items = await this.pending();
    while (items.length > 0) {
      const qrCode = items[0];
      let result: { valid: boolean; reason: string };
      try {
        result = await this.redeem(qrCode);
      } catch {
        break; // still offline: keep this and the remaining items queued
      }
      outcomes.push({ qrCode, valid: result.valid, reason: result.reason });
      items = items.slice(1);
      await this.save(items);
    }
    return outcomes;
  }

  private async save(items: string[]): Promise<void> {
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}
