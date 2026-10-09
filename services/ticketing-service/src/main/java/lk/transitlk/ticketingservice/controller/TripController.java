package lk.transitlk.ticketingservice.controller;

import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.service.TripService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<Trip> start(@PathVariable UUID id) {
        return ResponseEntity.ok(tripService.start(id));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<TripService.TripReconciliation> complete(@PathVariable UUID id) {
        return ResponseEntity.ok(tripService.complete(id));
    }
}
