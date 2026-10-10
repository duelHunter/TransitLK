package lk.transitlk.ticketingservice.dto;

import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.TicketStatus;

import java.time.Instant;
import java.util.UUID;

public record ManifestEntry(UUID ticketId, UUID passengerId, Integer seatNo, TicketStatus status, Instant validatedAt) {
    public static ManifestEntry from(Ticket t) {
        return new ManifestEntry(t.getTicketId(), t.getPassengerId(), t.getSeatNo(), t.getStatus(), t.getValidatedAt());
    }
}
