package lk.transitlk.ticketingservice.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public record CreateTripRequest(
        @NotNull UUID routeId,
        @NotBlank String vehicleReg,
        @NotNull Instant departureTime,
        @NotNull Instant arrivalTime,
        @Min(1) int totalSeats
) {
}
