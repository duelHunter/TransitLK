import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../auth/AuthContext';
import { NotificationsProvider } from '../notifications/NotificationsProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="track/[ticketId]" options={{ headerShown: true, title: 'Track your bus' }} />
        </Stack>
      </NotificationsProvider>
    </AuthProvider>
  );
}
