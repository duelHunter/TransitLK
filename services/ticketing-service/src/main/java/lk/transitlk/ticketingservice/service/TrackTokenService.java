package lk.transitlk.ticketingservice.service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lk.transitlk.ticketingservice.dto.TrackTokenResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Issues short-lived tokens that let a ticket holder watch exactly one vehicle. The tracking
 * service verifies them with the same secret and never calls back into ticketing.
 */
@Service
public class TrackTokenService {

    private static final long TTL_SECONDS = 30 * 60;

    private final SecretKey key;

    public TrackTokenService(@Value("${transitlk.tracking.token-secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
    }

    public TrackTokenResponse issue(UUID ticketId, String vehicleReg) {
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(TTL_SECONDS);
        String token = Jwts.builder()
                .subject(ticketId.toString())
                .claim("purpose", "track")
                .claim("vehicleReg", vehicleReg)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
        return new TrackTokenResponse(token, vehicleReg, expiresAt);
    }
}
