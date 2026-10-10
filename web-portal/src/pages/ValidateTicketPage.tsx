import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { apiClient } from '../api/client';
import { errorMessage } from '../api/errors';
import type { ValidationResult } from '../api/types';
import { RedeemQueue } from '../lib/redeemQueue';
import type { RedeemOutcome } from '../lib/redeemQueue';
import { verifyTicketSignature } from '../lib/ticketSignature';

const SIGNING_SECRET = import.meta.env.VITE_TICKET_SIGNING_SECRET as string | undefined;

/** True when the request never got a real answer (no response, or the server itself failed). */
function isUnreachable(err: unknown): boolean {
  return isAxiosError(err) && (!err.response || err.response.status >= 500);
}

async function redeemOnline(qrCode: string): Promise<{ valid: boolean; reason: string }> {
  try {
    const { data } = await apiClient.post<ValidationResult>('/api/tickets/validate', { qrCode });
    return { valid: data.valid, reason: data.reason };
  } catch (err) {
    if (isAxiosError(err) && err.response && err.response.status < 500 && err.response.status !== 401) {
      return { valid: false, reason: err.response.data?.message ?? err.message };
    }
    throw err; // unreachable or session expired: keep the ticket queued
  }
}

export function ValidateTicketPage() {
  const queue = useMemo(() => new RedeemQueue(localStorage, redeemOnline), []);
  const [qrCode, setQrCode] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forceOffline, setForceOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(queue.pending().length);
  const [synced, setSynced] = useState<RedeemOutcome[]>([]);

  useEffect(() => {
    if (forceOffline) return;
    let cancelled = false;
    async function sync() {
      const outcomes = await queue.flush();
      if (cancelled) return;
      if (outcomes.length > 0) setSynced((prev) => [...outcomes, ...prev]);
      setPendingCount(queue.pending().length);
    }
    sync();
    const timer = setInterval(sync, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [forceOffline, queue]);

  async function acceptOffline(ticket: string) {
    const check = SIGNING_SECRET
      ? await verifyTicketSignature(ticket, SIGNING_SECRET)
      : { ok: false, reason: 'Offline verification is not configured', ticketId: undefined };
    if (!check.ok) {
      setResult({ valid: false, reason: check.reason, ticketId: null, seatNo: null, validatedAt: null });
      return;
    }
    if (!queue.enqueue(ticket)) {
      setResult({
        valid: false,
        reason: 'Already scanned on this device',
        ticketId: check.ticketId ?? null,
        seatNo: null,
        validatedAt: null,
      });
      return;
    }
    setPendingCount(queue.pending().length);
    setResult({
      valid: true,
      reason: 'Signature valid - accepted offline, will sync when connected',
      ticketId: check.ticketId ?? null,
      seatNo: null,
      validatedAt: null,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    const ticket = qrCode.trim();
    try {
      if (!forceOffline) {
        try {
          const { data } = await apiClient.post<ValidationResult>('/api/tickets/validate', { qrCode: ticket });
          setResult(data);
          return;
        } catch (err) {
          if (!isUnreachable(err)) {
            setError(errorMessage(err, 'Validation request failed'));
            return;
          }
        }
      }
      await acceptOffline(ticket);
    } finally {
      setLoading(false);
      setQrCode('');
    }
  }

  return (
    <div className="card">
      <h1>Validate Ticket</h1>
      <p className="hint">
        Paste the raw QR payload (the signed token) from a passenger's ticket. A real conductor
        app would scan the QR image and extract this text automatically via the device camera.
        If the server cannot be reached, the signature is checked on this device and the boarding
        is recorded when the connection returns.
      </p>
      <label className="inline-check">
        <input type="checkbox" checked={forceOffline} onChange={(e) => setForceOffline(e.target.checked)} />
        Simulate offline (no server contact)
      </label>
      <form onSubmit={onSubmit}>
        <label>
          QR payload
          <textarea rows={4} value={qrCode} onChange={(e) => setQrCode(e.target.value)} required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Validating...' : 'Validate'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {result && (
        <div className={`validation-result ${result.valid ? 'valid' : 'invalid'}`}>
          <h2>{result.valid ? 'VALID - Boarding allowed' : 'INVALID'}</h2>
          <p>{result.reason}</p>
          {result.seatNo != null && <p>Seat: {result.seatNo}</p>}
        </div>
      )}

      {pendingCount > 0 && (
        <p className="hint">
          {pendingCount} offline boarding{pendingCount === 1 ? '' : 's'} waiting to sync.
        </p>
      )}
      {synced.map((s) => (
        <p key={s.qrCode} className={s.valid ? 'success' : 'error'}>
          Synced: {s.valid ? 'recorded' : `rejected - ${s.reason}`}
        </p>
      ))}
    </div>
  );
}
