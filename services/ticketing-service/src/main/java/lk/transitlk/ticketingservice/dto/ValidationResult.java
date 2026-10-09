package lk.transitlk.ticketingservice.dto;

import java.time.Instant;
import java.util.UUID;

public record ValidationResult(
        boolean valid,
        String reason,
        UUID ticketId,
        Integer seatNo,
        Instant validatedAt
) {
}
