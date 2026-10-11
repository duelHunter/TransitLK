import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landingPath } from './landing.ts';

test('operators land on their dashboard', () => {
  assert.equal(landingPath('OPERATOR'), '/operator');
});

test('admins land on trip control', () => {
  assert.equal(landingPath('ADMIN'), '/trips');
});

test('passengers and conductors have no web screens and are told to use their app', () => {
  assert.equal(landingPath('PASSENGER'), null);
  assert.equal(landingPath('CONDUCTOR'), null);
});
