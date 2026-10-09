package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.entity.Payment;
import lk.transitlk.ticketingservice.entity.Ticket;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

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
}
