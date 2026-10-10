package lk.transitlk.ticketingservice.controller;

import lk.transitlk.ticketingservice.dto.TrackTokenResponse;
import lk.transitlk.ticketingservice.service.TrackingAccessService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/tickets")
public class TrackingAccessController {

    private final TrackingAccessService trackingAccessService;

    public TrackingAccessController(TrackingAccessService trackingAccessService) {
        this.trackingAccessService = trackingAccessService;
    }

    @PostMapping("/{id}/track-token")
    public ResponseEntity<TrackTokenResponse> trackToken(Authentication authentication, @PathVariable UUID id) {
        UUID requesterId = UUID.fromString(authentication.getName());
        return ResponseEntity.ok(trackingAccessService.issueFor(id, requesterId));
    }
}
