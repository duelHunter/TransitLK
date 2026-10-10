package lk.transitlk.ticketingservice.controller;

import jakarta.validation.Valid;
import lk.transitlk.ticketingservice.dto.CreateTripRequest;
import lk.transitlk.ticketingservice.dto.OperatorSummary;
import lk.transitlk.ticketingservice.dto.TripDto;
import lk.transitlk.ticketingservice.service.OperatorService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/operator")
public class OperatorController {

    private final OperatorService operatorService;

    public OperatorController(OperatorService operatorService) {
        this.operatorService = operatorService;
    }

    @GetMapping("/trips")
    public ResponseEntity<List<TripDto>> trips(Authentication authentication) {
        return ResponseEntity.ok(operatorService.listTrips(operatorId(authentication)));
    }

    @PostMapping("/trips")
    public ResponseEntity<TripDto> create(Authentication authentication, @Valid @RequestBody CreateTripRequest req) {
        return ResponseEntity.ok(operatorService.createTrip(operatorId(authentication), req));
    }

    @PostMapping("/trips/{id}/cancel")
    public ResponseEntity<TripDto> cancel(Authentication authentication, @PathVariable UUID id) {
        return ResponseEntity.ok(operatorService.cancelTrip(operatorId(authentication), id));
    }

    @GetMapping("/reports/summary")
    public ResponseEntity<OperatorSummary> summary(Authentication authentication) {
        return ResponseEntity.ok(operatorService.summary(operatorId(authentication)));
    }

    private UUID operatorId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
