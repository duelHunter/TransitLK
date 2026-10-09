import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../auth/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'PASSENGER',
    licenseNo: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      navigate('/verify-otp', { state: { emailOrPhone: form.email } });
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.message ?? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card auth-card">
      <h1>Register</h1>
      <form onSubmit={onSubmit}>
        <label>
          Full name
          <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            required
          />
        </label>
        <label>
          Role
          <select value={form.role} onChange={(e) => update('role', e.target.value)}>
            <option value="PASSENGER">Passenger</option>
            <option value="CONDUCTOR">Conductor</option>
            <option value="OPERATOR">Fleet Operator</option>
          </select>
        </label>
        {form.role === 'OPERATOR' && (
          <label>
            License No.
            <input value={form.licenseNo} onChange={(e) => update('licenseNo', e.target.value)} />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
    </div>
  );
}
