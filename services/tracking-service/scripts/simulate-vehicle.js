/**
 * Simple GPS simulator for local demos: POSTs a moving vehicle position to the
 * tracking-service REST telemetry endpoint every few seconds (FR3: every 5-10s).
 *
 * Usage: node scripts/simulate-vehicle.js NB-1234
 */
const reg = process.argv[2] || 'NB-1234';
const baseUrl = process.env.TRACKING_URL || 'http://localhost:8083';

let lat = 6.9271; // Colombo
let lon = 79.8612;
const destLat = 7.2906; // Kandy
const destLon = 80.6337;

async function tick() {
  const steps = 200;
  lat += (destLat - lat) / steps;
  lon += (destLon - lon) / steps;

  const body = {
    vehicleReg: reg,
    lat,
    lon,
    speedKmh: 45 + Math.random() * 15,
    heading: 45,
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    console.log(`[${reg}] ping sent, status ${res.status} lat=${lat.toFixed(4)} lon=${lon.toFixed(4)}`);
  } catch (err) {
    console.error('Failed to send ping:', err.message);
  }
}

setInterval(tick, 5000);
tick();
