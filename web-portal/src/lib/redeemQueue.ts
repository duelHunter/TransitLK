export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RedeemOutcome {
  qrCode: string;
  valid: boolean;
  reason: string;
}

/** Must throw when the server is unreachable; must return for any real answer, including "invalid". */
export type Redeem = (qrCode: string) => Promise<{ valid: boolean; reason: string }>;

const STORAGE_KEY = 'transitlk_redeem_queue';

/**
 * Tickets accepted while offline (signature valid) wait here until the server can record
 * the single-use redemption. Persisted so a page reload does not lose accepted boardings.
 */
export class RedeemQueue {
  private storage: KeyValueStorage;
  private redeem: Redeem;

  constructor(storage: KeyValueStorage, redeem: Redeem) {
    this.storage = storage;
    this.redeem = redeem;
  }

  pending(): string[] {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  enqueue(qrCode: string): boolean {
    const items = this.pending();
    if (items.includes(qrCode)) {
      return false;
    }
    this.save([...items, qrCode]);
    return true;
  }

  async flush(): Promise<RedeemOutcome[]> {
    const outcomes: RedeemOutcome[] = [];
    let items = this.pending();
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
      this.save(items);
    }
    return outcomes;
  }

  private save(items: string[]) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}
