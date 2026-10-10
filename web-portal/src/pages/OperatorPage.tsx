import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { errorMessage } from '../api/errors';
import type { CreateTripRequest, OperatorSummary, TripDto } from '../api/types';
import { formatDateTime, formatMoney, formatPercent } from '../lib/format';

interface RouteOption {
  routeId: string;
  routeName: string;
}

// There is no route-list endpoint, so the routes offered are the ones that already have trips.
function routesFrom(trips: TripDto[]): RouteOption[] {
  const byId = new Map<string, RouteOption>();
  for (const t of trips) byId.set(t.routeId, { routeId: t.routeId, routeName: t.routeName });
  return [...byId.values()].sort((a, b) => a.routeName.localeCompare(b.routeName));
}

export function OperatorPage() {
  const [summary, setSummary] = useState<OperatorSummary | null>(null);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ routeId: '', vehicleReg: '', departureTime: '', arrivalTime: '', totalSeats: 40 });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [report, trips] = await Promise.all([
        apiClient.get<OperatorSummary>('/api/operator/reports/summary'),
        apiClient.get<TripDto[]>('/api/trips'),
      ]);
      setSummary(report.data);
      const options = routesFrom(trips.data);
      setRoutes(options);
      setForm((f) => (f.routeId || options.length === 0 ? f : { ...f, routeId: options[0].routeId }));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load the operator report'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const body: CreateTripRequest = {
      routeId: form.routeId,
      vehicleReg: form.vehicleReg,
      departureTime: new Date(form.departureTime).toISOString(),
      arrivalTime: new Date(form.arrivalTime).toISOString(),
      totalSeats: Number(form.totalSeats),
    };
    try {
      await apiClient.post('/api/operator/trips', body);
      setMessage('Trip created.');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not create the trip'));
    }
  }

  async function onCancel(tripId: string) {
    setError(null);
    setMessage(null);
    try {
      await apiClient.post(`/api/operator/trips/${tripId}/cancel`);
      setMessage('Trip cancelled. Passengers with tickets have been notified.');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not cancel the trip'));
    }
  }

  return (
    <div className="card">
      <h1>Operator Dashboard</h1>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      {summary && (
        <>
          <div className="stat-row">
            <div className="stat">
              <span>Revenue</span>
              <strong>{formatMoney(summary.totalRevenue)}</strong>
            </div>
            <div className="stat">
              <span>Tickets sold</span>
              <strong>{summary.totalTicketsSold}</strong>
            </div>
            <div className="stat">
              <span>Trips</span>
              <strong>{summary.trips.length}</strong>
            </div>
          </div>
          <p>
            <Link to="/live-map">Open the live fleet map</Link>
          </p>

          {summary.trips.length === 0 ? (
            <p className="empty">You have no trips yet.</p>
          ) : (
            <table className="trip-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Vehicle</th>
                  <th>Departs</th>
                  <th>Status</th>
                  <th>Sold</th>
                  <th>Occupancy</th>
                  <th>Revenue</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {summary.trips.map((t) => (
                  <tr key={t.tripId}>
                    <td>{t.routeName}</td>
                    <td>{t.vehicleReg}</td>
                    <td>{formatDateTime(t.departureTime)}</td>
                    <td>
                      <span className={`status status-${t.status.toLowerCase()}`}>{t.status}</span>
                    </td>
                    <td>
                      {t.ticketsSold}/{t.totalSeats}
                    </td>
                    <td>{formatPercent(t.occupancy)}</td>
                    <td>{formatMoney(t.revenue)}</td>
                    <td>
                      {t.status === 'SCHEDULED' && (
                        <button className="secondary" onClick={() => onCancel(t.tripId)}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <h2>Schedule a trip</h2>
      <form onSubmit={onCreate}>
        <label>
          Route
          <select value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })} required>
            {routes.map((r) => (
              <option key={r.routeId} value={r.routeId}>
                {r.routeName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vehicle registration
          <input value={form.vehicleReg} onChange={(e) => setForm({ ...form, vehicleReg: e.target.value })} required />
        </label>
        <label>
          Departure
          <input
            type="datetime-local"
            value={form.departureTime}
            onChange={(e) => setForm({ ...form, departureTime: e.target.value })}
            required
          />
        </label>
        <label>
          Arrival
          <input
            type="datetime-local"
            value={form.arrivalTime}
            onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })}
            required
          />
        </label>
        <label>
          Seats
          <input
            type="number"
            min={1}
            value={form.totalSeats}
            onChange={(e) => setForm({ ...form, totalSeats: Number(e.target.value) })}
            required
          />
        </label>
        <button type="submit">Create trip</button>
      </form>
    </div>
  );
}
