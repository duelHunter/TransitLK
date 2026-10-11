package lk.transitlk.ticketingservice.repository;

import lk.transitlk.ticketingservice.entity.Route;
import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class TripRepositorySearchTest {

    private static final Instant FROM = Instant.parse("2026-10-11T08:00:00Z");
    private static final Instant TO = FROM.plusSeconds(24 * 3600);

    @Autowired TestEntityManager em;
    @Autowired TripRepository tripRepository;

    private Route colomboKandy;

    @BeforeEach
    void setUp() {
        colomboKandy = route("Colombo - Kandy Express", "Colombo", "Kandy");
        Route colomboGalle = route("Colombo - Galle Highway", "Colombo", "Galle");
        trip(colomboKandy, "NB-1", FROM.plusSeconds(3600));
        trip(colomboKandy, "NB-2", FROM.plusSeconds(7200));
        trip(colomboKandy, "NB-OLD", FROM.minusSeconds(3600)); // already departed
        trip(colomboGalle, "SP-1", FROM.plusSeconds(3600));
        em.flush();
    }

    private Route route(String name, String origin, String destination) {
        Route r = new Route();
        r.setName(name);
        r.setOrigin(origin);
        r.setDestination(destination);
        r.setDistanceKm(100);
        r.setBaseFare(new BigDecimal("50"));
        r.setFarePerKm(new BigDecimal("1.5"));
        return em.persist(r);
    }

    private void trip(Route route, String reg, Instant departure) {
        Trip t = new Trip();
        t.setRoute(route);
        t.setVehicleReg(reg);
        t.setDepartureTime(departure);
        t.setArrivalTime(departure.plusSeconds(3 * 3600));
        t.setStatus(TripStatus.SCHEDULED);
        t.setTotalSeats(40);
        t.setAvailableSeats(40);
        em.persist(t);
    }

    @Test
    void findsTripsInTheForwardDirectionInsideTheWindowOrderedByDeparture() {
        List<Trip> found = tripRepository.search("Colombo", "Kandy", FROM, TO);

        assertThat(found).extracting(Trip::getVehicleReg).containsExactly("NB-1", "NB-2");
    }

    @Test
    void alsoFindsTheSameRouteWhenOriginAndDestinationAreSwapped() {
        List<Trip> found = tripRepository.search("Kandy", "Colombo", FROM, TO);

        assertThat(found).extracting(Trip::getVehicleReg).containsExactly("NB-1", "NB-2");
    }

    @Test
    void matchingIgnoresCase() {
        assertThat(tripRepository.search("colombo", "KANDY", FROM, TO)).hasSize(2);
    }

    @Test
    void unrelatedCityPairReturnsNothing() {
        assertThat(tripRepository.search("Kandy", "Galle", FROM, TO)).isEmpty();
    }
}
