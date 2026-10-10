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

/** Seeds a handful of demo routes/trips so the search -> book -> validate flow is runnable out of the box. */
@Component
public class DataSeeder implements CommandLineRunner {

    /** Must equal user-service DemoUserSeeder.OPERATOR_ID. */
    public static final java.util.UUID DEMO_OPERATOR_ID =
            java.util.UUID.fromString("00000000-0000-0000-0000-0000000000a1");

    private final RouteRepository routeRepository;
    private final TripRepository tripRepository;

    public DataSeeder(RouteRepository routeRepository, TripRepository tripRepository) {
        this.routeRepository = routeRepository;
        this.tripRepository = tripRepository;
    }

    @Override
    public void run(String... args) {
        if (routeRepository.count() > 0) {
            return;
        }

        Route colomboKandy = newRoute("Colombo - Kandy Express", "Colombo", "Kandy", 115, "50", "1.50");
        Route colomboGalle = newRoute("Colombo - Galle Highway", "Colombo", "Galle", 125, "60", "1.60");
        Route kandyJaffna = newRoute("Kandy - Jaffna Intercity", "Kandy", "Jaffna", 260, "80", "1.20");
        routeRepository.saveAll(java.util.List.of(colomboKandy, colomboGalle, kandyJaffna));

        Instant now = Instant.now();
        tripRepository.saveAll(java.util.List.of(
                newTrip(colomboKandy, "NB-1234", now.plus(1, ChronoUnit.HOURS), now.plus(4, ChronoUnit.HOURS), 40),
                newTrip(colomboKandy, "NB-5678", now.plus(3, ChronoUnit.HOURS), now.plus(6, ChronoUnit.HOURS), 40),
                newTrip(colomboGalle, "SP-9012", now.plus(2, ChronoUnit.HOURS), now.plus(5, ChronoUnit.HOURS), 45),
                newTrip(kandyJaffna, "NC-3456", now.plus(5, ChronoUnit.HOURS), now.plus(11, ChronoUnit.HOURS), 50)
        ));
    }

    private Route newRoute(String name, String origin, String destination, double km, String baseFare, String perKm) {
        Route r = new Route();
        r.setName(name);
        r.setOrigin(origin);
        r.setDestination(destination);
        r.setDistanceKm(km);
        r.setBaseFare(new BigDecimal(baseFare));
        r.setFarePerKm(new BigDecimal(perKm));
        return r;
    }

    private Trip newTrip(Route route, String vehicleReg, Instant dep, Instant arr, int seats) {
        Trip t = new Trip();
        t.setRoute(route);
        t.setVehicleReg(vehicleReg);
        t.setDepartureTime(dep);
        t.setArrivalTime(arr);
        t.setStatus(TripStatus.SCHEDULED);
        t.setTotalSeats(seats);
        t.setAvailableSeats(seats);
        t.setOperatorId(DEMO_OPERATOR_ID);
        return t;
    }
}
