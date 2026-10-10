import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { errorMessage } from '../api/errors';
import type { RegulatorAnalytics } from '../api/types';
import { formatDelay, formatMoney, formatPercent } from '../lib/format';

export function RegulatorPage() {
  const [data, setData] = useState<RegulatorAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<RegulatorAnalytics>('/api/regulator/analytics')
      .then(({ data }) => setData(data))
      .catch((err) => setError(errorMessage(err, 'Failed to load analytics')));
  }, []);

  return (
    <div className="card">
      <h1>Regulator Analytics</h1>
      <p className="hint">
        Aggregated service data across all operators, for route licensing and subsidy decisions.
        Punctuality is the average gap between scheduled and actual departure.
      </p>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <div className="stat-row">
            <div className="stat">
              <span>Trips</span>
              <strong>{data.totalTrips}</strong>
            </div>
            <div className="stat">
              <span>Tickets sold</span>
              <strong>{data.totalTicketsSold}</strong>
            </div>
            <div className="stat">
              <span>Revenue</span>
              <strong>{formatMoney(data.totalRevenue)}</strong>
            </div>
          </div>

          {data.routes.length === 0 ? (
            <p className="empty">No service data yet.</p>
          ) : (
            <table className="trip-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Operator</th>
                  <th>Trips</th>
                  <th>Cancelled</th>
                  <th>Tickets</th>
                  <th>Avg occupancy</th>
                  <th>Avg delay</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.routes.map((r) => (
                  <tr key={`${r.routeName}-${r.operatorId ?? 'none'}`}>
                    <td>{r.routeName}</td>
                    <td>{r.operatorId ? r.operatorId.slice(-4) : '-'}</td>
                    <td>{r.trips}</td>
                    <td>{r.cancelledTrips}</td>
                    <td>{r.ticketsSold}</td>
                    <td>{formatPercent(r.avgOccupancy)}</td>
                    <td>{formatDelay(r.avgDelayMinutes)}</td>
                    <td>{formatMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
