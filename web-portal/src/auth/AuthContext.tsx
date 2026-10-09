import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../api/client';
import type { AuthResponse, UserResponse } from '../api/types';

interface AuthContextValue {
  user: UserResponse | null;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: string;
    licenseNo?: string;
  }) => Promise<string>;
  verifyOtp: (emailOrPhone: string, otp: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredUser(): UserResponse | null {
  const raw = localStorage.getItem('transitlk_user');
  return raw ? (JSON.parse(raw) as UserResponse) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(loadStoredUser());

  const persist = useCallback((auth: AuthResponse) => {
    localStorage.setItem('transitlk_token', auth.token);
    localStorage.setItem('transitlk_user', JSON.stringify(auth.user));
    setUser(auth.user);
  }, []);

  const login = useCallback(
    async (emailOrPhone: string, password: string) => {
      const { data } = await apiClient.post<AuthResponse>('/api/auth/login', { emailOrPhone, password });
      persist(data);
    },
    [persist],
  );

  const register = useCallback(
    async (payload: { name: string; email: string; phone: string; password: string; role: string; licenseNo?: string }) => {
      const { data } = await apiClient.post<{ message: string }>('/api/auth/register', payload);
      return data.message;
    },
    [],
  );

  const verifyOtp = useCallback(
    async (emailOrPhone: string, otp: string) => {
      const { data } = await apiClient.post<AuthResponse>('/api/auth/otp/verify', { emailOrPhone, otp });
      persist(data);
    },
    [persist],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('transitlk_token');
    localStorage.removeItem('transitlk_user');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, login, register, verifyOtp, logout }),
    [user, login, register, verifyOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
