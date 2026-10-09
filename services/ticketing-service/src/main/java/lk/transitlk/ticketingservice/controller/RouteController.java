package lk.transitlk.ticketingservice.controller;

import lk.transitlk.ticketingservice.dto.TripSearchResult;
import lk.transitlk.ticketingservice.service.RouteSearchService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/routes")
public class RouteController {

    private final RouteSearchService routeSearchService;

    public RouteController(RouteSearchService routeSearchService) {
        this.routeSearchService = routeSearchService;
    }

    @GetMapping("/search")
    public ResponseEntity<List<TripSearchResult>> search(
            @RequestParam String origin,
            @RequestParam String destination,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(routeSearchService.search(origin, destination, date));
    }
}
