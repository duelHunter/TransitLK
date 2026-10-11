package lk.transitlk.ticketingservice.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lk.transitlk.ticketingservice.controller.BookingController;
import lk.transitlk.ticketingservice.controller.OperatorController;
import lk.transitlk.ticketingservice.controller.TicketValidationController;
import lk.transitlk.ticketingservice.controller.TrackingAccessController;
import lk.transitlk.ticketingservice.controller.TripController;
import lk.transitlk.ticketingservice.security.JwtAuthFilter;
import lk.transitlk.ticketingservice.security.JwtService;
import lk.transitlk.ticketingservice.service.BookingService;
import lk.transitlk.ticketingservice.service.OperatorService;
import lk.transitlk.ticketingservice.service.TicketValidationService;
import lk.transitlk.ticketingservice.service.TrackingAccessService;
import lk.transitlk.ticketingservice.service.TripService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Who may call what. A forbidden call answers 403 before any controller or service runs. */
@WebMvcTest(controllers = {BookingController.class, OperatorController.class, TripController.class,
        TrackingAccessController.class, TicketValidationController.class})
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtService.class})
@TestPropertySource(properties = "transitlk.jwt.secret=test-secret-for-security-rules-test-0123456789")
class SecurityRulesTest {

    private static final String SECRET = "test-secret-for-security-rules-test-0123456789";
    private static final String TICKET = "/api/tickets/00000000-0000-0000-0000-000000000001";
    private static final String BOOKING_JSON =
            "{\"tripId\":\"00000000-0000-0000-0000-000000000002\",\"paymentMethod\":\"CARD\"}";

    @Autowired MockMvc mvc;
    @MockBean BookingService bookingService;
    @MockBean OperatorService operatorService;
    @MockBean TripService tripService;
    @MockBean TrackingAccessService trackingAccessService;
    @MockBean TicketValidationService ticketValidationService;

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

    private void assertAllowed(MockHttpServletRequestBuilder request, String role) throws Exception {
        assertThat(status(request, role)).as("%s should be allowed", role).isNotEqualTo(403);
    }

    private void assertForbidden(MockHttpServletRequestBuilder request, String role) throws Exception {
        assertThat(status(request, role)).as("%s should be forbidden", role).isEqualTo(403);
    }

    @Test
    void onlyPassengersMayBook() throws Exception {
        assertAllowed(post("/api/bookings").contentType(MediaType.APPLICATION_JSON).content(BOOKING_JSON), "PASSENGER");
        for (String role : new String[]{"CONDUCTOR", "OPERATOR", "ADMIN"}) {
            assertForbidden(post("/api/bookings").contentType(MediaType.APPLICATION_JSON).content(BOOKING_JSON), role);
        }
        assertForbidden(post("/api/bookings").contentType(MediaType.APPLICATION_JSON).content(BOOKING_JSON), null);
    }

    @Test
    void onlyPassengersHaveTicketsOfTheirOwn() throws Exception {
        assertAllowed(get("/api/tickets/mine"), "PASSENGER");
        for (String role : new String[]{"CONDUCTOR", "OPERATOR", "ADMIN"}) {
            assertForbidden(get("/api/tickets/mine"), role);
        }
    }

    @Test
    void onlyPassengersCancelOrTrack() throws Exception {
        assertAllowed(post(TICKET + "/cancel"), "PASSENGER");
        assertAllowed(post(TICKET + "/track-token"), "PASSENGER");
        for (String role : new String[]{"CONDUCTOR", "OPERATOR", "ADMIN"}) {
            assertForbidden(post(TICKET + "/cancel"), role);
            assertForbidden(post(TICKET + "/track-token"), role);
        }
    }

    @Test
    void ticketValidationIsForConductorsAndAdmins() throws Exception {
        String body = "{\"qrCode\":\"x.y.z\"}";
        assertAllowed(post("/api/tickets/validate").contentType(MediaType.APPLICATION_JSON).content(body), "CONDUCTOR");
        assertAllowed(post("/api/tickets/validate").contentType(MediaType.APPLICATION_JSON).content(body), "ADMIN");
        assertForbidden(post("/api/tickets/validate").contentType(MediaType.APPLICATION_JSON).content(body), "PASSENGER");
        assertForbidden(post("/api/tickets/validate").contentType(MediaType.APPLICATION_JSON).content(body), "OPERATOR");
    }

    @Test
    void tripControlIsForStaffOnly() throws Exception {
        for (String role : new String[]{"CONDUCTOR", "OPERATOR", "ADMIN"}) {
            assertAllowed(get("/api/trips"), role);
        }
        assertForbidden(get("/api/trips"), "PASSENGER");
    }

    @Test
    void operatorReportsAreForOperatorsOnly() throws Exception {
        assertAllowed(get("/api/operator/reports/summary"), "OPERATOR");
        for (String role : new String[]{"PASSENGER", "CONDUCTOR", "ADMIN"}) {
            assertForbidden(get("/api/operator/reports/summary"), role);
        }
    }

    @Test
    void thereIsNoRegulatorEndpointAnyMore() throws Exception {
        // Authenticated callers fall through to "anyRequest().authenticated()" and find no handler.
        assertThat(status(get("/api/regulator/analytics"), "ADMIN")).isEqualTo(404);
    }
}
