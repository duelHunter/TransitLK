import { seatsSold } from './format';

describe('seatsSold', () => {
  it('describes how full a trip is', () => {
    expect(seatsSold(40, 28)).toBe('12 of 40 seats sold');
    expect(seatsSold(40, 40)).toBe('0 of 40 seats sold');
  });
});
