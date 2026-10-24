package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.entity.Ticket;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ticket.qrCode is a @Lob, which PostgreSQL stores as a large object. Reading one outside a
 * transaction fails with "Unable to access lob stream", and H2-based tests cannot show that, so the
 * rule is pinned here: every BookingService method that returns ticket data runs in a transaction.
 */
class BookingServiceTransactionTest {

    @Test
    void ticketQrCodeIsStillALargeObject() throws Exception {
        Field qrCode = Ticket.class.getDeclaredField("qrCode");
        assertThat(qrCode.isAnnotationPresent(jakarta.persistence.Lob.class))
                .as("if this changes, re-check whether the transaction rule below is still needed")
                .isTrue();
    }

    @Test
    void methodsThatReadTicketsRunInATransaction() throws Exception {
        Method myTickets = BookingService.class.getMethod("myTickets", UUID.class);
        Method getTicket = BookingService.class.getMethod("getTicket", UUID.class, UUID.class, boolean.class);

        assertThat(myTickets.getReturnType()).isEqualTo(List.class);
        assertThat(myTickets.isAnnotationPresent(Transactional.class)).as("myTickets").isTrue();
        assertThat(getTicket.isAnnotationPresent(Transactional.class)).as("getTicket").isTrue();
    }
}
