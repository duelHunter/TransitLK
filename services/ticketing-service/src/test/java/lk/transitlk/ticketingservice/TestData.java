package lk.transitlk.ticketingservice;

import lk.transitlk.ticketingservice.entity.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class TestData {

    public static final UUID OPERATOR_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    public static final Instant DEPARTURE = Instant.parse("2026-10-10T08:00:00Z");

    private TestData() {
    }

    public static Trip trip(TripStatus status) {
        return trip("Colombo - Kandy Express", status, 40, OPERATOR_ID);
    }

    public static Trip trip(String routeName, TripStatus status, int totalSeats, UUID operatorId) {
        Route route = new Route();
        route.setRouteId(UUID.nameUUIDFromBytes(routeName.getBytes()));
        route.setName(routeName);
        route.setOrigin("Colombo");
        route.setDestination("Kandy");
        route.setDistanceKm(115);
        route.setBaseFare(new BigDecimal("50"));
        route.setFarePerKm(new BigDecimal("1.50"));

        Trip trip = new Trip();
        trip.setTripId(UUID.randomUUID());
        trip.setRoute(route);
        trip.setVehicleReg("NB-1234");
        trip.setDepartureTime(DEPARTURE);
        trip.setArrivalTime(DEPARTURE.plusSeconds(3 * 3600));
        trip.setStatus(status);
        trip.setTotalSeats(totalSeats);
        trip.setAvailableSeats(totalSeats);
        trip.setOperatorId(operatorId);
        return trip;
    }

    public static Ticket ticket(Trip trip, TicketStatus status, String fare) {
        Ticket ticket = new Ticket();
        ticket.setTicketId(UUID.randomUUID());
        ticket.setTrip(trip);
        ticket.setPassengerId(UUID.randomUUID());
        ticket.setSeatNo(1);
        ticket.setFare(new BigDecimal(fare));
        ticket.setStatus(status);
        return ticket;
    }
}
