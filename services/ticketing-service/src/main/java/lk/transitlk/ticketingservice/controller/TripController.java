package lk.transitlk.ticketingservice.controller;

import lk.transitlk.ticketingservice.dto.ManifestEntry;
import lk.transitlk.ticketingservice.dto.TripDto;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.service.TripService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    @GetMapping
    public ResponseEntity<List<TripDto>> list(@RequestParam(required = false) TripStatus status) {
        return ResponseEntity.ok(tripService.list(status));
    }

    @GetMapping("/{id}/tickets")
    public ResponseEntity<List<ManifestEntry>> manifest(@PathVariable UUID id) {
        return ResponseEntity.ok(tripService.manifest(id));
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<TripDto> start(@PathVariable UUID id) {
        return ResponseEntity.ok(tripService.start(id));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<TripService.TripReconciliation> complete(@PathVariable UUID id) {
        return ResponseEntity.ok(tripService.complete(id));
    }
}
