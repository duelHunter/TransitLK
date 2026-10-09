package lk.transitlk.userservice.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users", uniqueConstraints = {
        @UniqueConstraint(columnNames = "email"),
        @UniqueConstraint(columnNames = "phone")
})
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue
    private UUID userId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String phone;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    /** Only meaningful for PASSENGER role; kept inline to avoid a needless join for the CA-03 prototype. */
    @Column(precision = 12, scale = 2)
    private BigDecimal walletBalance = BigDecimal.ZERO;

    /** OPERATOR-only field (report's FleetOperator specialisation). */
    private String licenseNo;

    @Column(nullable = false)
    private boolean enabled = false;

    private String otpCode;

    private Instant otpExpiresAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
