package lk.transitlk.ticketingservice.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;

/**
 * Verifies JWTs issued by user-service. Both services share the same signing secret
 * (transitlk.jwt.secret) - a common pattern for stateless inter-service auth without
 * a central session store.
 */
@Service
public class JwtService {

    private final SecretKey key;

    public JwtService(@Value("${transitlk.jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
    }

    public Claims parseClaims(String token) {
        return Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
