package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.TestData;
import lk.transitlk.ticketingservice.dto.CreateTripRequest;
import lk.transitlk.ticketingservice.dto.OperatorSummary;
import lk.transitlk.ticketingservice.dto.TripDto;
import lk.transitlk.ticketingservice.entity.*;
import lk.transitlk.ticketingservice.exception.ApiException;
import lk.transitlk.ticketingservice.repository.RouteRepository;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OperatorServiceTest {

    @Mock TripRepository tripRepository;
    @Mock RouteRepository routeRepository;
    @Mock TicketRepository ticketRepository;
    @Mock EventPublisher eventPublisher;
    @InjectMocks OperatorService operatorService;

    @Test
    void createTripAssignsOwnerAndSeats() {
        Trip template = TestData.trip(TripStatus.SCHEDULED);
        Route route = template.getRoute();
        when(routeRepository.findById(route.getRouteId())).thenReturn(Optional.of(route));
        when(tripRepository.save(any(Trip.class))).thenAnswer(i -> i.getArgument(0));

        TripDto dto = operatorService.createTrip(TestData.OPERATOR_ID, new CreateTripRequest(
                route.getRouteId(), "NB-9999", TestData.DEPARTURE, TestData.DEPARTURE.plusSeconds(7200), 30));

        assertThat(dto.operatorId()).isEqualTo(TestData.OPERATOR_ID);
        assertThat(dto.status()).isEqualTo(TripStatus.SCHEDULED);
        assertThat(dto.totalSeats()).isEqualTo(30);
        assertThat(dto.availableSeats()).isEqualTo(30);
        assertThat(dto.vehicleReg()).isEqualTo("NB-9999");
    }

    @Test
    void createTripRejectsArrivalBeforeDeparture() {
        Trip template = TestData.trip(TripStatus.SCHEDULED);
        Route route = template.getRoute();
        when(routeRepository.findById(route.getRouteId())).thenReturn(Optional.of(route));

        assertThatThrownBy(() -> operatorService.createTrip(TestData.OPERATOR_ID, new CreateTripRequest(
                route.getRouteId(), "NB-9999", TestData.DEPARTURE, TestData.DEPARTURE.minusSeconds(60), 30)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void cancelByAnotherOperatorLooksLikeNotFound() {
        Trip trip = TestData.trip(TripStatus.SCHEDULED);
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));

        assertThatThrownBy(() -> operatorService.cancelTrip(UUID.randomUUID(), trip.getTripId()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void cancelRejectsTripThatAlreadyStarted() {
        Trip trip = TestData.trip(TripStatus.ONGOING);
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));

        assertThatThrownBy(() -> operatorService.cancelTrip(TestData.OPERATOR_ID, trip.getTripId()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void cancelCancelsIssuedTicketsAndNotifiesTheirPassengers() {
        Trip trip = TestData.trip(TripStatus.SCHEDULED);
        Ticket issued = TestData.ticket(trip, TicketStatus.ISSUED, "100.00");
        Ticket validated = TestData.ticket(trip, TicketStatus.VALIDATED, "100.00");
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));
        when(tripRepository.save(trip)).thenReturn(trip);
        when(ticketRepository.findByTrip_TripId(trip.getTripId())).thenReturn(List.of(issued, validated));

        TripDto dto = operatorService.cancelTrip(TestData.OPERATOR_ID, trip.getTripId());

        assertThat(dto.status()).isEqualTo(TripStatus.CANCELLED);
        assertThat(issued.getStatus()).isEqualTo(TicketStatus.CANCELLED);
        assertThat(validated.getStatus()).isEqualTo(TicketStatus.VALIDATED);
        verify(eventPublisher).publishTripEvent("TRIP_CANCELLED", trip, List.of(issued.getPassengerId()));
    }

    @Test
    void summaryCountsOnlyNonCancelledTickets() {
        Trip trip = TestData.trip("Colombo - Kandy Express", TripStatus.COMPLETED, 10, TestData.OPERATOR_ID);
        when(tripRepository.findByOperatorIdOrderByDepartureTimeAsc(TestData.OPERATOR_ID)).thenReturn(List.of(trip));
        when(ticketRepository.findByTrip_TripId(trip.getTripId())).thenReturn(List.of(
                TestData.ticket(trip, TicketStatus.ISSUED, "100.00"),
                TestData.ticket(trip, TicketStatus.VALIDATED, "150.50"),
                TestData.ticket(trip, TicketStatus.CANCELLED, "999.00")));

        OperatorSummary summary = operatorService.summary(TestData.OPERATOR_ID);

        assertThat(summary.totalTicketsSold()).isEqualTo(2);
        assertThat(summary.totalRevenue()).isEqualByComparingTo(new BigDecimal("250.50"));
        assertThat(summary.trips()).hasSize(1);
        assertThat(summary.trips().get(0).occupancy()).isCloseTo(0.2, within(0.0001));
    }
}
