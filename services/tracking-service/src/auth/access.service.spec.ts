import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as jwt from 'jsonwebtoken';
import { AccessService, bearerToken } from './access.service';

const USER_SECRET = 'user-secret-for-tests-user-secret-for-tests';
const TRACK_SECRET = 'track-secret-for-tests-track-secret-for-tests';

process.env.JWT_SECRET = USER_SECRET;
process.env.TRACKING_TOKEN_SECRET = TRACK_SECRET;

const service = new AccessService();

const trackToken = (reg: string, secret = TRACK_SECRET, expiresIn: string | number = '10m') =>
  jwt.sign({ purpose: 'track', vehicleReg: reg }, secret, {
    algorithm: 'HS256',
    subject: 'ticket-1',
    expiresIn,
  } as jwt.SignOptions);

const userToken = (role: string) =>
  jwt.sign({ role }, USER_SECRET, { algorithm: 'HS256', subject: 'user-1', expiresIn: '10m' });

test('a track token grants access to exactly its vehicle', () => {
  const access = service.authorize(trackToken('NB-1234'));
  assert.deepEqual(access, { kind: 'vehicle', vehicleReg: 'NB-1234' });
  assert.equal(service.canView(access, 'NB-1234'), true);
  assert.equal(service.canView(access, 'SP-9012'), false);
});

test('operator and admin user tokens grant fleet access', () => {
  for (const role of ['OPERATOR', 'ADMIN']) {
    const access = service.authorize(userToken(role));
    assert.deepEqual(access, { kind: 'fleet' });
    assert.equal(service.canView(access, 'ANY-REG'), true);
  }
});

test('passenger and conductor user tokens are rejected', () => {
  for (const role of ['PASSENGER', 'CONDUCTOR']) {
    assert.throws(() => service.authorize(userToken(role)), /Unauthorized|Invalid or insufficient token/);
  }
});

test('missing, forged and expired tokens are rejected', () => {
  assert.throws(() => service.authorize(undefined), /Missing token/);
  assert.throws(() => service.authorize('not-a-jwt'), /Invalid or insufficient token/);
  assert.throws(
    () => service.authorize(trackToken('NB-1234', 'some-other-secret-some-other-secret-xx')),
    /Invalid or insufficient token/,
  );
  assert.throws(() => service.authorize(trackToken('NB-1234', TRACK_SECRET, -60)), /Invalid or insufficient token/);
});

test('a user token without the track purpose cannot be used as a track token', () => {
  const sneaky = jwt.sign({ vehicleReg: 'NB-1234', role: 'PASSENGER' }, USER_SECRET, { algorithm: 'HS256' });
  assert.throws(() => service.authorize(sneaky), /Invalid or insufficient token/);
});

test('bearerToken extracts the token from an Authorization header', () => {
  assert.equal(bearerToken('Bearer abc.def'), 'abc.def');
  assert.equal(bearerToken('bearer abc.def'), 'abc.def');
  assert.equal(bearerToken('Basic abc'), undefined);
  assert.equal(bearerToken(undefined), undefined);
});
