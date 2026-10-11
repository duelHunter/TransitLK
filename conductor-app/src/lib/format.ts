export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** "12 of 40 seats sold" for the trip list. */
export function seatsSold(totalSeats: number, availableSeats: number): string {
  return `${totalSeats - availableSeats} of ${totalSeats} seats sold`;
}
