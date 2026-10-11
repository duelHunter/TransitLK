package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.dto.TripSearchResult;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class RouteSearchService {

    private final TripRepository tripRepository;
    private final Clock clock;

    public RouteSearchService(TripRepository tripRepository, Clock clock) {
        this.tripRepository = tripRepository;
        this.clock = clock;
    }

    /**
     * With a date: that UTC calendar day. Without one: the next 24 hours from now, so a search made
     * late in the day still finds tonight's and tomorrow morning's departures.
     */
    @Transactional(readOnly = true)
    public List<TripSearchResult> search(String origin, String destination, LocalDate date) {
        Instant from;
        Instant to;
        if (date != null) {
            from = date.atStartOfDay(ZoneOffset.UTC).toInstant();
            to = date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        } else {
            from = clock.instant();
            to = from.plus(24, ChronoUnit.HOURS);
        }
        return tripRepository.search(origin, destination, from, to).stream()
                .map(TripSearchResult::from)
                .toList();
    }
}
