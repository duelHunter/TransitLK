import { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../api/client';
import { errorMessage } from '../../api/errors';
import type { TicketResponse } from '../../api/types';
import { canTrack, formatDateTime, formatMoney, statusLabel } from '../../lib/format';
import { Card, ErrorText, HintText, PrimaryButton } from '../../ui/components';
import { colors } from '../../ui/theme';

export default function TicketsScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.get<TicketResponse[]>('/api/tickets/mine');
      setTickets(data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your tickets'));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ErrorText message={error} />
      {loaded && tickets.length === 0 && !error && <HintText>No tickets yet. Book a trip first.</HintText>}
      {tickets.map((t) => (
        <Card key={t.ticketId}>
          <View style={styles.row}>
            <Text style={styles.title}>{t.routeName}</Text>
            <Text style={[styles.status, t.status === 'ISSUED' && { color: colors.success }]}>
              {statusLabel(t.status)}
            </Text>
          </View>
          <Text>
            {t.origin} to {t.destination}
          </Text>
          <Text>Departs {formatDateTime(t.departureTime)}</Text>
          <Text>
            Seat {t.seatNo ?? '-'} - {formatMoney(t.fare)}
          </Text>
          <Image source={{ uri: `data:image/png;base64,${t.qrImageBase64}` }} style={styles.qr} resizeMode="contain" />
          {canTrack(t.status) && (
            <PrimaryButton title="Track bus" onPress={() => router.push(`/track/${t.ticketId}`)} />
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', fontSize: 16, flexShrink: 1 },
  status: { fontWeight: '700', color: colors.muted },
  qr: { width: 200, height: 200, alignSelf: 'center', marginVertical: 8 },
});
