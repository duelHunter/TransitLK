package lk.transitlk.ticketingservice.config;

import lk.transitlk.ticketingservice.entity.Route;
import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.repository.RouteRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Seeds demo routes and trips between the main cities so the search -> book -> validate flow is
 * runnable out of the box. Seeding is per route name, so an existing database receives only the
 * routes it is missing.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    /** Must equal user-service DemoUserSeeder.OPERATOR_ID. */
    public static final java.util.UUID DEMO_OPERATOR_ID =
            java.util.UUID.fromString("00000000-0000-0000-0000-0000000000a1");

    private record TripSpec(String vehicleReg, int departInHours, int durationHours, int seats) {
    }

    private record RouteSpec(String name, String origin, String destination, double km,
                             String baseFare, String farePerKm, List<TripSpec> trips) {
    }

    /** Two daytime departures per route, regs numbered from 7000 so they never clash with the originals. */
    private static RouteSpec route(int index, String origin, String destination, double km, String base, String perKm) {
        int hours = (int) Math.max(1, Math.ceil(km / 45));
        int first = 2 + index % 5;
        return new RouteSpec(origin + " - " + destination, origin, destination, km, base, perKm, List.of(
                new TripSpec("NB-" + (7000 + index * 2), first, hours, 40),
                new TripSpec("NB-" + (7001 + index * 2), first + 6, hours, 40)));
    }

    private static final List<RouteSpec> ROUTES = List.of(
            // The original three demo routes keep their names, fares and vehicles.
            new RouteSpec("Colombo - Kandy Express", "Colombo", "Kandy", 115, "50", "1.50", List.of(
                    new TripSpec("NB-1234", 1, 3, 40), new TripSpec("NB-5678", 3, 3, 40))),
            new RouteSpec("Colombo - Galle Highway", "Colombo", "Galle", 125, "60", "1.60", List.of(
                    new TripSpec("SP-9012", 2, 3, 45))),
            new RouteSpec("Kandy - Jaffna Intercity", "Kandy", "Jaffna", 260, "80", "1.20", List.of(
                    new TripSpec("NC-3456", 5, 6, 50))),

            route(0, "Colombo", "Negombo", 38, "30", "1.40"),
            route(1, "Colombo", "Gampaha", 30, "25", "1.40"),
            route(2, "Colombo", "Kalutara", 43, "30", "1.40"),
            route(3, "Colombo", "Matara", 160, "70", "1.50"),
            route(4, "Colombo", "Ratnapura", 100, "50", "1.50"),
            route(5, "Colombo", "Kurunegala", 93, "45", "1.50"),
            route(6, "Colombo", "Puttalam", 130, "60", "1.40"),
            route(7, "Colombo", "Anuradhapura", 205, "70", "1.30"),
            route(8, "Colombo", "Jaffna", 395, "100", "1.20"),
            route(9, "Colombo", "Trincomalee", 260, "80", "1.30"),
            route(10, "Colombo", "Batticaloa", 315, "90", "1.30"),
            route(11, "Colombo", "Nuwara Eliya", 180, "70", "1.50"),
            route(12, "Colombo", "Badulla", 230, "80", "1.40"),
            route(13, "Galle", "Matara", 45, "30", "1.40"),
            route(14, "Matara", "Hambantota", 80, "40", "1.40"),
            route(15, "Kandy", "Nuwara Eliya", 78, "40", "1.50"),
            route(16, "Kandy", "Anuradhapura", 138, "55", "1.30"),
            route(17, "Anuradhapura", "Vavuniya", 55, "30", "1.30"),
            route(18, "Anuradhapura", "Polonnaruwa", 100, "45", "1.30"),
            route(19, "Batticaloa", "Ampara", 75, "40", "1.40")
    );

    private final RouteRepository routeRepository;
    private final TripRepository tripRepository;

    public DataSeeder(RouteRepository routeRepository, TripRepository tripRepository) {
        this.routeRepository = routeRepository;
        this.tripRepository = tripRepository;
    }

    @Override
    public void run(String... args) {
        Set<String> existing = routeRepository.findAll().stream()
                .map(Route::getName)
                .collect(Collectors.toSet());
        Instant now = Instant.now();

        for (RouteSpec spec : ROUTES) {
            if (existing.contains(spec.name())) {
                continue;
            }
            Route route = routeRepository.save(newRoute(spec));
            for (TripSpec trip : spec.trips()) {
                tripRepository.save(newTrip(route, trip, now));
            }
        }
    }

    private Route newRoute(RouteSpec spec) {
        Route r = new Route();
        r.setName(spec.name());
        r.setOrigin(spec.origin());
        r.setDestination(spec.destination());
        r.setDistanceKm(spec.km());
        r.setBaseFare(new BigDecimal(spec.baseFare()));
        r.setFarePerKm(new BigDecimal(spec.farePerKm()));
        return r;
    }

    private Trip newTrip(Route route, TripSpec spec, Instant now) {
        Instant departure = now.plus(spec.departInHours(), ChronoUnit.HOURS);
        Trip t = new Trip();
        t.setRoute(route);
        t.setVehicleReg(spec.vehicleReg());
        t.setDepartureTime(departure);
        t.setArrivalTime(departure.plus(spec.durationHours(), ChronoUnit.HOURS));
        t.setStatus(TripStatus.SCHEDULED);
        t.setTotalSeats(spec.seats());
        t.setAvailableSeats(spec.seats());
        t.setOperatorId(DEMO_OPERATOR_ID);
        return t;
    }
}
