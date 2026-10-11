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

export type TicketStatus = 'ISSUED' | 'VALIDATED' | 'CANCELLED' | 'EXPIRED';

export interface LiveVehicle {
  vehicleReg: string;
  lat: number;
  lon: number;
  speedKmh: number;
  heading: number;
  timestamp: string;
}

export type TripStatus = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

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

export interface OperatorTripStats {
  tripId: string;
  routeName: string;
  vehicleReg: string;
  departureTime: string;
  status: TripStatus;
  ticketsSold: number;
  revenue: number;
  totalSeats: number;
  occupancy: number;
}

export interface OperatorSummary {
  totalRevenue: number;
  totalTicketsSold: number;
  trips: OperatorTripStats[];
}

export interface CreateTripRequest {
  routeId: string;
  vehicleReg: string;
  departureTime: string;
  arrivalTime: string;
  totalSeats: number;
}
