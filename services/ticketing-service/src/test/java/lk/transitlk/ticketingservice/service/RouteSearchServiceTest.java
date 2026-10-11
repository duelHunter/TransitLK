package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.TestData;
import lk.transitlk.ticketingservice.dto.TripSearchResult;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RouteSearchServiceTest {

    @Mock TripRepository tripRepository;

    private final Clock lateEvening = Clock.fixed(Instant.parse("2026-10-11T20:00:00Z"), ZoneOffset.UTC);

    @Test
    void withoutADateItSearchesTheNext24HoursFromNow() {
        // 20:00 UTC: a calendar-day window would leave only four hours, so the window must roll forward.
        when(tripRepository.search("Colombo", "Kandy",
                Instant.parse("2026-10-11T20:00:00Z"), Instant.parse("2026-10-12T20:00:00Z")))
                .thenReturn(List.of(TestData.trip(TripStatus.SCHEDULED)));

        List<TripSearchResult> result = new RouteSearchService(tripRepository, lateEvening)
                .search("Colombo", "Kandy", null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).routeName()).isEqualTo("Colombo - Kandy Express");
    }

    @Test
    void withADateItSearchesThatUtcDay() {
        when(tripRepository.search("Galle", "Colombo",
                Instant.parse("2026-10-13T00:00:00Z"), Instant.parse("2026-10-14T00:00:00Z")))
                .thenReturn(List.of());

        List<TripSearchResult> result = new RouteSearchService(tripRepository, lateEvening)
                .search("Galle", "Colombo", LocalDate.of(2026, 10, 13));

        assertThat(result).isEmpty();
    }
}
