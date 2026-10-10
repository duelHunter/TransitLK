package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.dto.CreateTripRequest;
import lk.transitlk.ticketingservice.dto.OperatorSummary;
import lk.transitlk.ticketingservice.dto.OperatorSummary.TripStats;
import lk.transitlk.ticketingservice.dto.TripDto;
import lk.transitlk.ticketingservice.entity.*;
import lk.transitlk.ticketingservice.exception.ApiException;
import lk.transitlk.ticketingservice.repository.RouteRepository;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** FR8/FR9 - fleet operators manage their own trips and see revenue and occupancy. */
@Service
public class OperatorService {

    private final TripRepository tripRepository;
    private final RouteRepository routeRepository;
    private final TicketRepository ticketRepository;
    private final EventPublisher eventPublisher;

    public OperatorService(TripRepository tripRepository, RouteRepository routeRepository,
                           TicketRepository ticketRepository, EventPublisher eventPublisher) {
        this.tripRepository = tripRepository;
        this.routeRepository = routeRepository;
        this.ticketRepository = ticketRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public List<TripDto> listTrips(UUID operatorId) {
        return tripRepository.findByOperatorIdOrderByDepartureTimeAsc(operatorId).stream()
                .map(TripDto::from).toList();
    }

    @Transactional
    public TripDto createTrip(UUID operatorId, CreateTripRequest req) {
        Route route = routeRepository.findById(req.routeId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Route not found"));
        if (!req.arrivalTime().isAfter(req.departureTime())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Arrival must be after departure");
        }
        Trip trip = new Trip();
        trip.setRoute(route);
        trip.setVehicleReg(req.vehicleReg());
        trip.setDepartureTime(req.departureTime());
        trip.setArrivalTime(req.arrivalTime());
        trip.setStatus(TripStatus.SCHEDULED);
        trip.setTotalSeats(req.totalSeats());
        trip.setAvailableSeats(req.totalSeats());
        trip.setOperatorId(operatorId);
        return TripDto.from(tripRepository.save(trip));
    }

    @Transactional
    public TripDto cancelTrip(UUID operatorId, UUID tripId) {
        Trip trip = ownedTrip(operatorId, tripId);
        if (trip.getStatus() != TripStatus.SCHEDULED) {
            throw new ApiException(HttpStatus.CONFLICT, "Only a scheduled trip can be cancelled");
        }
        trip.setStatus(TripStatus.CANCELLED);
        List<Ticket> toCancel = ticketRepository.findByTrip_TripId(tripId).stream()
                .filter(t -> t.getStatus() == TicketStatus.ISSUED)
                .toList();
        toCancel.forEach(t -> t.setStatus(TicketStatus.CANCELLED));
        ticketRepository.saveAll(toCancel);
        Trip saved = tripRepository.save(trip);
        eventPublisher.publishTripEvent("TRIP_CANCELLED", saved,
                toCancel.stream().map(Ticket::getPassengerId).distinct().toList());
        return TripDto.from(saved);
    }

    @Transactional(readOnly = true)
    public OperatorSummary summary(UUID operatorId) {
        List<TripStats> stats = tripRepository.findByOperatorIdOrderByDepartureTimeAsc(operatorId).stream()
                .map(this::statsFor).toList();
        BigDecimal revenue = stats.stream().map(TripStats::revenue).reduce(BigDecimal.ZERO, BigDecimal::add);
        long sold = stats.stream().mapToLong(TripStats::ticketsSold).sum();
        return new OperatorSummary(revenue, sold, stats);
    }

    private TripStats statsFor(Trip trip) {
        List<Ticket> sold = ticketRepository.findByTrip_TripId(trip.getTripId()).stream()
                .filter(t -> t.getStatus() != TicketStatus.CANCELLED)
                .toList();
        BigDecimal revenue = sold.stream().map(Ticket::getFare).reduce(BigDecimal.ZERO, BigDecimal::add);
        double occupancy = trip.getTotalSeats() == 0 ? 0
                : Math.round(sold.size() * 10000.0 / trip.getTotalSeats()) / 10000.0;
        return new TripStats(trip.getTripId(), trip.getRoute().getName(), trip.getVehicleReg(),
                trip.getDepartureTime(), trip.getStatus(), sold.size(), revenue, trip.getTotalSeats(), occupancy);
    }

    /** Another operator's trip is reported as missing so ids cannot be probed. */
    private Trip ownedTrip(UUID operatorId, UUID tripId) {
        return tripRepository.findById(tripId)
                .filter(t -> operatorId.equals(t.getOperatorId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Trip not found"));
    }
}
