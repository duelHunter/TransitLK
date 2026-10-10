import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { freshUnseen, unreadCount } from '../lib/notifications';
import type { AppNotification } from '../lib/notifications';

const POLL_MS = 5000;

interface NotificationsValue {
  items: AppNotification[];
  unread: number;
  toast: AppNotification | null;
  dismissToast: () => void;
  markSeen: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const known = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setToast(null);
      known.current = new Set();
      seeded.current = false;
      return;
    }

    let cancelled = false;
    async function poll() {
      try {
        const { data } = await api.get<AppNotification[]>('/api/notifications');
        if (cancelled) return;
        setItems(data);
        if (!seeded.current) {
          // First fetch only seeds what already exists so old notifications do not pop up.
          data.forEach((n) => known.current.add(n.notificationId));
          seeded.current = true;
          return;
        }
        const fresh = freshUnseen(known.current, data);
        if (fresh.length > 0) {
          fresh.forEach((n) => known.current.add(n.notificationId));
          setToast(fresh[fresh.length - 1]);
        }
      } catch {
        // transient network error: try again on the next tick
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

  const markSeen = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.notificationId === id ? { ...n, seen: true } : n)));
    try {
      await api.post(`/api/notifications/${id}/read`);
    } catch {
      // the next poll restores the true state
    }
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const value = useMemo(
    () => ({ items, unread: unreadCount(items), toast, dismissToast, markSeen }),
    [items, toast, dismissToast, markSeen],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
