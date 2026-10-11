package lk.transitlk.ticketingservice.config;

import lk.transitlk.ticketingservice.entity.Route;
import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.repository.RouteRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DataSeederTest {

    /** Must match the dropdown list used by the web portal and the mobile app. */
    private static final Set<String> MAIN_CITIES = new TreeSet<>(List.of(
            "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", "Gampaha", "Hambantota",
            "Jaffna", "Kalutara", "Kandy", "Kurunegala", "Matara", "Negombo", "Nuwara Eliya", "Polonnaruwa",
            "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya"));

    @Mock RouteRepository routeRepository;
    @Mock TripRepository tripRepository;

    private List<Route> savedRoutes() {
        List<Route> saved = new ArrayList<>();
        when(routeRepository.save(any(Route.class))).thenAnswer(i -> {
            Route r = i.getArgument(0);
            saved.add(r);
            return r;
        });
        return saved;
    }

    @Test
    void emptyDatabaseGetsRoutesCoveringEveryMainCity() {
        when(routeRepository.findAll()).thenReturn(List.of());
        List<Route> saved = savedRoutes();
        List<Trip> trips = new ArrayList<>();
        when(tripRepository.save(any(Trip.class))).thenAnswer(i -> {
            trips.add(i.getArgument(0));
            return i.getArgument(0);
        });

        new DataSeeder(routeRepository, tripRepository).run();

        Set<String> cities = saved.stream()
                .flatMap(r -> java.util.stream.Stream.of(r.getOrigin(), r.getDestination()))
                .collect(Collectors.toCollection(TreeSet::new));
        assertThat(cities).isEqualTo(MAIN_CITIES);
        assertThat(saved).extracting(Route::getName).doesNotHaveDuplicates();
        assertThat(trips).hasSizeGreaterThan(saved.size());
        assertThat(trips).allSatisfy(t -> {
            assertThat(t.getOperatorId()).isEqualTo(DataSeeder.DEMO_OPERATOR_ID);
            assertThat(t.getTotalSeats()).isPositive();
            assertThat(t.getArrivalTime()).isAfter(t.getDepartureTime());
        });
        // The demo and smoke test rely on these original trips staying put.
        assertThat(trips).extracting(Trip::getVehicleReg).contains("NB-1234", "NB-5678", "SP-9012", "NC-3456");
    }

    @Test
    void routesThatAlreadyExistAreNotSeededAgain() {
        when(routeRepository.findAll()).thenReturn(List.of());
        List<Route> first = savedRoutes();
        when(tripRepository.save(any(Trip.class))).thenAnswer(i -> i.getArgument(0));
        new DataSeeder(routeRepository, tripRepository).run();

        RouteRepository again = mock(RouteRepository.class);
        TripRepository againTrips = mock(TripRepository.class);
        when(again.findAll()).thenReturn(first);

        new DataSeeder(again, againTrips).run();

        verify(again, never()).save(any(Route.class));
        verify(againTrips, never()).save(any(Trip.class));
    }

    @Test
    void anExistingDatabaseOnlyReceivesTheMissingRoutes() {
        Route existing = new Route();
        existing.setName("Colombo - Kandy Express");
        existing.setOrigin("Colombo");
        existing.setDestination("Kandy");
        when(routeRepository.findAll()).thenReturn(List.of(existing));
        List<Route> saved = savedRoutes();
        when(tripRepository.save(any(Trip.class))).thenAnswer(i -> i.getArgument(0));

        new DataSeeder(routeRepository, tripRepository).run();

        assertThat(saved).extracting(Route::getName).doesNotContain("Colombo - Kandy Express");
        assertThat(saved).isNotEmpty();
    }
}
