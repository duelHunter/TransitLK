package lk.transitlk.ticketingservice.dto;

import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;

import java.time.Instant;
import java.util.UUID;

public record TripDto(
        UUID tripId,
        UUID routeId,
        String routeName,
        String origin,
        String destination,
        String vehicleReg,
        Instant departureTime,
        Instant arrivalTime,
        TripStatus status,
        int totalSeats,
        int availableSeats,
        UUID operatorId,
        Instant startedAt
) {
    public static TripDto from(Trip t) {
        return new TripDto(t.getTripId(), t.getRoute().getRouteId(), t.getRoute().getName(),
                t.getRoute().getOrigin(), t.getRoute().getDestination(), t.getVehicleReg(),
                t.getDepartureTime(), t.getArrivalTime(), t.getStatus(), t.getTotalSeats(),
                t.getAvailableSeats(), t.getOperatorId(), t.getStartedAt());
    }
}
