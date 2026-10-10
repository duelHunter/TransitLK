package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.dto.ManifestEntry;
import lk.transitlk.ticketingservice.dto.TripDto;
import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.TicketStatus;
import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.exception.ApiException;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** FR10 - trip lifecycle management and reconciliation of issued vs. validated tickets. */
@Service
public class TripService {

    private final TripRepository tripRepository;
    private final TicketRepository ticketRepository;
    private final EventPublisher eventPublisher;

    public TripService(TripRepository tripRepository, TicketRepository ticketRepository,
                       EventPublisher eventPublisher) {
        this.tripRepository = tripRepository;
        this.ticketRepository = ticketRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public List<TripDto> list(TripStatus status) {
        List<Trip> trips = status == null
                ? tripRepository.findAllByOrderByDepartureTimeAsc()
                : tripRepository.findByStatusOrderByDepartureTimeAsc(status);
        return trips.stream().map(TripDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ManifestEntry> manifest(UUID tripId) {
        get(tripId);
        return ticketRepository.findByTrip_TripId(tripId).stream().map(ManifestEntry::from).toList();
    }

    @Transactional
    public TripDto start(UUID tripId) {
        Trip trip = get(tripId);
        if (trip.getStatus() != TripStatus.SCHEDULED) {
            throw new ApiException(HttpStatus.CONFLICT, "Trip must be SCHEDULED to start");
        }
        trip.setStatus(TripStatus.ONGOING);
        trip.setStartedAt(Instant.now());
        Trip saved = tripRepository.save(trip);
        List<UUID> passengers = ticketRepository.findByTrip_TripId(tripId).stream()
                .filter(t -> t.getStatus() == TicketStatus.ISSUED || t.getStatus() == TicketStatus.VALIDATED)
                .map(Ticket::getPassengerId)
                .distinct()
                .toList();
        eventPublisher.publishTripEvent("TRIP_STARTED", saved, passengers);
        return TripDto.from(saved);
    }

    @Transactional
    public TripReconciliation complete(UUID tripId) {
        Trip trip = get(tripId);
        if (trip.getStatus() != TripStatus.ONGOING) {
            throw new ApiException(HttpStatus.CONFLICT, "Trip must be ONGOING to complete");
        }
        trip.setStatus(TripStatus.COMPLETED);
        Trip saved = tripRepository.save(trip);

        List<Ticket> tickets = ticketRepository.findByTrip_TripId(tripId).stream()
                .filter(t -> t.getStatus() != TicketStatus.CANCELLED)
                .toList();
        long validated = tickets.stream().filter(t -> t.getStatus() == TicketStatus.VALIDATED).count();
        return new TripReconciliation(TripDto.from(saved), tickets.size(), validated);
    }

    private Trip get(UUID tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Trip not found"));
    }

    public record TripReconciliation(TripDto trip, long ticketsIssued, long ticketsValidated) {
    }
}
