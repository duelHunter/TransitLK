package lk.transitlk.ticketingservice.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lk.transitlk.ticketingservice.entity.Ticket;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;

/**
 * Signs and verifies QR e-ticket payloads with the ticketing service's own key
 * (report FR6 / section 6.3: "QR e-tickets are digitally signed with the ticketing
 * service's private key so validators can verify authenticity even offline"). A
 * conductor app that only has the public verification material - or in this HMAC
 * simplification, the shared signing secret - can verify a ticket's authenticity
 * and expiry without calling back to the server, only the single-use/DB check
 * needs connectivity.
 */
@Service
public class TicketSigningService {

    private final SecretKey key;

    public TicketSigningService(@Value("${transitlk.ticket.signing-secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
    }

    public String sign(Ticket ticket) {
        Date now = new Date();
        return Jwts.builder()
                .subject(ticket.getTicketId().toString())
                .claim("tripId", ticket.getTrip().getTripId().toString())
                .claim("passengerId", ticket.getPassengerId().toString())
                .claim("seatNo", ticket.getSeatNo())
                .claim("fare", ticket.getFare().toString())
                .issuedAt(now)
                .expiration(ticket.getTrip().getArrivalTime() != null
                        ? Date.from(ticket.getTrip().getArrivalTime().plusSeconds(3600))
                        : new Date(now.getTime() + 24L * 3600 * 1000))
                .signWith(key)
                .compact();
    }

    /** Returns parsed claims if the signature and expiry are valid, throws otherwise. */
    public Claims verify(String qrCode) throws JwtException {
        return Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(qrCode)
                .getPayload();
    }
}
