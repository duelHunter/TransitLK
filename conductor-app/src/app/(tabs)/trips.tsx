import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../api/client';
import { errorMessage } from '../../api/errors';
import type { ManifestEntry, TripDto, TripReconciliation } from '../../api/types';
import { formatDateTime, seatsSold } from '../../lib/format';
import { Card, ErrorText, HintText, PrimaryButton } from '../../ui/components';
import { colors } from '../../ui/theme';

export default function TripsScreen() {
  const [trips, setTrips] = useState<TripDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manifestFor, setManifestFor] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ongoing, scheduled] = await Promise.all([
        api.get<TripDto[]>('/api/trips', { params: { status: 'ONGOING' } }),
        api.get<TripDto[]>('/api/trips', { params: { status: 'SCHEDULED' } }),
      ]);
      setTrips([...ongoing.data, ...scheduled.data]);
    } catch (err) {
      setError(errorMessage(err, 'Could not load trips'));
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

  async function act(trip: TripDto, action: 'start' | 'complete') {
    setBusyId(trip.tripId);
    setError(null);
    setNotice(null);
    try {
      const { data } = await api.post(`/api/trips/${trip.tripId}/${action}`);
      if (action === 'complete') {
        const r = data as TripReconciliation;
        setNotice(
          `${r.trip.vehicleReg} completed: ${r.ticketsIssued} tickets, ${r.ticketsValidated} validated, ` +
            `${r.ticketsIssued - r.ticketsValidated} not validated.`,
        );
      } else {
        setNotice(`${trip.vehicleReg} started. Passengers have been notified.`);
      }
      await load();
    } catch (err) {
      setError(errorMessage(err, `Could not ${action} the trip`));
    } finally {
      setBusyId(null);
    }
  }

  async function togglePassengers(tripId: string) {
    if (manifestFor === tripId) {
      setManifestFor(null);
      return;
    }
    try {
      const { data } = await api.get<ManifestEntry[]>(`/api/trips/${tripId}/tickets`);
      setManifest(data);
      setManifestFor(tripId);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the passenger list'));
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ErrorText message={error} />
      {notice && <Text style={{ color: colors.success }}>{notice}</Text>}
      {loaded && trips.length === 0 && !error && <HintText>No scheduled or ongoing trips.</HintText>}

      {trips.map((t) => (
        <Card key={t.tripId}>
          <View style={styles.row}>
            <Text style={styles.title}>{t.routeName}</Text>
            <Text style={[styles.status, t.status === 'ONGOING' && { color: colors.success }]}>{t.status}</Text>
          </View>
          <Text>
            Bus {t.vehicleReg} - departs {formatDateTime(t.departureTime)}
          </Text>
          <Text>{seatsSold(t.totalSeats, t.availableSeats)}</Text>

          {t.status === 'SCHEDULED' && (
            <PrimaryButton title="Start trip" onPress={() => act(t, 'start')} loading={busyId === t.tripId} />
          )}
          {t.status === 'ONGOING' && (
            <PrimaryButton title="Complete trip" onPress={() => act(t, 'complete')} loading={busyId === t.tripId} />
          )}
          <PrimaryButton
            title={manifestFor === t.tripId ? 'Hide passengers' : 'Passengers'}
            onPress={() => togglePassengers(t.tripId)}
            secondary
          />

          {manifestFor === t.tripId &&
            (manifest.length === 0 ? (
              <HintText>No tickets sold yet.</HintText>
            ) : (
              manifest.map((m) => (
                <Text key={m.ticketId}>
                  Seat {m.seatNo ?? '-'} - {m.status === 'VALIDATED' ? 'boarded' : m.status.toLowerCase()}
                </Text>
              ))
            ))}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', fontSize: 16, flexShrink: 1 },
  status: { fontWeight: '700', color: colors.muted },
});
