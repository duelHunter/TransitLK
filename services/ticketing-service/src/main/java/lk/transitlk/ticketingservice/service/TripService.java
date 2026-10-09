package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.exception.ApiException;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** FR10 - trip lifecycle management and reconciliation of issued vs. validated tickets. */
@Service
public class TripService {

    private final TripRepository tripRepository;
    private final TicketRepository ticketRepository;

    public TripService(TripRepository tripRepository, TicketRepository ticketRepository) {
        this.tripRepository = tripRepository;
        this.ticketRepository = ticketRepository;
    }

    @Transactional
    public Trip start(UUID tripId) {
        Trip trip = get(tripId);
        if (trip.getStatus() != TripStatus.SCHEDULED) {
            throw new ApiException(HttpStatus.CONFLICT, "Trip must be SCHEDULED to start");
        }
        trip.setStatus(TripStatus.ONGOING);
        return tripRepository.save(trip);
    }

    @Transactional
    public TripReconciliation complete(UUID tripId) {
        Trip trip = get(tripId);
        if (trip.getStatus() != TripStatus.ONGOING) {
            throw new ApiException(HttpStatus.CONFLICT, "Trip must be ONGOING to complete");
        }
        trip.setStatus(TripStatus.COMPLETED);
        tripRepository.save(trip);

        long issued = ticketRepository.findByTrip_TripId(tripId).size();
        long validated = ticketRepository.findByTrip_TripId(tripId).stream()
                .filter(t -> t.getStatus().name().equals("VALIDATED"))
                .count();
        return new TripReconciliation(trip, issued, validated);
    }

    private Trip get(UUID tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Trip not found"));
    }

    public record TripReconciliation(Trip trip, long ticketsIssued, long ticketsValidated) {
    }
}
