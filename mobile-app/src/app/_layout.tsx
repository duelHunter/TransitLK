import { useEffect } from 'react';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { shouldRedirectToLogin } from '../lib/authGate';
import { NotificationsProvider } from '../notifications/NotificationsProvider';

/** Sends a signed-out user (e.g. after the session expired) to sign in, from any screen. */
function AuthGate() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const firstSegment = segments[0] as string | undefined;

  useEffect(() => {
    if (!navigationState?.key) return; // navigator not mounted yet
    if (shouldRedirectToLogin(ready, user !== null, firstSegment)) {
      router.replace('/(auth)/login');
    }
  }, [navigationState?.key, ready, user, firstSegment, router]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="track/[ticketId]" options={{ headerShown: true, title: 'Track your bus' }} />
        </Stack>
        <AuthGate />
      </NotificationsProvider>
    </AuthProvider>
  );
}
