export interface UserResponse {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  enabled: boolean;
  walletBalance: number;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresInSeconds: number;
  user: UserResponse;
}

export type TripStatus = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type TicketStatus = 'ISSUED' | 'VALIDATED' | 'CANCELLED' | 'EXPIRED';

export interface TripDto {
  tripId: string;
  routeId: string;
  routeName: string;
  origin: string;
  destination: string;
  vehicleReg: string;
  departureTime: string;
  arrivalTime: string;
  status: TripStatus;
  totalSeats: number;
  availableSeats: number;
  operatorId: string | null;
  startedAt: string | null;
}

export interface ManifestEntry {
  ticketId: string;
  passengerId: string;
  seatNo: number | null;
  status: TicketStatus;
  validatedAt: string | null;
}

export interface TripReconciliation {
  trip: TripDto;
  ticketsIssued: number;
  ticketsValidated: number;
}

export interface ValidationResult {
  valid: boolean;
  reason: string;
  ticketId: string | null;
  seatNo: number | null;
  validatedAt: string | null;
}
