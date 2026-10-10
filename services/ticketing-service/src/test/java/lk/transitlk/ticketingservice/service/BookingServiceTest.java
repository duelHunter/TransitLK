package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.TestData;
import lk.transitlk.ticketingservice.client.PaymentGatewayClient;
import lk.transitlk.ticketingservice.dto.BookingRequest;
import lk.transitlk.ticketingservice.dto.TicketResponse;
import lk.transitlk.ticketingservice.entity.Payment;
import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.repository.PaymentRepository;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    @Mock TripRepository tripRepository;
    @Mock TicketRepository ticketRepository;
    @Mock PaymentRepository paymentRepository;
    @Mock PaymentGatewayClient paymentGatewayClient;
    @Mock TicketSigningService signingService;
    @Mock QrImageService qrImageService;
    @Mock EventPublisher eventPublisher;
    @InjectMocks BookingService bookingService;

    /**
     * The tickets table has a NOT NULL qr_code column, and the QR payload can only be signed once
     * the ticket has an id. Every save must therefore carry a non-null qrCode, including the first.
     */
    @Test
    void everySaveOfTheTicketCarriesANonNullQrCode() {
        Trip trip = TestData.trip(TripStatus.SCHEDULED);
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));
        when(paymentGatewayClient.charge(any(), any()))
                .thenReturn(new PaymentGatewayClient.ChargeResult(true, "CARD-123", "Approved"));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(i -> {
            Payment p = i.getArgument(0);
            p.setPaymentId(UUID.randomUUID());
            return p;
        });
        List<String> qrCodesAtSave = new ArrayList<>();
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(i -> {
            Ticket t = i.getArgument(0);
            qrCodesAtSave.add(t.getQrCode());
            if (t.getTicketId() == null) {
                t.setTicketId(UUID.randomUUID());
            }
            return t;
        });
        when(signingService.sign(any(Ticket.class))).thenReturn("signed.jwt.value");
        when(qrImageService.toBase64Png(eq("signed.jwt.value"))).thenReturn("png");

        TicketResponse response = bookingService.book(UUID.randomUUID(),
                new BookingRequest(trip.getTripId(), 1, "CARD"));

        assertThat(qrCodesAtSave).hasSize(2).doesNotContainNull();
        assertThat(response.qrCode()).isEqualTo("signed.jwt.value");
    }
}
