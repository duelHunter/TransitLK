package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.dto.RegulatorAnalytics;
import lk.transitlk.ticketingservice.dto.RegulatorAnalytics.RouteAnalytics;
import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.TicketStatus;
import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** FR9 - aggregated, regulator-facing analytics per route and operator, computed live. */
@Service
public class RegulatorService {

    private record RouteKey(String routeName, UUID operatorId) {
    }

    private final TripRepository tripRepository;
    private final TicketRepository ticketRepository;

    public RegulatorService(TripRepository tripRepository, TicketRepository ticketRepository) {
        this.tripRepository = tripRepository;
        this.ticketRepository = ticketRepository;
    }

    @Transactional(readOnly = true)
    public RegulatorAnalytics analytics() {
        List<Trip> trips = tripRepository.findAll();
        Map<UUID, List<Ticket>> soldByTrip = ticketRepository.findAll().stream()
                .filter(t -> t.getStatus() != TicketStatus.CANCELLED)
                .collect(Collectors.groupingBy(t -> t.getTrip().getTripId()));

        List<RouteAnalytics> routes = trips.stream()
                .collect(Collectors.groupingBy(t -> new RouteKey(t.getRoute().getName(), t.getOperatorId())))
                .entrySet().stream()
                .map(e -> routeAnalytics(e.getKey(), e.getValue(), soldByTrip))
                .sorted(Comparator.comparing(RouteAnalytics::routeName))
                .toList();

        long sold = routes.stream().mapToLong(RouteAnalytics::ticketsSold).sum();
        BigDecimal revenue = routes.stream().map(RouteAnalytics::revenue).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new RegulatorAnalytics(trips.size(), sold, revenue, routes);
    }

    private RouteAnalytics routeAnalytics(RouteKey key, List<Trip> trips, Map<UUID, List<Ticket>> soldByTrip) {
        List<Trip> active = trips.stream().filter(t -> t.getStatus() != TripStatus.CANCELLED).toList();
        long cancelled = trips.size() - active.size();

        long ticketsSold = 0;
        BigDecimal revenue = BigDecimal.ZERO;
        double occupancySum = 0;
        for (Trip trip : active) {
            List<Ticket> sold = soldByTrip.getOrDefault(trip.getTripId(), List.of());
            ticketsSold += sold.size();
            revenue = revenue.add(sold.stream().map(Ticket::getFare).reduce(BigDecimal.ZERO, BigDecimal::add));
            occupancySum += trip.getTotalSeats() == 0 ? 0 : (double) sold.size() / trip.getTotalSeats();
        }
        double avgOccupancy = active.isEmpty() ? 0 : Math.round(occupancySum / active.size() * 10000.0) / 10000.0;

        List<Double> delays = active.stream()
                .filter(t -> t.getStartedAt() != null)
                .map(t -> Duration.between(t.getDepartureTime(), t.getStartedAt()).getSeconds() / 60.0)
                .toList();
        Double avgDelay = delays.isEmpty() ? null
                : Math.round(delays.stream().mapToDouble(Double::doubleValue).average().orElse(0) * 10.0) / 10.0;

        return new RouteAnalytics(key.routeName(), key.operatorId(), trips.size(), cancelled,
                ticketsSold, revenue, avgOccupancy, avgDelay);
    }
}
