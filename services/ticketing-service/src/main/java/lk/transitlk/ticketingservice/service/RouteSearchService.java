package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.dto.TripSearchResult;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@Service
public class RouteSearchService {

    private final TripRepository tripRepository;

    public RouteSearchService(TripRepository tripRepository) {
        this.tripRepository = tripRepository;
    }

    @Transactional(readOnly = true)
    public List<TripSearchResult> search(String origin, String destination, LocalDate date) {
        LocalDate day = date != null ? date : LocalDate.now(ZoneOffset.UTC);
        Instant from = day.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        return tripRepository.search(origin, destination, from, to).stream()
                .map(TripSearchResult::from)
                .toList();
    }
}
