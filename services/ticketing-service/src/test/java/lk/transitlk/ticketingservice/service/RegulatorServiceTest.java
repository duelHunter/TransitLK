package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.TestData;
import lk.transitlk.ticketingservice.dto.RegulatorAnalytics;
import lk.transitlk.ticketingservice.dto.RegulatorAnalytics.RouteAnalytics;
import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.TicketStatus;
import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegulatorServiceTest {

    @Mock TripRepository tripRepository;
    @Mock TicketRepository ticketRepository;
    @InjectMocks RegulatorService regulatorService;

    @Test
    void aggregatesPerRouteAndOperator() {
        Trip early = TestData.trip("Colombo - Kandy Express", TripStatus.COMPLETED, 10, TestData.OPERATOR_ID);
        early.setStartedAt(TestData.DEPARTURE.plusSeconds(5 * 60));
        Trip late = TestData.trip("Colombo - Kandy Express", TripStatus.COMPLETED, 10, TestData.OPERATOR_ID);
        late.setStartedAt(TestData.DEPARTURE.plusSeconds(15 * 60));
        Trip cancelled = TestData.trip("Colombo - Galle Highway", TripStatus.CANCELLED, 10, TestData.OPERATOR_ID);

        List<Ticket> tickets = new ArrayList<>();
        tickets.add(TestData.ticket(early, TicketStatus.ISSUED, "100.00"));
        tickets.add(TestData.ticket(early, TicketStatus.VALIDATED, "100.00"));
        tickets.add(TestData.ticket(early, TicketStatus.CANCELLED, "100.00"));
        for (int i = 0; i < 4; i++) {
            tickets.add(TestData.ticket(late, TicketStatus.VALIDATED, "100.00"));
        }
        when(tripRepository.findAll()).thenReturn(List.of(early, late, cancelled));
        when(ticketRepository.findAll()).thenReturn(tickets);

        RegulatorAnalytics result = regulatorService.analytics();

        assertThat(result.totalTrips()).isEqualTo(3);
        assertThat(result.totalTicketsSold()).isEqualTo(6);
        assertThat(result.totalRevenue()).isEqualByComparingTo(new BigDecimal("600.00"));
        assertThat(result.routes()).hasSize(2);

        RouteAnalytics galle = result.routes().get(0);
        assertThat(galle.routeName()).isEqualTo("Colombo - Galle Highway");
        assertThat(galle.cancelledTrips()).isEqualTo(1);
        assertThat(galle.ticketsSold()).isZero();
        assertThat(galle.avgDelayMinutes()).isNull();

        RouteAnalytics kandy = result.routes().get(1);
        assertThat(kandy.routeName()).isEqualTo("Colombo - Kandy Express");
        assertThat(kandy.trips()).isEqualTo(2);
        assertThat(kandy.ticketsSold()).isEqualTo(6);
        assertThat(kandy.revenue()).isEqualByComparingTo(new BigDecimal("600.00"));
        assertThat(kandy.avgOccupancy()).isCloseTo(0.3, within(0.0001));
        assertThat(kandy.avgDelayMinutes()).isCloseTo(10.0, within(0.01));
    }
}
