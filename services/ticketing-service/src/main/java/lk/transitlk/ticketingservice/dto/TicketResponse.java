package lk.transitlk.ticketingservice.dto;

import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.TicketStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TicketResponse(
        UUID ticketId,
        UUID tripId,
        String routeName,
        String origin,
        String destination,
        Instant departureTime,
        Integer seatNo,
        BigDecimal fare,
        TicketStatus status,
        String qrCode,
        String qrImageBase64,
        Instant issuedAt,
        Instant validatedAt
) {
    public static TicketResponse from(Ticket t, String qrImageBase64) {
        return new TicketResponse(
                t.getTicketId(), t.getTrip().getTripId(), t.getTrip().getRoute().getName(),
                t.getTrip().getRoute().getOrigin(), t.getTrip().getRoute().getDestination(),
                t.getTrip().getDepartureTime(), t.getSeatNo(), t.getFare(), t.getStatus(),
                t.getQrCode(), qrImageBase64, t.getIssuedAt(), t.getValidatedAt()
        );
    }
}
