package lk.transitlk.ticketingservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lk.transitlk.ticketingservice.entity.PaymentMethod;

import java.util.UUID;

public record BookingRequest(
        @NotNull UUID tripId,
        Integer seatNo,
        @NotBlank String paymentMethod
) {
    public PaymentMethod methodEnum() {
        return PaymentMethod.valueOf(paymentMethod.toUpperCase());
    }
}
