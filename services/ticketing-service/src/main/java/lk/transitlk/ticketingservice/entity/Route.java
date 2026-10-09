package lk.transitlk.ticketingservice.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "routes")
@Getter
@Setter
@NoArgsConstructor
public class Route {

    @Id
    @GeneratedValue
    private UUID routeId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String origin;

    @Column(nullable = false)
    private String destination;

    @Column(nullable = false)
    private double distanceKm;

    /** Fare-stage model, simplified to base fare + per-km rate (report FR4). */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal baseFare;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal farePerKm;

    public BigDecimal calculateFare() {
        return baseFare.add(farePerKm.multiply(BigDecimal.valueOf(distanceKm)));
    }
}
