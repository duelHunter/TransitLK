export function formatMoney(value: number | string): string {
  return `Rs. ${Number(value).toFixed(2)}`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatDelay(minutes: number | null): string {
  return minutes === null ? 'n/a' : `${minutes.toFixed(1)} min`;
}

export function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '-';
}
