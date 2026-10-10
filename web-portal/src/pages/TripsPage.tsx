import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { errorMessage } from '../api/errors';
import type { ManifestEntry, TripDto, TripReconciliation, TripStatus } from '../api/types';
import { formatDateTime } from '../lib/format';

const FILTERS: Array<TripStatus | 'ALL'> = ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ALL'];

export function TripsPage() {
  const [filter, setFilter] = useState<TripStatus | 'ALL'>('SCHEDULED');
  const [trips, setTrips] = useState<TripDto[]>([]);
  const [completed, setCompleted] = useState<TripReconciliation[]>([]);
  const [manifestTripId, setManifestTripId] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await apiClient.get<TripDto[]>('/api/trips', {
        params: filter === 'ALL' ? {} : { status: filter },
      });
      setTrips(data);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load trips'));
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(trip: TripDto, action: 'start' | 'complete') {
    setBusyId(trip.tripId);
    setError(null);
    try {
      const { data } = await apiClient.post(`/api/trips/${trip.tripId}/${action}`);
      if (action === 'complete') {
        setCompleted((prev) => [data as TripReconciliation, ...prev]);
      }
      await load();
    } catch (err) {
      setError(errorMessage(err, `Could not ${action} the trip`));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleManifest(tripId: string) {
    if (manifestTripId === tripId) {
      setManifestTripId(null);
      return;
    }
    try {
      const { data } = await apiClient.get<ManifestEntry[]>(`/api/trips/${tripId}/tickets`);
      setManifest(data);
      setManifestTripId(tripId);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the manifest'));
    }
  }

  return (
    <div className="card">
      <h1>Trips</h1>
      <p className="hint">Start a trip when the bus departs and complete it at the end of the journey.</p>

      <label>
        Show
        <select value={filter} onChange={(e) => setFilter(e.target.value as TripStatus | 'ALL')}>
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="error">{error}</p>}

      {completed.map((r) => (
        <div key={r.trip.tripId} className="validation-result valid">
          <h2>Trip completed - {r.trip.routeName}</h2>
          <p>
            Tickets issued: {r.ticketsIssued} | validated: {r.ticketsValidated} | not validated:{' '}
            {r.ticketsIssued - r.ticketsValidated}
          </p>
        </div>
      ))}

      {trips.length === 0 ? (
        <p className="empty">No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}trips.</p>
      ) : (
        <table className="trip-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Vehicle</th>
              <th>Departs</th>
              <th>Status</th>
              <th>Seats free</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <Fragment key={t.tripId}>
                <tr>
                  <td>{t.routeName}</td>
                  <td>{t.vehicleReg}</td>
                  <td>{formatDateTime(t.departureTime)}</td>
                  <td>
                    <span className={`status status-${t.status.toLowerCase()}`}>{t.status}</span>
                  </td>
                  <td>
                    {t.availableSeats}/{t.totalSeats}
                  </td>
                  <td className="row-actions">
                    {t.status === 'SCHEDULED' && (
                      <button disabled={busyId === t.tripId} onClick={() => act(t, 'start')}>
                        Start
                      </button>
                    )}
                    {t.status === 'ONGOING' && (
                      <>
                        <Link to="/validate">Validate tickets</Link>
                        <button disabled={busyId === t.tripId} onClick={() => act(t, 'complete')}>
                          Complete
                        </button>
                      </>
                    )}
                    <button className="secondary" onClick={() => toggleManifest(t.tripId)}>
                      {manifestTripId === t.tripId ? 'Hide manifest' : 'Manifest'}
                    </button>
                  </td>
                </tr>
                {manifestTripId === t.tripId && (
                  <tr>
                    <td colSpan={6}>
                      {manifest.length === 0 ? (
                        <span className="empty">No tickets sold yet.</span>
                      ) : (
                        <ul className="manifest">
                          {manifest.map((m) => (
                            <li key={m.ticketId}>
                              Seat {m.seatNo ?? '-'} - {m.status}
                              {m.validatedAt ? ` (validated ${formatDateTime(m.validatedAt)})` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
