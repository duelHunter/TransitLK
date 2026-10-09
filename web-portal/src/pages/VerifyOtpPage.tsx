import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../auth/AuthContext';

export function VerifyOtpPage() {
  const { verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialContact = (location.state as { emailOrPhone?: string } | null)?.emailOrPhone ?? '';

  const [emailOrPhone, setEmailOrPhone] = useState(initialContact);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(emailOrPhone, otp);
      navigate('/search');
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.message ?? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card auth-card">
      <h1>Verify OTP</h1>
      <p className="hint">
        A 6-digit code was generated for your account. In this prototype there is no real SMS
        gateway, so check the <code>user-service</code> logs for the code.
      </p>
      <form onSubmit={onSubmit}>
        <label>
          Email or phone
          <input value={emailOrPhone} onChange={(e) => setEmailOrPhone(e.target.value)} required />
        </label>
        <label>
          OTP code
          <input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </div>
  );
}
