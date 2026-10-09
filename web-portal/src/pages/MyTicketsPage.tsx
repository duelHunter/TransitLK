import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { apiClient } from '../api/client';
import type { TicketResponse } from '../api/types';

export function MyTicketsPage() {
  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<TicketResponse[]>('/api/tickets/mine');
      setTickets(data);
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.message ?? err.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCancel(ticketId: string) {
    try {
      await apiClient.post(`/api/tickets/${ticketId}/cancel`);
      await load();
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.message ?? err.message : 'Cancel failed');
    }
  }

  if (loading) return <div className="card">Loading tickets...</div>;

  return (
    <div className="card">
      <h1>My Tickets</h1>
      {error && <p className="error">{error}</p>}
      <div className="ticket-grid">
        {tickets.map((t) => (
          <div className="ticket-card" key={t.ticketId}>
            <div className="ticket-info">
              <h3>
                {t.origin} &rarr; {t.destination}
              </h3>
              <p>{t.routeName}</p>
              <p>Departure: {new Date(t.departureTime).toLocaleString()}</p>
              <p>Seat: {t.seatNo ?? 'Unassigned'}</p>
              <p>Fare: Rs. {t.fare.toFixed(2)}</p>
              <p>
                Status: <span className={`status status-${t.status.toLowerCase()}`}>{t.status}</span>
              </p>
              {t.status === 'ISSUED' && <button onClick={() => onCancel(t.ticketId)}>Cancel</button>}
            </div>
            <img
              className="qr-image"
              src={`data:image/png;base64,${t.qrImageBase64}`}
              alt={`QR code for ticket ${t.ticketId}`}
            />
          </div>
        ))}
        {tickets.length === 0 && <p className="empty">No tickets yet - book one from Search &amp; Book.</p>}
      </div>
    </div>
  );
}
