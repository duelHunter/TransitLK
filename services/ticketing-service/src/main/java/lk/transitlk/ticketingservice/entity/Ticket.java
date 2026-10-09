package lk.transitlk.ticketingservice.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tickets")
@Getter
@Setter
@NoArgsConstructor
public class Ticket {

    @Id
    @GeneratedValue
    private UUID ticketId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @Column(nullable = false)
    private UUID passengerId;

    private Integer seatNo;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal fare;

    /** Digitally-signed QR payload (compact JWS) - report FR6, verifiable offline. */
    @Lob
    @Column(nullable = false)
    private String qrCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketStatus status = TicketStatus.ISSUED;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_id")
    private Payment payment;

    @Column(nullable = false, updatable = false)
    private Instant issuedAt = Instant.now();

    private Instant validatedAt;
}
