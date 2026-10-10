package lk.transitlk.ticketingservice.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record RegulatorAnalytics(long totalTrips, long totalTicketsSold, BigDecimal totalRevenue,
                                 List<RouteAnalytics> routes) {

    public record RouteAnalytics(
            String routeName,
            UUID operatorId,
            long trips,
            long cancelledTrips,
            long ticketsSold,
            BigDecimal revenue,
            double avgOccupancy,
            Double avgDelayMinutes
    ) {
    }
}
