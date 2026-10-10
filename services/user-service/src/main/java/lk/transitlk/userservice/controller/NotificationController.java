package lk.transitlk.userservice.controller;

import lk.transitlk.userservice.dto.NotificationResponse;
import lk.transitlk.userservice.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> mine(Authentication authentication) {
        UUID userId = UUID.fromString(authentication.getName());
        return ResponseEntity.ok(notificationService.list(userId).stream().map(NotificationResponse::from).toList());
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> read(Authentication authentication, @PathVariable UUID id) {
        UUID userId = UUID.fromString(authentication.getName());
        return ResponseEntity.ok(NotificationResponse.from(notificationService.markSeen(userId, id)));
    }
}
