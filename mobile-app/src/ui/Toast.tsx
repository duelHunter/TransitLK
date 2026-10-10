import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useNotifications } from '../notifications/NotificationsProvider';

export function ToastHost() {
  const { toast, dismissToast } = useNotifications();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, 4000);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;
  return (
    <Pressable style={styles.toast} onPress={dismissToast}>
      <Text style={styles.title}>{toast.title}</Text>
      <Text style={styles.message}>{toast.message}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    elevation: 6,
  },
  title: { color: '#fff', fontWeight: '700' },
  message: { color: '#e5e7eb', marginTop: 2 },
});
