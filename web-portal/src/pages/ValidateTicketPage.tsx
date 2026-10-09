import { useState } from 'react';
import type { FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { apiClient } from '../api/client';
import type { ValidationResult } from '../api/types';

export function ValidateTicketPage() {
  const [qrCode, setQrCode] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const { data } = await apiClient.post<ValidationResult>('/api/tickets/validate', { qrCode });
      setResult(data);
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.message ?? err.message : 'Validation request failed');
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
      </p>
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
    </div>
  );
}
