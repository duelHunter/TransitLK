package lk.transitlk.userservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class NotificationEventListenerTest {

    @Mock NotificationService notificationService;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks NotificationEventListener listener;

    private final UUID passenger = UUID.randomUUID();

    @Test
    void ticketIssuedBecomesBookingConfirmation() {
        listener.handle(Map.of("eventType", "TICKET_ISSUED", "passengerId", passenger.toString(), "fare", "222.50"));

        verify(notificationService).create(eq(passenger), eq("TICKET_ISSUED"), eq("Booking confirmed"), contains("222.50"));
    }

    @Test
    void paymentSuccessBecomesReceipt() {
        listener.handle(Map.of("eventType", "PAYMENT_SUCCESS", "passengerId", passenger.toString(),
                "amount", "222.50", "method", "CARD", "txnRef", "TXN-1"));

        verify(notificationService).create(eq(passenger), eq("PAYMENT_SUCCESS"), eq("Payment received"), contains("TXN-1"));
    }

    @Test
    void paymentFailureIsReported() {
        listener.handle(Map.of("eventType", "PAYMENT_FAILED", "passengerId", passenger.toString(),
                "amount", "222.50", "method", "CARD", "txnRef", "TXN-2"));

        verify(notificationService).create(eq(passenger), eq("PAYMENT_FAILED"), eq("Payment failed"), anyString());
    }

    @Test
    void tripStartedNotifiesEveryListedPassenger() {
        UUID other = UUID.randomUUID();
        listener.handle(Map.of("eventType", "TRIP_STARTED", "routeName", "Colombo - Kandy Express",
                "vehicleReg", "NB-1234", "passengerIds", List.of(passenger.toString(), other.toString())));

        verify(notificationService).create(eq(passenger), eq("TRIP_STARTED"), eq("Your bus is on the way"), contains("NB-1234"));
        verify(notificationService).create(eq(other), eq("TRIP_STARTED"), eq("Your bus is on the way"), contains("NB-1234"));
    }

    @Test
    void tripCancelledNotifiesPassengers() {
        listener.handle(Map.of("eventType", "TRIP_CANCELLED", "routeName", "Colombo - Kandy Express",
                "vehicleReg", "NB-1234", "passengerIds", List.of(passenger.toString())));

        verify(notificationService).create(eq(passenger), eq("TRIP_CANCELLED"), eq("Trip cancelled"), contains("Colombo - Kandy Express"));
    }

    @Test
    void unknownEventTypesAreIgnored() {
        listener.handle(Map.of("eventType", "TICKET_VALIDATED", "passengerId", passenger.toString()));

        verify(notificationService, never()).create(any(), anyString(), anyString(), anyString());
    }

    @Test
    void malformedJsonPayloadDoesNotThrow() {
        listener.onEvent("{not json");

        verify(notificationService, never()).create(any(), anyString(), anyString(), anyString());
    }
}
