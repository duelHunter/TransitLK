import { canTrack, formatMoney, statusLabel } from './format';

describe('formatMoney', () => {
  it('renders rupees with two decimals', () => {
    expect(formatMoney(222.5)).toBe('Rs. 222.50');
    expect(formatMoney('100')).toBe('Rs. 100.00');
  });
});

describe('canTrack', () => {
  it('allows only active tickets', () => {
    expect(canTrack('ISSUED')).toBe(true);
    expect(canTrack('VALIDATED')).toBe(true);
    expect(canTrack('CANCELLED')).toBe(false);
    expect(canTrack('EXPIRED')).toBe(false);
  });
});

describe('statusLabel', () => {
  it('maps backend statuses to passenger wording', () => {
    expect(statusLabel('ISSUED')).toBe('Valid');
    expect(statusLabel('VALIDATED')).toBe('Used');
    expect(statusLabel('CANCELLED')).toBe('Cancelled');
    expect(statusLabel('EXPIRED')).toBe('Expired');
    expect(statusLabel('SOMETHING')).toBe('SOMETHING');
  });
});
