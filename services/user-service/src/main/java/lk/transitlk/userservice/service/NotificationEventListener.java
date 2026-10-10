package lk.transitlk.userservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Turns domain events from ticketing into passenger notifications. Payloads are read as plain
 * JSON strings so no producer type headers or trusted-package configuration is needed.
 */
@Component
public class NotificationEventListener {

    private static final Logger log = LoggerFactory.getLogger(NotificationEventListener.class);

    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    public NotificationEventListener(NotificationService notificationService, ObjectMapper objectMapper) {
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = {"ticket-events", "payment-events", "trip-events"})
    public void onEvent(String payload) {
        try {
            handle(objectMapper.readValue(payload, new TypeReference<Map<String, Object>>() {
            }));
        } catch (Exception e) {
            log.warn("Skipping unreadable event: {}", e.getMessage());
        }
    }

    public void handle(Map<String, Object> event) {
        String type = String.valueOf(event.get("eventType"));
        switch (type) {
            case "TICKET_ISSUED" -> toPassenger(event, type, "Booking confirmed",
                    "Your ticket is confirmed. Fare: Rs. " + event.get("fare"));
            case "TICKET_CANCELLED" -> toPassenger(event, type, "Ticket cancelled",
                    "Your ticket has been cancelled.");
            case "PAYMENT_SUCCESS" -> toPassenger(event, type, "Payment received",
                    "Rs. " + event.get("amount") + " paid via " + event.get("method")
                            + " (ref " + event.get("txnRef") + ").");
            case "PAYMENT_FAILED" -> toPassenger(event, type, "Payment failed",
                    "Your payment of Rs. " + event.get("amount") + " could not be processed (ref "
                            + event.get("txnRef") + ").");
            case "TRIP_STARTED" -> toAll(event, type, "Your bus is on the way",
                    event.get("routeName") + " (" + event.get("vehicleReg") + ") has departed. You can now track it live.");
            case "TRIP_CANCELLED" -> toAll(event, type, "Trip cancelled",
                    event.get("routeName") + " was cancelled by the operator.");
            default -> {
                // not a passenger-facing event
            }
        }
    }

    private void toPassenger(Map<String, Object> event, String type, String title, String message) {
        notificationService.create(UUID.fromString(String.valueOf(event.get("passengerId"))), type, title, message);
    }

    private void toAll(Map<String, Object> event, String type, String title, String message) {
        Object ids = event.get("passengerIds");
        if (ids instanceof List<?> list) {
            for (Object id : list) {
                notificationService.create(UUID.fromString(String.valueOf(id)), type, title, message);
            }
        }
    }
}
