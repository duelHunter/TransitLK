package lk.transitlk.ticketingservice.controller;

import lk.transitlk.ticketingservice.dto.RegulatorAnalytics;
import lk.transitlk.ticketingservice.service.RegulatorService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/regulator")
public class RegulatorController {

    private final RegulatorService regulatorService;

    public RegulatorController(RegulatorService regulatorService) {
        this.regulatorService = regulatorService;
    }

    @GetMapping("/analytics")
    public ResponseEntity<RegulatorAnalytics> analytics() {
        return ResponseEntity.ok(regulatorService.analytics());
    }
}
