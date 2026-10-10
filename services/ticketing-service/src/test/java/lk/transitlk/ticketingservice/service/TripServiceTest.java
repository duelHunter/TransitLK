package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.TestData;
import lk.transitlk.ticketingservice.dto.ManifestEntry;
import lk.transitlk.ticketingservice.dto.TripDto;
import lk.transitlk.ticketingservice.entity.*;
import lk.transitlk.ticketingservice.exception.ApiException;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripServiceTest {

    @Mock TripRepository tripRepository;
    @Mock TicketRepository ticketRepository;
    @Mock EventPublisher eventPublisher;
    @InjectMocks TripService tripService;

    @Test
    void startMarksOngoingStampsStartedAtAndNotifiesActivePassengers() {
        Trip trip = TestData.trip(TripStatus.SCHEDULED);
        Ticket issued = TestData.ticket(trip, TicketStatus.ISSUED, "100.00");
        Ticket cancelled = TestData.ticket(trip, TicketStatus.CANCELLED, "100.00");
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));
        when(tripRepository.save(trip)).thenReturn(trip);
        when(ticketRepository.findByTrip_TripId(trip.getTripId())).thenReturn(List.of(issued, cancelled));

        TripDto dto = tripService.start(trip.getTripId());

        assertThat(dto.status()).isEqualTo(TripStatus.ONGOING);
        assertThat(dto.startedAt()).isNotNull();
        verify(eventPublisher).publishTripEvent("TRIP_STARTED", trip, List.of(issued.getPassengerId()));
    }

    @Test
    void startRejectsTripThatIsNotScheduled() {
        Trip trip = TestData.trip(TripStatus.ONGOING);
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));

        assertThatThrownBy(() -> tripService.start(trip.getTripId()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT);
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void completeReconcilesNonCancelledTicketsAgainstValidated() {
        Trip trip = TestData.trip(TripStatus.ONGOING);
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));
        when(tripRepository.save(trip)).thenReturn(trip);
        when(ticketRepository.findByTrip_TripId(trip.getTripId())).thenReturn(List.of(
                TestData.ticket(trip, TicketStatus.ISSUED, "100.00"),
                TestData.ticket(trip, TicketStatus.VALIDATED, "100.00"),
                TestData.ticket(trip, TicketStatus.CANCELLED, "100.00")));

        TripService.TripReconciliation result = tripService.complete(trip.getTripId());

        assertThat(result.trip().status()).isEqualTo(TripStatus.COMPLETED);
        assertThat(result.ticketsIssued()).isEqualTo(2);
        assertThat(result.ticketsValidated()).isEqualTo(1);
    }

    @Test
    void listWithoutFilterReturnsAllTripsAsDtos() {
        Trip trip = TestData.trip(TripStatus.SCHEDULED);
        when(tripRepository.findAllByOrderByDepartureTimeAsc()).thenReturn(List.of(trip));

        List<TripDto> result = tripService.list(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).routeName()).isEqualTo("Colombo - Kandy Express");
    }

    @Test
    void listWithStatusFiltersByStatus() {
        Trip trip = TestData.trip(TripStatus.ONGOING);
        when(tripRepository.findByStatusOrderByDepartureTimeAsc(TripStatus.ONGOING)).thenReturn(List.of(trip));

        assertThat(tripService.list(TripStatus.ONGOING)).hasSize(1);
    }

    @Test
    void manifestListsTicketsOfTheTrip() {
        Trip trip = TestData.trip(TripStatus.ONGOING);
        Ticket ticket = TestData.ticket(trip, TicketStatus.VALIDATED, "100.00");
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));
        when(ticketRepository.findByTrip_TripId(trip.getTripId())).thenReturn(List.of(ticket));

        List<ManifestEntry> manifest = tripService.manifest(trip.getTripId());

        assertThat(manifest).hasSize(1);
        assertThat(manifest.get(0).ticketId()).isEqualTo(ticket.getTicketId());
        assertThat(manifest.get(0).status()).isEqualTo(TicketStatus.VALIDATED);
    }
}
