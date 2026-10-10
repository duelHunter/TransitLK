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

export interface TicketResponse {
  ticketId: string;
  tripId: string;
  routeName: string;
  origin: string;
  destination: string;
  departureTime: string;
  seatNo: number | null;
  fare: number;
  status: string;
  qrCode: string;
  qrImageBase64: string;
  issuedAt: string;
  validatedAt: string | null;
}

export interface TrackTokenResponse {
  token: string;
  vehicleReg: string;
  expiresAt: string;
}

export interface LivePosition {
  vehicleReg: string;
  lat: number;
  lon: number;
  speedKmh: number;
  heading: number;
  timestamp: string;
}
