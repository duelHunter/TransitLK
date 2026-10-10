// End-to-end check of the backend demo story. Needs the stack from `docker compose up --build`
// on a fresh database (docker compose down -v first). Node 18+.
const API = process.env.API_URL || 'http://localhost:8000';
const TRACKING = process.env.TRACKING_URL || 'http://localhost:8083';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ' ' + detail}`);
  if (!ok) failures++;
};

async function call(base, method, path, token, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, json };
}

async function login(email) {
  const r = await call(API, 'POST', '/api/auth/login', null, { emailOrPhone: email, password: 'demo1234' });
  if (r.status !== 200) throw new Error(`login ${email} failed: ${r.status}`);
  return r.json.token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, tries = 15) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await sleep(1000);
  }
  return null;
}

const passenger = await login('passenger@transitlk.lk');
const conductor = await login('conductor@transitlk.lk');
const operator = await login('operator@transitlk.lk');
const regulator = await login('regulator@transitlk.lk');

const trips = await call(API, 'GET', '/api/trips?status=SCHEDULED', conductor);
check('conductor lists scheduled trips', trips.status === 200 && trips.json.length > 0, JSON.stringify(trips));
const trip = trips.json.find((t) => t.vehicleReg === 'NB-1234');
check(
  'seeded trip NB-1234 is owned by the demo operator',
  trip && trip.operatorId === '00000000-0000-0000-0000-0000000000a1',
);

const booking = await call(API, 'POST', '/api/bookings', passenger, {
  tripId: trip.tripId,
  seatNo: 1,
  paymentMethod: 'CARD',
});
check('passenger books a ticket', booking.status === 200, JSON.stringify(booking));
const ticket = booking.json;

const early = await call(API, 'POST', `/api/tickets/${ticket.ticketId}/track-token`, passenger);
check('track token refused before the trip starts', early.status === 409, String(early.status));

const noAuth = await call(TRACKING, 'GET', '/api/vehicles');
check('fleet list needs a token', noAuth.status === 401, String(noAuth.status));

const started = await call(API, 'POST', `/api/trips/${trip.tripId}/start`, conductor);
check('conductor starts the trip', started.status === 200 && started.json.status === 'ONGOING', JSON.stringify(started));

const track = await call(API, 'POST', `/api/tickets/${ticket.ticketId}/track-token`, passenger);
check('ticket owner gets a track token', track.status === 200 && !!track.json.token, JSON.stringify(track));

await call(TRACKING, 'POST', '/api/telemetry', null, { vehicleReg: 'NB-1234', lat: 6.93, lon: 79.86, speedKmh: 40 });
await call(TRACKING, 'POST', '/api/telemetry', null, { vehicleReg: 'SP-9012', lat: 6.5, lon: 80.0, speedKmh: 40 });
const own = await call(TRACKING, 'GET', '/api/vehicles/NB-1234', track.json.token);
check('track token shows the paid bus', own.status === 200 && own.json.vehicleReg === 'NB-1234', JSON.stringify(own));
const other = await call(TRACKING, 'GET', '/api/vehicles/SP-9012', track.json.token);
check('track token cannot see another bus', other.status === 403, String(other.status));
const fleetAsPassenger = await call(TRACKING, 'GET', '/api/vehicles', track.json.token);
check('track token cannot list the fleet', fleetAsPassenger.status === 403, String(fleetAsPassenger.status));
const fleet = await call(TRACKING, 'GET', '/api/vehicles', operator);
check('operator sees the whole fleet', fleet.status === 200 && fleet.json.length >= 2, JSON.stringify(fleet));

const notes = await waitFor(async () => {
  const r = await call(API, 'GET', '/api/notifications', passenger);
  const titles = (r.json || []).map((n) => n.title);
  return titles.includes('Booking confirmed') &&
    titles.includes('Payment received') &&
    titles.includes('Your bus is on the way')
    ? titles
    : null;
});
check('passenger receives booking, payment and trip-started notifications', !!notes, 'timed out');

const validated = await call(API, 'POST', '/api/tickets/validate', conductor, { qrCode: ticket.qrCode });
check('conductor validates the QR', validated.status === 200 && validated.json.valid === true, JSON.stringify(validated));
const again = await call(API, 'POST', '/api/tickets/validate', conductor, { qrCode: ticket.qrCode });
check('second validation is refused', again.status === 200 && again.json.valid === false, JSON.stringify(again));

const completed = await call(API, 'POST', `/api/trips/${trip.tripId}/complete`, conductor);
check(
  'trip completes with reconciliation 1 issued / 1 validated',
  completed.status === 200 && completed.json.ticketsIssued === 1 && completed.json.ticketsValidated === 1,
  JSON.stringify(completed),
);

const summary = await call(API, 'GET', '/api/operator/reports/summary', operator);
check('operator summary shows revenue', summary.status === 200 && Number(summary.json.totalRevenue) > 0, JSON.stringify(summary));
const notOperator = await call(API, 'GET', '/api/operator/reports/summary', passenger);
check('passenger cannot read the operator report', notOperator.status === 403, String(notOperator.status));

const analytics = await call(API, 'GET', '/api/regulator/analytics', regulator);
check(
  'regulator analytics include punctuality',
  analytics.status === 200 && analytics.json.routes.some((r) => r.avgDelayMinutes !== null),
  JSON.stringify(analytics),
);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
