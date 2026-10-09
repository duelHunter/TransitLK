package lk.transitlk.ticketingservice.dto;

import jakarta.validation.constraints.NotBlank;

public record ValidateTicketRequest(
        @NotBlank String qrCode
) {
}
