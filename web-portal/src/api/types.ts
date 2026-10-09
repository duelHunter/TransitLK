export type Role = 'PASSENGER' | 'CONDUCTOR' | 'OPERATOR' | 'ADMIN';

export interface UserResponse {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  enabled: boolean;
  walletBalance: number;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresInSeconds: number;
  user: UserResponse;
}

export interface TripSearchResult {
  tripId: string;
  routeName: string;
  origin: string;
  destination: string;
  vehicleReg: string;
  departureTime: string;
  arrivalTime: string;
  fare: number;
  availableSeats: number;
  totalSeats: number;
}

export type TicketStatus = 'ISSUED' | 'VALIDATED' | 'CANCELLED' | 'EXPIRED';

export interface TicketResponse {
  ticketId: string;
  tripId: string;
  routeName: string;
  origin: string;
  destination: string;
  departureTime: string;
  seatNo: number | null;
  fare: number;
  status: TicketStatus;
  qrCode: string;
  qrImageBase64: string;
  issuedAt: string;
  validatedAt: string | null;
}

export interface ValidationResult {
  valid: boolean;
  reason: string;
  ticketId: string | null;
  seatNo: number | null;
  validatedAt: string | null;
}

export interface LiveVehicle {
  vehicleReg: string;
  lat: number;
  lon: number;
  speedKmh: number;
  heading: number;
  timestamp: string;
}
