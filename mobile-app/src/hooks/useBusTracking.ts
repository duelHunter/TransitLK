import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { api, trackingApi } from '../api/client';
import { errorMessage } from '../api/errors';
import type { LivePosition, TrackTokenResponse } from '../api/types';
import { TRACKING_URL } from '../config';

export type TrackingState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'live'; vehicleReg: string; position: LivePosition | null };

/** Tracks the one bus a ticket entitles the passenger to watch. */
export function useBusTracking(ticketId: string): TrackingState {
  const [state, setState] = useState<TrackingState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      try {
        const { data: grant } = await api.post<TrackTokenResponse>(`/api/tickets/${ticketId}/track-token`);
        if (cancelled) return;

        let initial: LivePosition | null = null;
        try {
          const res = await trackingApi.get<LivePosition>(`/api/vehicles/${grant.vehicleReg}`, {
            headers: { Authorization: `Bearer ${grant.token}` },
          });
          initial = res.data;
        } catch {
          // no position reported yet: wait for the first live update
        }
        if (cancelled) return;
        setState({ phase: 'live', vehicleReg: grant.vehicleReg, position: initial });

        socket = io(TRACKING_URL, { transports: ['websocket'], auth: { token: grant.token } });
        socket.on('location:update', (p: LivePosition) => {
          if (p.vehicleReg === grant.vehicleReg) {
            setState({ phase: 'live', vehicleReg: grant.vehicleReg, position: p });
          }
        });
        socket.on('error', (message: unknown) => {
          setState({ phase: 'error', message: `Live feed refused: ${String(message)}` });
        });
      } catch (err) {
        if (!cancelled) {
          setState({ phase: 'error', message: errorMessage(err, 'Could not start tracking') });
        }
      }
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [ticketId]);

  return state;
}
