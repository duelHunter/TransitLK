import { useState } from 'react';
import { Text } from 'react-native';
import { api } from '../../api/client';
import { errorMessage } from '../../api/errors';
import type { TripSearchResult } from '../../api/types';
import { formatDateTime, formatMoney } from '../../lib/format';
import { Card, ErrorText, Field, HintText, PrimaryButton, Screen } from '../../ui/components';
import { colors } from '../../ui/theme';

export default function BookScreen() {
  const [origin, setOrigin] = useState('Colombo');
  const [destination, setDestination] = useState('Kandy');
  const [results, setResults] = useState<TripSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSearch() {
    setError(null);
    setMessage(null);
    setSearching(true);
    try {
      const { data } = await api.get<TripSearchResult[]>('/api/routes/search', {
        params: { origin: origin.trim(), destination: destination.trim() },
      });
      setResults(data);
    } catch (err) {
      setError(errorMessage(err, 'Search failed'));
    } finally {
      setSearching(false);
    }
  }

  async function onBook(trip: TripSearchResult) {
    setError(null);
    setMessage(null);
    setBookingId(trip.tripId);
    try {
      await api.post('/api/bookings', { tripId: trip.tripId, paymentMethod: 'CARD' });
      setMessage(`Booked ${trip.routeName} for ${formatMoney(trip.fare)}. Your QR ticket is in My Tickets.`);
      setResults((rs) =>
        rs ? rs.map((r) => (r.tripId === trip.tripId ? { ...r, availableSeats: r.availableSeats - 1 } : r)) : rs,
      );
    } catch (err) {
      setError(errorMessage(err, 'Booking failed'));
    } finally {
      setBookingId(null);
    }
  }

  return (
    <Screen>
      <Card>
        <Field label="From" value={origin} onChangeText={setOrigin} autoCapitalize="words" />
        <Field label="To" value={destination} onChangeText={setDestination} autoCapitalize="words" />
        <PrimaryButton title="Search trips" onPress={onSearch} loading={searching} />
      </Card>

      <ErrorText message={error} />
      {message && <Text style={{ color: colors.success }}>{message}</Text>}

      {results && results.length === 0 && <HintText>No trips found for that route.</HintText>}
      {results?.map((t) => (
        <Card key={t.tripId}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{t.routeName}</Text>
          <Text>
            {t.origin} to {t.destination} - bus {t.vehicleReg}
          </Text>
          <Text>Departs {formatDateTime(t.departureTime)}</Text>
          <Text>
            {formatMoney(t.fare)} - {t.availableSeats} of {t.totalSeats} seats free
          </Text>
          <PrimaryButton
            title="Book (pay by card)"
            onPress={() => onBook(t)}
            loading={bookingId === t.tripId}
            disabled={t.availableSeats <= 0}
          />
        </Card>
      ))}
    </Screen>
  );
}
