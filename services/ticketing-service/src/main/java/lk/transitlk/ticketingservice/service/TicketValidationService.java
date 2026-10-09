package lk.transitlk.ticketingservice.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lk.transitlk.ticketingservice.dto.ValidationResult;
import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.TicketStatus;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Validates a scanned QR e-ticket (FR6). Signature/expiry verification (step 1) needs no
 * database access, so a conductor device could perform it fully offline as described in
 * section 6.4; only the single-use check (step 2, "has this ticket already been redeemed")
 * requires reaching this service, which is where the offline-tolerant degradation applies.
 */
@Service
public class TicketValidationService {

    private final TicketSigningService signingService;
    private final TicketRepository ticketRepository;
    private final EventPublisher eventPublisher;

    public TicketValidationService(TicketSigningService signingService, TicketRepository ticketRepository,
                                    EventPublisher eventPublisher) {
        this.signingService = signingService;
        this.ticketRepository = ticketRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public ValidationResult validate(String qrCode) {
        Claims claims;
        try {
            claims = signingService.verify(qrCode);
        } catch (JwtException e) {
            return new ValidationResult(false, "Invalid or expired QR signature", null, null, null);
        }

        UUID ticketId = UUID.fromString(claims.getSubject());
        Ticket ticket = ticketRepository.findById(ticketId).orElse(null);
        if (ticket == null) {
            return new ValidationResult(false, "Ticket not found", ticketId, null, null);
        }
        if (ticket.getStatus() == TicketStatus.VALIDATED) {
            return new ValidationResult(false, "Ticket already used at " + ticket.getValidatedAt(), ticketId,
                    ticket.getSeatNo(), ticket.getValidatedAt());
        }
        if (ticket.getStatus() != TicketStatus.ISSUED) {
            return new ValidationResult(false, "Ticket is " + ticket.getStatus(), ticketId, ticket.getSeatNo(), null);
        }

        ticket.setStatus(TicketStatus.VALIDATED);
        ticket.setValidatedAt(Instant.now());
        ticketRepository.save(ticket);
        eventPublisher.publishTicketValidated(ticket);

        return new ValidationResult(true, "OK", ticketId, ticket.getSeatNo(), ticket.getValidatedAt());
    }
}
