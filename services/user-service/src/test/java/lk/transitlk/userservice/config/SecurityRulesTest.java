package lk.transitlk.userservice.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lk.transitlk.userservice.controller.NotificationController;
import lk.transitlk.userservice.security.JwtAuthFilter;
import lk.transitlk.userservice.security.JwtService;
import lk.transitlk.userservice.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@WebMvcTest(controllers = NotificationController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtService.class})
@TestPropertySource(properties = {
        "transitlk.jwt.secret=test-secret-for-security-rules-test-0123456789",
        "transitlk.jwt.expiration-seconds=3600"})
class SecurityRulesTest {

    private static final String SECRET = "test-secret-for-security-rules-test-0123456789";

    @Autowired MockMvc mvc;
    @MockBean NotificationService notificationService;

    private static String token(String role) {
        return "Bearer " + Jwts.builder()
                .subject(UUID.randomUUID().toString())
                .claim("role", role)
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes()), Jwts.SIG.HS256)
                .compact();
    }

    private int status(MockHttpServletRequestBuilder request, String role) throws Exception {
        if (role != null) {
            request.header("Authorization", token(role));
        }
        return mvc.perform(request).andReturn().getResponse().getStatus();
    }

    @Test
    void passengersReadTheirNotifications() throws Exception {
        when(notificationService.list(org.mockito.ArgumentMatchers.any())).thenReturn(List.of());
        assertThat(status(get("/api/notifications"), "PASSENGER")).isEqualTo(200);
    }

    @Test
    void staffRolesHaveNoNotifications() throws Exception {
        for (String role : new String[]{"CONDUCTOR", "OPERATOR", "ADMIN"}) {
            assertThat(status(get("/api/notifications"), role)).as(role).isEqualTo(403);
            assertThat(status(post("/api/notifications/" + UUID.randomUUID() + "/read"), role)).as(role).isEqualTo(403);
        }
    }

    @Test
    void anonymousCallersAreRefused() throws Exception {
        assertThat(status(get("/api/notifications"), null)).isEqualTo(403);
    }
}
