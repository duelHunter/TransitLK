export function formatMoney(value: number | string): string {
  return `Rs. ${Number(value).toFixed(2)}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function canTrack(status: string): boolean {
  return status === 'ISSUED' || status === 'VALIDATED';
}

const STATUS_LABELS: Record<string, string> = {
  ISSUED: 'Valid',
  VALIDATED: 'Used',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
