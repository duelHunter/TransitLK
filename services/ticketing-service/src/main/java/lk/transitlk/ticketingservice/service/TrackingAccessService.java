package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.dto.TrackTokenResponse;
import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.TicketStatus;
import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.exception.ApiException;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** A passenger may watch only the vehicle of a trip they hold an active ticket for, while it is running. */
@Service
public class TrackingAccessService {

    private final TicketRepository ticketRepository;
    private final TrackTokenService tokenService;

    public TrackingAccessService(TicketRepository ticketRepository, TrackTokenService tokenService) {
        this.ticketRepository = ticketRepository;
        this.tokenService = tokenService;
    }

    @Transactional(readOnly = true)
    public TrackTokenResponse issueFor(UUID ticketId, UUID requesterId) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Ticket not found"));
        if (!ticket.getPassengerId().equals(requesterId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not your ticket");
        }
        if (ticket.getStatus() != TicketStatus.ISSUED && ticket.getStatus() != TicketStatus.VALIDATED) {
            throw new ApiException(HttpStatus.CONFLICT, "Ticket is not active");
        }
        Trip trip = ticket.getTrip();
        if (trip.getStatus() != TripStatus.ONGOING) {
            throw new ApiException(HttpStatus.CONFLICT, "Trip is not in progress");
        }
        return tokenService.issue(ticketId, trip.getVehicleReg());
    }
}
