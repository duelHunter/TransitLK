import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDelay, formatMoney, formatPercent, formatDateTime } from './format.ts';

test('formatMoney renders rupees with two decimals', () => {
  assert.equal(formatMoney(222.5), 'Rs. 222.50');
  assert.equal(formatMoney('100'), 'Rs. 100.00');
});

test('formatPercent rounds a 0..1 fraction to a whole percent', () => {
  assert.equal(formatPercent(0.2), '20%');
  assert.equal(formatPercent(0.3333), '33%');
  assert.equal(formatPercent(0), '0%');
});

test('formatDelay shows minutes or n/a', () => {
  assert.equal(formatDelay(10), '10.0 min');
  assert.equal(formatDelay(null), 'n/a');
});

test('formatDateTime handles missing values', () => {
  assert.equal(formatDateTime(null), '-');
  assert.notEqual(formatDateTime('2026-10-10T08:00:00Z'), '-');
});
