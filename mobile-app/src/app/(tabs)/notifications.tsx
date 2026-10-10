import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateTime } from '../../lib/format';
import { useNotifications } from '../../notifications/NotificationsProvider';
import { Card, HintText, Screen } from '../../ui/components';
import { colors } from '../../ui/theme';

export default function NotificationsScreen() {
  const { items, markSeen } = useNotifications();

  return (
    <Screen>
      {items.length === 0 && <HintText>No notifications yet. Booking and trip updates appear here.</HintText>}
      {items.map((n) => (
        <Pressable key={n.notificationId} onPress={() => !n.seen && markSeen(n.notificationId)}>
          <Card>
            <View style={styles.row}>
              {!n.seen && <View style={styles.dot} />}
              <Text style={[styles.title, !n.seen && { color: colors.text }]}>{n.title}</Text>
            </View>
            <Text>{n.message}</Text>
            <Text style={{ color: colors.muted }}>{formatDateTime(n.createdAt)}</Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  title: { fontWeight: '700', fontSize: 16, color: colors.muted },
});
