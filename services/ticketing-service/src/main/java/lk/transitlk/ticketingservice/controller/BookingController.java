package lk.transitlk.ticketingservice.controller;

import jakarta.validation.Valid;
import lk.transitlk.ticketingservice.dto.BookingRequest;
import lk.transitlk.ticketingservice.dto.TicketResponse;
import lk.transitlk.ticketingservice.service.BookingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping("/bookings")
    public ResponseEntity<TicketResponse> book(Authentication authentication, @Valid @RequestBody BookingRequest req) {
        UUID passengerId = UUID.fromString(authentication.getName());
        return ResponseEntity.ok(bookingService.book(passengerId, req));
    }

    @GetMapping("/tickets/mine")
    public ResponseEntity<List<TicketResponse>> myTickets(Authentication authentication) {
        UUID passengerId = UUID.fromString(authentication.getName());
        return ResponseEntity.ok(bookingService.myTickets(passengerId));
    }

    @GetMapping("/tickets/{id}")
    public ResponseEntity<TicketResponse> getTicket(Authentication authentication, @PathVariable UUID id) {
        UUID requesterId = UUID.fromString(authentication.getName());
        boolean privileged = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_CONDUCTOR")
                        || a.getAuthority().equals("ROLE_ADMIN")
                        || a.getAuthority().equals("ROLE_OPERATOR"));
        return ResponseEntity.ok(bookingService.getTicket(id, requesterId, privileged));
    }

    @PostMapping("/tickets/{id}/cancel")
    public ResponseEntity<TicketResponse> cancel(Authentication authentication, @PathVariable UUID id) {
        UUID passengerId = UUID.fromString(authentication.getName());
        return ResponseEntity.ok(bookingService.cancel(id, passengerId));
    }
}
