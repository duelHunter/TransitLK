package lk.transitlk.ticketingservice.dto;

import java.time.Instant;

public record TrackTokenResponse(String token, String vehicleReg, Instant expiresAt) {
}
