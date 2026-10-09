package lk.transitlk.ticketingservice.dto;

import lk.transitlk.ticketingservice.entity.Trip;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TripSearchResult(
        UUID tripId,
        String routeName,
        String origin,
        String destination,
        String vehicleReg,
        Instant departureTime,
        Instant arrivalTime,
        BigDecimal fare,
        int availableSeats,
        int totalSeats
) {
    public static TripSearchResult from(Trip t) {
        return new TripSearchResult(
                t.getTripId(), t.getRoute().getName(), t.getRoute().getOrigin(), t.getRoute().getDestination(),
                t.getVehicleReg(), t.getDepartureTime(), t.getArrivalTime(),
                t.getRoute().calculateFare(), t.getAvailableSeats(), t.getTotalSeats()
        );
    }
}
