import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import L from 'leaflet';
import { apiClient, TRACKING_WS_URL } from '../api/client';
import { errorMessage } from '../api/errors';
import type { LiveVehicle } from '../api/types';
import 'leaflet/dist/leaflet.css';

// Default Leaflet marker icons reference bundled asset URLs that don't survive
// Vite's bundling; point them at the CDN copies instead.
const vehicleIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const SRI_LANKA_CENTER: [number, number] = [7.5, 80.5];

export function LiveMapPage() {
  const [vehicles, setVehicles] = useState<Record<string, LiveVehicle>>({});
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    apiClient
      .get<LiveVehicle[]>('/api/vehicles')
      .then(({ data }) => {
        const map: Record<string, LiveVehicle> = {};
        for (const v of data) map[v.vehicleReg] = v;
        setVehicles(map);
      })
      .catch((err) => setError(errorMessage(err, 'Could not load vehicles')));

    // The tracking service only streams the fleet to staff tokens, so the handshake carries the JWT.
    const token = localStorage.getItem('transitlk_token');
    const socket = io(TRACKING_WS_URL, { transports: ['websocket', 'polling'], auth: { token } });
    socketRef.current = socket;
    socket.on('location:update', (payload: LiveVehicle) => {
      setVehicles((prev) => ({ ...prev, [payload.vehicleReg]: payload }));
    });
    socket.on('error', (message: unknown) => setError(`Live feed refused: ${String(message)}`));

    return () => {
      socket.disconnect();
    };
  }, []);

  const list = Object.values(vehicles);

  return (
    <div className="card map-card">
      <h1>Live Vehicle Map</h1>
      {error && <p className="error">{error}</p>}
      <p className="hint">
        Staff fleet view. {list.length} vehicle{list.length === 1 ? '' : 's'} reporting. Run{' '}
        <code>node services/tracking-service/scripts/simulate-vehicle.js NB-1234</code> to see a
        vehicle move.
      </p>
      <MapContainer center={SRI_LANKA_CENTER} zoom={8} style={{ height: '520px', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {list.map((v) => (
          <Marker key={v.vehicleReg} position={[v.lat, v.lon]} icon={vehicleIcon}>
            <Popup>
              <strong>{v.vehicleReg}</strong>
              <br />
              Speed: {v.speedKmh.toFixed(0)} km/h
              <br />
              Updated: {new Date(v.timestamp).toLocaleTimeString()}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
