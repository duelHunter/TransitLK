import { useState } from 'react';
import type { FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { apiClient } from '../api/client';
import type { TripSearchResult } from '../api/types';
import { useAuth } from '../auth/AuthContext';

export function SearchBookPage() {
  const { user } = useAuth();
  const [origin, setOrigin] = useState('Colombo');
  const [destination, setDestination] = useState('Kandy');
  const [results, setResults] = useState<TripSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [bookingTripId, setBookingTripId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSearching(true);
    try {
      const { data } = await apiClient.get<TripSearchResult[]>('/api/routes/search', {
        params: { origin, destination },
      });
      setResults(data);
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.message ?? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function onBook(tripId: string) {
    if (!user) {
      setError('Please login to book a ticket.');
      return;
    }
    setBookingTripId(tripId);
    setError(null);
    setMessage(null);
    try {
      const { data } = await apiClient.post('/api/bookings', {
        tripId,
        paymentMethod: 'CARD',
      });
      setMessage(`Ticket booked! Seat: ${data.seatNo ?? 'unassigned'} - fare Rs. ${data.fare}`);
      setResults((rs) => rs.map((r) => (r.tripId === tripId ? { ...r, availableSeats: r.availableSeats - 1 } : r)));
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.message ?? err.message : 'Booking failed');
    } finally {
      setBookingTripId(null);
    }
  }

  return (
    <div className="card">
      <h1>Search &amp; Book</h1>
      <form className="search-form" onSubmit={onSearch}>
        <label>
          Origin
          <input value={origin} onChange={(e) => setOrigin(e.target.value)} required />
        </label>
        <label>
          Destination
          <input value={destination} onChange={(e) => setDestination(e.target.value)} required />
        </label>
        <button type="submit" disabled={searching}>
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <table className="trip-table">
        <thead>
          <tr>
            <th>Route</th>
            <th>Vehicle</th>
            <th>Departure</th>
            <th>Arrival</th>
            <th>Fare (Rs.)</th>
            <th>Seats</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {results.map((trip) => (
            <tr key={trip.tripId}>
              <td>{trip.routeName}</td>
              <td>{trip.vehicleReg}</td>
              <td>{new Date(trip.departureTime).toLocaleString()}</td>
              <td>{new Date(trip.arrivalTime).toLocaleString()}</td>
              <td>{trip.fare.toFixed(2)}</td>
              <td>
                {trip.availableSeats} / {trip.totalSeats}
              </td>
              <td>
                <button
                  onClick={() => onBook(trip.tripId)}
                  disabled={trip.availableSeats <= 0 || bookingTripId === trip.tripId}
                >
                  {bookingTripId === trip.tripId ? 'Booking...' : 'Book'}
                </button>
              </td>
            </tr>
          ))}
          {results.length === 0 && !searching && (
            <tr>
              <td colSpan={7} className="empty">
                No results yet - search a route above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
