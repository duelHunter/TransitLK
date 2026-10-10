import { Pressable, Text, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../auth/AuthContext';
import { useNotifications } from '../../notifications/NotificationsProvider';
import { ToastHost } from '../../ui/Toast';
import { colors } from '../../ui/theme';

export default function TabsLayout() {
  const { user, ready, logout } = useAuth();
  const { unread } = useNotifications();
  if (!ready) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarIconStyle: { display: 'none' },
          tabBarLabelStyle: { fontSize: 14, marginBottom: 12 },
          tabBarActiveTintColor: colors.primary,
          headerRight: () => (
            <Pressable onPress={logout} style={{ marginRight: 16 }}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Logout</Text>
            </Pressable>
          ),
        }}
      >
        <Tabs.Screen name="book" options={{ title: 'Book' }} />
        <Tabs.Screen name="tickets" options={{ title: 'My Tickets' }} />
        <Tabs.Screen name="notifications" options={{ title: 'Alerts', tabBarBadge: unread > 0 ? unread : undefined }} />
      </Tabs>
      <ToastHost />
    </View>
  );
}
