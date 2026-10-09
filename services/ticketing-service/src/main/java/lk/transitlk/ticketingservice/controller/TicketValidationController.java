package lk.transitlk.ticketingservice.controller;

import jakarta.validation.Valid;
import lk.transitlk.ticketingservice.dto.ValidateTicketRequest;
import lk.transitlk.ticketingservice.dto.ValidationResult;
import lk.transitlk.ticketingservice.service.TicketValidationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tickets")
public class TicketValidationController {

    private final TicketValidationService validationService;

    public TicketValidationController(TicketValidationService validationService) {
        this.validationService = validationService;
    }

    @PostMapping("/validate")
    public ResponseEntity<ValidationResult> validate(@Valid @RequestBody ValidateTicketRequest req) {
        ValidationResult result = validationService.validate(req.qrCode());
        return ResponseEntity.ok(result);
    }
}
