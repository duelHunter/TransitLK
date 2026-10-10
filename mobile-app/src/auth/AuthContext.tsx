import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, setAuthToken } from '../api/client';
import type { AuthResponse, UserResponse } from '../api/types';

const TOKEN_KEY = 'transitlk_token';
const USER_KEY = 'transitlk_user';

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface AuthContextValue {
  user: UserResponse | null;
  ready: boolean;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<string>;
  verifyOtp: (emailOrPhone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [token, rawUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (token && rawUser) {
          setAuthToken(token);
          setUser(JSON.parse(rawUser) as UserResponse);
        }
      } catch {
        // unreadable secure storage: start signed out
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (auth: AuthResponse) => {
    setAuthToken(auth.token);
    await SecureStore.setItemAsync(TOKEN_KEY, auth.token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(auth.user));
    setUser(auth.user);
  }, []);

  const login = useCallback(
    async (emailOrPhone: string, password: string) => {
      const { data } = await api.post<AuthResponse>('/api/auth/login', { emailOrPhone, password });
      await persist(data);
    },
    [persist],
  );

  const register = useCallback(async (payload: RegisterData) => {
    const { data } = await api.post<{ message: string }>('/api/auth/register', { ...payload, role: 'PASSENGER' });
    return data.message;
  }, []);

  const verifyOtp = useCallback(
    async (emailOrPhone: string, otp: string) => {
      const { data } = await api.post<AuthResponse>('/api/auth/otp/verify', { emailOrPhone, otp });
      await persist(data);
    },
    [persist],
  );

  const logout = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    await SecureStore.deleteItemAsync(USER_KEY).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, verifyOtp, logout }),
    [user, ready, login, register, verifyOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
