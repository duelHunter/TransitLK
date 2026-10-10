package lk.transitlk.ticketingservice.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lk.transitlk.ticketingservice.TestData;
import lk.transitlk.ticketingservice.dto.TrackTokenResponse;
import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.TicketStatus;
import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.exception.ApiException;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TrackingAccessServiceTest {

    private static final String SECRET = "transitlk-tracking-token-secret-32bytes-min";

    @Mock TicketRepository ticketRepository;
    TrackingAccessService service;

    @BeforeEach
    void setUp() {
        service = new TrackingAccessService(ticketRepository, new TrackTokenService(SECRET));
    }

    private Ticket ticketOn(TripStatus tripStatus, TicketStatus ticketStatus) {
        Trip trip = TestData.trip(tripStatus);
        Ticket ticket = TestData.ticket(trip, ticketStatus, "100.00");
        when(ticketRepository.findById(ticket.getTicketId())).thenReturn(Optional.of(ticket));
        return ticket;
    }

    private static void assertStatus(Runnable call, HttpStatus expected) {
        assertThatThrownBy(call::run)
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(expected);
    }

    @Test
    void ownerOfActiveTicketOnOngoingTripGetsVehicleScopedToken() {
        Ticket ticket = ticketOn(TripStatus.ONGOING, TicketStatus.ISSUED);

        TrackTokenResponse resp = service.issueFor(ticket.getTicketId(), ticket.getPassengerId());

        Claims claims = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes()))
                .build().parseSignedClaims(resp.token()).getPayload();
        assertThat(claims.getSubject()).isEqualTo(ticket.getTicketId().toString());
        assertThat(claims.get("vehicleReg", String.class)).isEqualTo("NB-1234");
        assertThat(claims.get("purpose", String.class)).isEqualTo("track");
        assertThat(resp.vehicleReg()).isEqualTo("NB-1234");
    }

    @Test
    void validatedTicketStillGetsToken() {
        Ticket ticket = ticketOn(TripStatus.ONGOING, TicketStatus.VALIDATED);

        assertThat(service.issueFor(ticket.getTicketId(), ticket.getPassengerId()).token()).isNotBlank();
    }

    @Test
    void nonOwnerIsForbidden() {
        Ticket ticket = ticketOn(TripStatus.ONGOING, TicketStatus.ISSUED);

        assertStatus(() -> service.issueFor(ticket.getTicketId(), UUID.randomUUID()), HttpStatus.FORBIDDEN);
    }

    @Test
    void cancelledTicketIsRejected() {
        Ticket ticket = ticketOn(TripStatus.ONGOING, TicketStatus.CANCELLED);

        assertStatus(() -> service.issueFor(ticket.getTicketId(), ticket.getPassengerId()), HttpStatus.CONFLICT);
    }

    @Test
    void tripThatIsNotOngoingIsRejected() {
        Ticket ticket = ticketOn(TripStatus.SCHEDULED, TicketStatus.ISSUED);

        assertStatus(() -> service.issueFor(ticket.getTicketId(), ticket.getPassengerId()), HttpStatus.CONFLICT);
    }

    @Test
    void unknownTicketIsNotFound() {
        UUID id = UUID.randomUUID();
        when(ticketRepository.findById(id)).thenReturn(Optional.empty());

        assertStatus(() -> service.issueFor(id, UUID.randomUUID()), HttpStatus.NOT_FOUND);
    }
}
