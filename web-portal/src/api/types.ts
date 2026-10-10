export type Role = 'PASSENGER' | 'CONDUCTOR' | 'OPERATOR' | 'ADMIN' | 'REGULATOR';

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

export interface RouteAnalytics {
  routeName: string;
  operatorId: string | null;
  trips: number;
  cancelledTrips: number;
  ticketsSold: number;
  revenue: number;
  avgOccupancy: number;
  avgDelayMinutes: number | null;
}

export interface RegulatorAnalytics {
  totalTrips: number;
  totalTicketsSold: number;
  totalRevenue: number;
  routes: RouteAnalytics[];
}
