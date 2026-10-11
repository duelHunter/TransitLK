import { MAIN_CITIES, searchError } from './cities';

describe('MAIN_CITIES', () => {
  it('has 20 distinct cities, sorted for the picker', () => {
    expect(MAIN_CITIES).toHaveLength(20);
    expect(new Set(MAIN_CITIES).size).toBe(20);
    expect([...MAIN_CITIES]).toEqual([...MAIN_CITIES].sort((a, b) => a.localeCompare(b)));
  });

  it('includes the demo cities', () => {
    for (const city of ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Nuwara Eliya']) {
      expect(MAIN_CITIES).toContain(city);
    }
  });
});

describe('searchError', () => {
  it('rejects an empty or identical origin and destination', () => {
    expect(searchError('', 'Kandy')).toBe('Choose where you are travelling from.');
    expect(searchError('Colombo', '')).toBe('Choose where you are travelling to.');
    expect(searchError('Kandy', 'Kandy')).toBe('Origin and destination must be different cities.');
  });

  it('accepts two different cities', () => {
    expect(searchError('Colombo', 'Kandy')).toBeNull();
  });
});
