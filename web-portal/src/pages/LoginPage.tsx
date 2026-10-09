import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { isAxiosError } from 'axios';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(emailOrPhone, password);
      navigate('/search');
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.message ?? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card auth-card">
      <h1>Login</h1>
      <form onSubmit={onSubmit}>
        <label>
          Email or phone
          <input value={emailOrPhone} onChange={(e) => setEmailOrPhone(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
