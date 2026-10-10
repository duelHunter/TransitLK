package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.entity.Payment;
import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.Trip;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(EventPublisher.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public EventPublisher(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishTicketIssued(Ticket ticket) {
        publishTicketEvent("TICKET_ISSUED", ticket);
    }

    public void publishTicketValidated(Ticket ticket) {
        publishTicketEvent("TICKET_VALIDATED", ticket);
    }

    public void publishTicketCancelled(Ticket ticket) {
        publishTicketEvent("TICKET_CANCELLED", ticket);
    }

    private void publishTicketEvent(String eventType, Ticket ticket) {
        Map<String, Object> event = Map.of(
                "eventType", eventType,
                "ticketId", ticket.getTicketId().toString(),
                "tripId", ticket.getTrip().getTripId().toString(),
                "passengerId", ticket.getPassengerId().toString(),
                "fare", ticket.getFare().toString(),
                "status", ticket.getStatus().name(),
                "timestamp", Instant.now().toString()
        );
        kafkaTemplate.send("ticket-events", ticket.getTicketId().toString(), event)
                .whenComplete((r, ex) -> {
                    if (ex != null) log.warn("Failed to publish {} event: {}", eventType, ex.getMessage());
                });
    }

    public void publishPaymentProcessed(Payment payment, java.util.UUID passengerId) {
        Map<String, Object> event = Map.of(
                "eventType", "PAYMENT_" + payment.getStatus().name(),
                "paymentId", payment.getPaymentId().toString(),
                "passengerId", passengerId.toString(),
                "amount", payment.getAmount().toString(),
                "method", payment.getMethod().name(),
                "txnRef", payment.getTxnRef(),
                "timestamp", Instant.now().toString()
        );
        kafkaTemplate.send("payment-events", payment.getPaymentId().toString(), event)
                .whenComplete((r, ex) -> {
                    if (ex != null) log.warn("Failed to publish payment event: {}", ex.getMessage());
                });
    }

    public void publishTripEvent(String eventType, Trip trip, List<UUID> passengerIds) {
        Map<String, Object> event = Map.of(
                "eventType", eventType,
                "tripId", trip.getTripId().toString(),
                "routeName", trip.getRoute().getName(),
                "vehicleReg", trip.getVehicleReg(),
                "passengerIds", passengerIds.stream().map(UUID::toString).toList(),
                "timestamp", Instant.now().toString()
        );
        kafkaTemplate.send("trip-events", trip.getTripId().toString(), event)
                .whenComplete((r, ex) -> {
                    if (ex != null) log.warn("Failed to publish {} event: {}", eventType, ex.getMessage());
                });
    }
}
