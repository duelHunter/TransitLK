import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAIN_CITIES, searchError } from './cities.ts';

test('there are 20 distinct main cities, sorted for the dropdown', () => {
  assert.equal(MAIN_CITIES.length, 20);
  assert.equal(new Set(MAIN_CITIES).size, 20);
  assert.deepEqual([...MAIN_CITIES], [...MAIN_CITIES].sort((a, b) => a.localeCompare(b)));
});

test('the demo cities are present', () => {
  for (const city of ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Nuwara Eliya']) {
    assert.ok(MAIN_CITIES.includes(city), city);
  }
});

test('searchError rejects an empty or identical origin and destination', () => {
  assert.equal(searchError('', 'Kandy'), 'Choose where you are travelling from.');
  assert.equal(searchError('Colombo', ''), 'Choose where you are travelling to.');
  assert.equal(searchError('Kandy', 'Kandy'), 'Origin and destination must be different cities.');
});

test('searchError accepts two different cities', () => {
  assert.equal(searchError('Colombo', 'Kandy'), null);
});
