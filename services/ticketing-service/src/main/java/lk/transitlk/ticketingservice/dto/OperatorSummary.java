package lk.transitlk.ticketingservice.dto;

import lk.transitlk.ticketingservice.entity.TripStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OperatorSummary(BigDecimal totalRevenue, long totalTicketsSold, List<TripStats> trips) {

    public record TripStats(
            UUID tripId,
            String routeName,
            String vehicleReg,
            Instant departureTime,
            TripStatus status,
            long ticketsSold,
            BigDecimal revenue,
            int totalSeats,
            double occupancy
    ) {
    }
}
