# TransitLK Backend Foundation Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the backend for conductor trip controls, operator reports, regulator analytics, Kafka-driven notifications and ticket-gated live tracking.

**Architecture:** Changes stay inside the existing three services (user-service, ticketing-service, tracking-service). Ticketing issues a short-lived tracking JWT to ticket owners; tracking-service verifies it and scopes WebSocket/REST access to the one vehicle in the token. User-service consumes `ticket-events`, `payment-events` and a new `trip-events` topic to create notifications.

**Tech Stack:** Java 17, Spring Boot, JPA, Kafka, jjwt 0.12 (existing); NestJS, socket.io, `jsonwebtoken` (new, tracking-service); JUnit 5 + Mockito + H2 `@DataJpaTest`; `node:test` for tracking-service.

**Spec:** `docs/superpowers/specs/2026-10-09-transitlk-local-demo-scope-design.md`

This is plan 1 of 3. Plan 2 covers the web portal pages (`/trips`, `/operator`, `/regulator`, staff Live Map, offline queue). Plan 3 covers the Expo passenger app. **After Task 6 the existing web Live Map stops working** (it connects without a token); Plan 2 restores it as a staff-only page.

## Global Constraints

- Work in `E:\Aca\Semester-08\Software Architecture\project\project`. The repo already has git on branch `main` (one commit, "first"); `docs/` is untracked, so commit it in Task 1.
- Java services use Java 17, Lombok `@Getter/@Setter`, records for DTOs, and `ApiException(HttpStatus, String)` for errors (same class in both Java services).
- Services use `spring.jpa.hibernate.ddl-auto: update`. New columns need no migration, but already-seeded databases keep trips with `operatorId = null`. Reset local data with `docker compose down -v` before the end-to-end run.
- JWTs from user-service carry `sub` = user id and claim `role` (`PASSENGER|CONDUCTOR|OPERATOR|ADMIN|REGULATOR`). Shared secret env var `JWT_SECRET`.
- Demo accounts (password `demo1234`, enabled): `operator@transitlk.lk`, `conductor@transitlk.lk`, `regulator@transitlk.lk`, `passenger@transitlk.lk`. Fixed user ids end in `a1` (operator), `a2` (conductor), `a3` (regulator), `a4` (passenger), format `00000000-0000-0000-0000-0000000000a1`.
- Tracking token secret env var is `TRACKING_TOKEN_SECRET`, default `transitlk-tracking-token-secret-32bytes-min`. Token algorithm is HS256; claims `sub` = ticket id, `purpose` = `track`, `vehicleReg`.
- `POST /api/telemetry` stays unauthenticated (decided with the user).
- Deviations from the spec, deliberate: `operatorId` is stored on `Trip` only (routes stay a shared catalogue); operator and regulator figures are computed in Java from repository results, not SQL aggregates; `/api/operator/**` is `OPERATOR` only (an `ADMIN` owns no trips; admins use `/api/regulator/**`).
- Run Java tests with `mvn -q test` from the service folder; run a single class with `-Dtest=ClassName`.

## File Structure

user-service (`services/user-service/src/main/java/lk/transitlk/userservice/`):
- Modify `entity/Role.java`, `entity/User.java` (assigned ids), `config/KafkaTopicConfig.java`, `src/main/resources/application.yml`
- Create `config/DemoUserSeeder.java`, `entity/Notification.java`, `repository/NotificationRepository.java`, `dto/NotificationResponse.java`, `service/NotificationService.java`, `service/NotificationEventListener.java`, `controller/NotificationController.java`
- Tests in `src/test/java/lk/transitlk/userservice/...`

ticketing-service (`services/ticketing-service/src/main/java/lk/transitlk/ticketingservice/`):
- Modify `entity/Trip.java`, `repository/TripRepository.java`, `service/TripService.java`, `service/EventPublisher.java`, `controller/TripController.java`, `config/SecurityConfig.java`, `config/KafkaTopicConfig.java`, `config/DataSeeder.java`, `src/main/resources/application.yml`
- Create `dto/TripDto.java`, `dto/ManifestEntry.java`, `dto/CreateTripRequest.java`, `dto/OperatorSummary.java`, `dto/RegulatorAnalytics.java`, `dto/TrackTokenResponse.java`, `service/OperatorService.java`, `service/RegulatorService.java`, `service/TrackTokenService.java`, `service/TrackingAccessService.java`, `controller/OperatorController.java`, `controller/RegulatorController.java`, `controller/TrackingAccessController.java`
- Tests in `src/test/java/lk/transitlk/ticketingservice/...` (shared helper `TestData.java`)

tracking-service (`services/tracking-service/`):
- Create `src/auth/access.service.ts`, `src/auth/auth.module.ts`, `src/auth/access.service.spec.ts`
- Modify `package.json`, `src/location/location.gateway.ts`, `src/location/location.module.ts`, `src/vehicles/vehicles.controller.ts`, `src/vehicles/vehicles.module.ts`

Other: `gateway/kong.yml`, `docker-compose.yml`, `scripts/smoke-backend.mjs`, `README.md`.

---

### Task 1: user-service REGULATOR role and demo accounts

**Files:**
- Modify: `services/user-service/src/main/java/lk/transitlk/userservice/entity/Role.java`
- Modify: `services/user-service/src/main/java/lk/transitlk/userservice/entity/User.java`
- Create: `services/user-service/src/main/java/lk/transitlk/userservice/config/DemoUserSeeder.java`
- Test: `services/user-service/src/test/java/lk/transitlk/userservice/config/DemoUserSeederTest.java`

**Interfaces:**
- Produces: `Role.REGULATOR`; `DemoUserSeeder` with public constants `OPERATOR_ID`, `CONDUCTOR_ID`, `REGULATOR_ID`, `PASSENGER_ID` (all `java.util.UUID`) and `run(String... args)`.

- [ ] **Step 1: Commit the spec and plan**

```bash
git add docs
git commit -m "docs: add local demo scope spec and backend plan"
```

- [ ] **Step 2: Write the failing test**

```java
package lk.transitlk.userservice.config;

import lk.transitlk.userservice.entity.Role;
import lk.transitlk.userservice.entity.User;
import lk.transitlk.userservice.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class DemoUserSeederTest {

    @Autowired
    UserRepository userRepository;

    @Test
    void seedsFourEnabledUsersWithFixedIds() {
        new DemoUserSeeder(userRepository, new BCryptPasswordEncoder()).run();

        assertThat(userRepository.count()).isEqualTo(4);
        User operator = userRepository.findById(DemoUserSeeder.OPERATOR_ID).orElseThrow();
        assertThat(operator.getRole()).isEqualTo(Role.OPERATOR);
        assertThat(operator.isEnabled()).isTrue();
        assertThat(operator.getEmail()).isEqualTo("operator@transitlk.lk");
        assertThat(userRepository.findById(DemoUserSeeder.REGULATOR_ID).orElseThrow().getRole())
                .isEqualTo(Role.REGULATOR);
    }

    @Test
    void runningTwiceDoesNotDuplicate() {
        DemoUserSeeder seeder = new DemoUserSeeder(userRepository, new BCryptPasswordEncoder());
        seeder.run();
        seeder.run();

        assertThat(userRepository.count()).isEqualTo(4);
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run (in `services/user-service`): `mvn -q test -Dtest=DemoUserSeederTest`
Expected: FAIL, compilation error "cannot find symbol DemoUserSeeder".

- [ ] **Step 4: Add the role**

In `Role.java` replace the body with:

```java
public enum Role {
    PASSENGER,
    CONDUCTOR,
    OPERATOR,
    ADMIN,
    REGULATOR
}
```

- [ ] **Step 5: Allow assigned ids on User**

In `User.java` remove the `@GeneratedValue` line above `private UUID userId;` and add this method inside the class (the file already imports `jakarta.persistence.*`):

```java
    @PrePersist
    void ensureId() {
        if (userId == null) {
            userId = UUID.randomUUID();
        }
    }
```

- [ ] **Step 6: Write the seeder**

```java
package lk.transitlk.userservice.config;

import lk.transitlk.userservice.entity.Role;
import lk.transitlk.userservice.entity.User;
import lk.transitlk.userservice.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Seeds one enabled account per staff role plus a passenger so the local demo needs no OTP step. */
@Component
@ConditionalOnProperty(name = "transitlk.demo.seed-users", havingValue = "true", matchIfMissing = true)
public class DemoUserSeeder implements CommandLineRunner {

    public static final UUID OPERATOR_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    public static final UUID CONDUCTOR_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a2");
    public static final UUID REGULATOR_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a3");
    public static final UUID PASSENGER_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a4");

    private static final String DEMO_PASSWORD = "demo1234";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DemoUserSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        seed(OPERATOR_ID, "Demo Operator", "operator@transitlk.lk", "0710000001", Role.OPERATOR);
        seed(CONDUCTOR_ID, "Demo Conductor", "conductor@transitlk.lk", "0710000002", Role.CONDUCTOR);
        seed(REGULATOR_ID, "Demo Regulator (NTC)", "regulator@transitlk.lk", "0710000003", Role.REGULATOR);
        seed(PASSENGER_ID, "Demo Passenger", "passenger@transitlk.lk", "0710000004", Role.PASSENGER);
    }

    private void seed(UUID id, String name, String email, String phone, Role role) {
        if (userRepository.existsById(id) || userRepository.existsByEmail(email)) {
            return;
        }
        User user = new User();
        user.setUserId(id);
        user.setName(name);
        user.setEmail(email);
        user.setPhone(phone);
        user.setPasswordHash(passwordEncoder.encode(DEMO_PASSWORD));
        user.setRole(role);
        user.setEnabled(true);
        userRepository.save(user);
    }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `mvn -q test -Dtest=DemoUserSeederTest`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add services/user-service
git commit -m "feat(user): add REGULATOR role and demo account seeder"
```

---

### Task 2: ticketing trip controls (list, manifest, start, complete)

**Files:**
- Modify: `.../entity/Trip.java`, `.../repository/TripRepository.java`, `.../service/TripService.java`, `.../service/EventPublisher.java`, `.../controller/TripController.java`, `.../config/SecurityConfig.java`, `.../config/KafkaTopicConfig.java`, `.../config/DataSeeder.java`
- Create: `.../dto/TripDto.java`, `.../dto/ManifestEntry.java`
- Test: `src/test/java/lk/transitlk/ticketingservice/TestData.java`, `src/test/java/lk/transitlk/ticketingservice/service/TripServiceTest.java`

(All paths under `services/ticketing-service/src/main/java/lk/transitlk/ticketingservice/` unless they start with `src/test`.)

**Interfaces:**
- Produces:
  - `Trip.operatorId` (`UUID`, nullable), `Trip.startedAt` (`Instant`, nullable).
  - `record TripDto(UUID tripId, UUID routeId, String routeName, String origin, String destination, String vehicleReg, Instant departureTime, Instant arrivalTime, TripStatus status, int totalSeats, int availableSeats, UUID operatorId, Instant startedAt)` with `static TripDto from(Trip)`.
  - `record ManifestEntry(UUID ticketId, UUID passengerId, Integer seatNo, TicketStatus status, Instant validatedAt)` with `static ManifestEntry from(Ticket)`.
  - `EventPublisher.publishTripEvent(String eventType, Trip trip, List<UUID> passengerIds)` publishing to topic `trip-events` with keys `eventType, tripId, routeName, vehicleReg, passengerIds (list of strings), timestamp`.
  - `TripService(TripRepository, TicketRepository, EventPublisher)` with `List<TripDto> list(TripStatus status /*nullable*/)`, `List<ManifestEntry> manifest(UUID)`, `TripDto start(UUID)`, `TripReconciliation complete(UUID)`; `record TripReconciliation(TripDto trip, long ticketsIssued, long ticketsValidated)` (nested in `TripService`; "issued" now excludes cancelled tickets).
  - `TripRepository.findAllByOrderByDepartureTimeAsc()`, `findByStatusOrderByDepartureTimeAsc(TripStatus)`, `findByOperatorIdOrderByDepartureTimeAsc(UUID)`.
  - `TestData.OPERATOR_ID`, `TestData.trip(TripStatus)`, `TestData.trip(String routeName, TripStatus, int totalSeats, UUID operatorId)`, `TestData.ticket(Trip, TicketStatus, String fare)`.
  - `DataSeeder.DEMO_OPERATOR_ID` (equals user-service `DemoUserSeeder.OPERATOR_ID`).

- [ ] **Step 1: Write the test helper**

Create `src/test/java/lk/transitlk/ticketingservice/TestData.java`:

```java
package lk.transitlk.ticketingservice;

import lk.transitlk.ticketingservice.entity.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class TestData {

    public static final UUID OPERATOR_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    public static final Instant DEPARTURE = Instant.parse("2026-10-10T08:00:00Z");

    private TestData() {
    }

    public static Trip trip(TripStatus status) {
        return trip("Colombo - Kandy Express", status, 40, OPERATOR_ID);
    }

    public static Trip trip(String routeName, TripStatus status, int totalSeats, UUID operatorId) {
        Route route = new Route();
        route.setRouteId(UUID.nameUUIDFromBytes(routeName.getBytes()));
        route.setName(routeName);
        route.setOrigin("Colombo");
        route.setDestination("Kandy");
        route.setDistanceKm(115);
        route.setBaseFare(new BigDecimal("50"));
        route.setFarePerKm(new BigDecimal("1.50"));

        Trip trip = new Trip();
        trip.setTripId(UUID.randomUUID());
        trip.setRoute(route);
        trip.setVehicleReg("NB-1234");
        trip.setDepartureTime(DEPARTURE);
        trip.setArrivalTime(DEPARTURE.plusSeconds(3 * 3600));
        trip.setStatus(status);
        trip.setTotalSeats(totalSeats);
        trip.setAvailableSeats(totalSeats);
        trip.setOperatorId(operatorId);
        return trip;
    }

    public static Ticket ticket(Trip trip, TicketStatus status, String fare) {
        Ticket ticket = new Ticket();
        ticket.setTicketId(UUID.randomUUID());
        ticket.setTrip(trip);
        ticket.setPassengerId(UUID.randomUUID());
        ticket.setSeatNo(1);
        ticket.setFare(new BigDecimal(fare));
        ticket.setStatus(status);
        return ticket;
    }
}
```

- [ ] **Step 2: Write the failing service test**

Create `src/test/java/lk/transitlk/ticketingservice/service/TripServiceTest.java`:

```java
package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.TestData;
import lk.transitlk.ticketingservice.dto.ManifestEntry;
import lk.transitlk.ticketingservice.dto.TripDto;
import lk.transitlk.ticketingservice.entity.*;
import lk.transitlk.ticketingservice.exception.ApiException;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripServiceTest {

    @Mock TripRepository tripRepository;
    @Mock TicketRepository ticketRepository;
    @Mock EventPublisher eventPublisher;
    @InjectMocks TripService tripService;

    @Test
    void startMarksOngoingStampsStartedAtAndNotifiesActivePassengers() {
        Trip trip = TestData.trip(TripStatus.SCHEDULED);
        Ticket issued = TestData.ticket(trip, TicketStatus.ISSUED, "100.00");
        Ticket cancelled = TestData.ticket(trip, TicketStatus.CANCELLED, "100.00");
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));
        when(tripRepository.save(trip)).thenReturn(trip);
        when(ticketRepository.findByTrip_TripId(trip.getTripId())).thenReturn(List.of(issued, cancelled));

        TripDto dto = tripService.start(trip.getTripId());

        assertThat(dto.status()).isEqualTo(TripStatus.ONGOING);
        assertThat(dto.startedAt()).isNotNull();
        verify(eventPublisher).publishTripEvent("TRIP_STARTED", trip, List.of(issued.getPassengerId()));
    }

    @Test
    void startRejectsTripThatIsNotScheduled() {
        Trip trip = TestData.trip(TripStatus.ONGOING);
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));

        assertThatThrownBy(() -> tripService.start(trip.getTripId()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT);
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void completeReconcilesNonCancelledTicketsAgainstValidated() {
        Trip trip = TestData.trip(TripStatus.ONGOING);
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));
        when(tripRepository.save(trip)).thenReturn(trip);
        when(ticketRepository.findByTrip_TripId(trip.getTripId())).thenReturn(List.of(
                TestData.ticket(trip, TicketStatus.ISSUED, "100.00"),
                TestData.ticket(trip, TicketStatus.VALIDATED, "100.00"),
                TestData.ticket(trip, TicketStatus.CANCELLED, "100.00")));

        TripService.TripReconciliation result = tripService.complete(trip.getTripId());

        assertThat(result.trip().status()).isEqualTo(TripStatus.COMPLETED);
        assertThat(result.ticketsIssued()).isEqualTo(2);
        assertThat(result.ticketsValidated()).isEqualTo(1);
    }

    @Test
    void listWithoutFilterReturnsAllTripsAsDtos() {
        Trip trip = TestData.trip(TripStatus.SCHEDULED);
        when(tripRepository.findAllByOrderByDepartureTimeAsc()).thenReturn(List.of(trip));

        List<TripDto> result = tripService.list(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).routeName()).isEqualTo("Colombo - Kandy Express");
    }

    @Test
    void listWithStatusFiltersByStatus() {
        Trip trip = TestData.trip(TripStatus.ONGOING);
        when(tripRepository.findByStatusOrderByDepartureTimeAsc(TripStatus.ONGOING)).thenReturn(List.of(trip));

        assertThat(tripService.list(TripStatus.ONGOING)).hasSize(1);
    }

    @Test
    void manifestListsTicketsOfTheTrip() {
        Trip trip = TestData.trip(TripStatus.ONGOING);
        Ticket ticket = TestData.ticket(trip, TicketStatus.VALIDATED, "100.00");
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));
        when(ticketRepository.findByTrip_TripId(trip.getTripId())).thenReturn(List.of(ticket));

        List<ManifestEntry> manifest = tripService.manifest(trip.getTripId());

        assertThat(manifest).hasSize(1);
        assertThat(manifest.get(0).ticketId()).isEqualTo(ticket.getTicketId());
        assertThat(manifest.get(0).status()).isEqualTo(TicketStatus.VALIDATED);
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run (in `services/ticketing-service`): `mvn -q test -Dtest=TripServiceTest`
Expected: FAIL, compilation errors (`setOperatorId`, `TripDto`, `publishTripEvent` missing).

- [ ] **Step 4: Add fields to Trip**

In `Trip.java`, add after `availableSeats`:

```java
    /** Owning fleet operator (user-service user id). Null for legacy rows. */
    private UUID operatorId;

    /** Set when the conductor starts the trip; used for punctuality analytics. */
    private Instant startedAt;
```

- [ ] **Step 5: Add the DTOs**

`dto/TripDto.java`:

```java
package lk.transitlk.ticketingservice.dto;

import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;

import java.time.Instant;
import java.util.UUID;

public record TripDto(
        UUID tripId,
        UUID routeId,
        String routeName,
        String origin,
        String destination,
        String vehicleReg,
        Instant departureTime,
        Instant arrivalTime,
        TripStatus status,
        int totalSeats,
        int availableSeats,
        UUID operatorId,
        Instant startedAt
) {
    public static TripDto from(Trip t) {
        return new TripDto(t.getTripId(), t.getRoute().getRouteId(), t.getRoute().getName(),
                t.getRoute().getOrigin(), t.getRoute().getDestination(), t.getVehicleReg(),
                t.getDepartureTime(), t.getArrivalTime(), t.getStatus(), t.getTotalSeats(),
                t.getAvailableSeats(), t.getOperatorId(), t.getStartedAt());
    }
}
```

`dto/ManifestEntry.java`:

```java
package lk.transitlk.ticketingservice.dto;

import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.TicketStatus;

import java.time.Instant;
import java.util.UUID;

public record ManifestEntry(UUID ticketId, UUID passengerId, Integer seatNo, TicketStatus status, Instant validatedAt) {
    public static ManifestEntry from(Ticket t) {
        return new ManifestEntry(t.getTicketId(), t.getPassengerId(), t.getSeatNo(), t.getStatus(), t.getValidatedAt());
    }
}
```

- [ ] **Step 6: Add repository queries**

In `TripRepository.java` add inside the interface (add `import lk.transitlk.ticketingservice.entity.TripStatus;` and `import java.util.UUID;` if missing):

```java
    List<Trip> findAllByOrderByDepartureTimeAsc();

    List<Trip> findByStatusOrderByDepartureTimeAsc(TripStatus status);

    List<Trip> findByOperatorIdOrderByDepartureTimeAsc(UUID operatorId);
```

- [ ] **Step 7: Add the trip event publisher and topic**

In `EventPublisher.java` add imports `lk.transitlk.ticketingservice.entity.Trip`, `java.util.List`, `java.util.UUID` and this method:

```java
    public void publishTripEvent(String eventType, Trip trip, List<UUID> passengerIds) {
        Map<String, Object> event = Map.of(
                "eventType", eventType,
                "tripId", trip.getTripId().toString(),
                "routeName", trip.getRoute().getName(),
                "vehicleReg", trip.getVehicleReg(),
                "passengerIds", passengerIds.stream().map(UUID::toString).toList(),
                "timestamp", Instant.now().toString()
        );
        kafkaTemplate.send("trip-events", trip.getTripId().toString(), event)
                .whenComplete((r, ex) -> {
                    if (ex != null) log.warn("Failed to publish {} event: {}", eventType, ex.getMessage());
                });
    }
```

In `config/KafkaTopicConfig.java` add:

```java
    @Bean
    public NewTopic tripEventsTopic() {
        return TopicBuilder.name("trip-events").partitions(3).replicas(1).build();
    }
```

- [ ] **Step 8: Rewrite TripService**

Replace the whole file body (keep package; imports needed: `ManifestEntry`, `TripDto`, `Ticket`, `TicketStatus`, `Trip`, `TripStatus`, `ApiException`, `TicketRepository`, `TripRepository`, `HttpStatus`, `Service`, `Transactional`, `java.time.Instant`, `java.util.List`, `java.util.UUID`):

```java
/** FR10 - trip lifecycle management and reconciliation of issued vs. validated tickets. */
@Service
public class TripService {

    private final TripRepository tripRepository;
    private final TicketRepository ticketRepository;
    private final EventPublisher eventPublisher;

    public TripService(TripRepository tripRepository, TicketRepository ticketRepository,
                       EventPublisher eventPublisher) {
        this.tripRepository = tripRepository;
        this.ticketRepository = ticketRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public List<TripDto> list(TripStatus status) {
        List<Trip> trips = status == null
                ? tripRepository.findAllByOrderByDepartureTimeAsc()
                : tripRepository.findByStatusOrderByDepartureTimeAsc(status);
        return trips.stream().map(TripDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ManifestEntry> manifest(UUID tripId) {
        get(tripId);
        return ticketRepository.findByTrip_TripId(tripId).stream().map(ManifestEntry::from).toList();
    }

    @Transactional
    public TripDto start(UUID tripId) {
        Trip trip = get(tripId);
        if (trip.getStatus() != TripStatus.SCHEDULED) {
            throw new ApiException(HttpStatus.CONFLICT, "Trip must be SCHEDULED to start");
        }
        trip.setStatus(TripStatus.ONGOING);
        trip.setStartedAt(Instant.now());
        Trip saved = tripRepository.save(trip);
        List<UUID> passengers = ticketRepository.findByTrip_TripId(tripId).stream()
                .filter(t -> t.getStatus() == TicketStatus.ISSUED || t.getStatus() == TicketStatus.VALIDATED)
                .map(Ticket::getPassengerId)
                .distinct()
                .toList();
        eventPublisher.publishTripEvent("TRIP_STARTED", saved, passengers);
        return TripDto.from(saved);
    }

    @Transactional
    public TripReconciliation complete(UUID tripId) {
        Trip trip = get(tripId);
        if (trip.getStatus() != TripStatus.ONGOING) {
            throw new ApiException(HttpStatus.CONFLICT, "Trip must be ONGOING to complete");
        }
        trip.setStatus(TripStatus.COMPLETED);
        Trip saved = tripRepository.save(trip);

        List<Ticket> tickets = ticketRepository.findByTrip_TripId(tripId).stream()
                .filter(t -> t.getStatus() != TicketStatus.CANCELLED)
                .toList();
        long validated = tickets.stream().filter(t -> t.getStatus() == TicketStatus.VALIDATED).count();
        return new TripReconciliation(TripDto.from(saved), tickets.size(), validated);
    }

    private Trip get(UUID tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Trip not found"));
    }

    public record TripReconciliation(TripDto trip, long ticketsIssued, long ticketsValidated) {
    }
}
```

- [ ] **Step 9: Update the controller**

Replace `TripController.java` body (imports: `ManifestEntry`, `TripDto`, `TripStatus`, `TripService`, Spring web annotations, `ResponseEntity`, `java.util.List`, `java.util.UUID`):

```java
@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    @GetMapping
    public ResponseEntity<List<TripDto>> list(@RequestParam(required = false) TripStatus status) {
        return ResponseEntity.ok(tripService.list(status));
    }

    @GetMapping("/{id}/tickets")
    public ResponseEntity<List<ManifestEntry>> manifest(@PathVariable UUID id) {
        return ResponseEntity.ok(tripService.manifest(id));
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<TripDto> start(@PathVariable UUID id) {
        return ResponseEntity.ok(tripService.start(id));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<TripService.TripReconciliation> complete(@PathVariable UUID id) {
        return ResponseEntity.ok(tripService.complete(id));
    }
}
```

- [ ] **Step 10: Update security rules**

In `SecurityConfig.java` replace the line `.requestMatchers("/api/trips/*/start", "/api/trips/*/complete")...` with:

```java
                        .requestMatchers("/api/trips", "/api/trips/*/tickets", "/api/trips/*/start", "/api/trips/*/complete")
                                .hasAnyRole("CONDUCTOR", "OPERATOR", "ADMIN")
```

- [ ] **Step 11: Own the seeded trips**

In `DataSeeder.java` add the constant and set it in `newTrip`:

```java
    /** Must equal user-service DemoUserSeeder.OPERATOR_ID. */
    public static final java.util.UUID DEMO_OPERATOR_ID =
            java.util.UUID.fromString("00000000-0000-0000-0000-0000000000a1");
```

and in `newTrip(...)` before `return t;` add `t.setOperatorId(DEMO_OPERATOR_ID);`.

- [ ] **Step 12: Run tests to verify they pass**

Run: `mvn -q test -Dtest=TripServiceTest`
Expected: PASS (6 tests).

- [ ] **Step 13: Commit**

```bash
git add services/ticketing-service
git commit -m "feat(ticketing): trip list, manifest, startedAt and trip events"
```

---

### Task 3: ticketing operator endpoints and report

**Files:**
- Create: `.../dto/CreateTripRequest.java`, `.../dto/OperatorSummary.java`, `.../service/OperatorService.java`, `.../controller/OperatorController.java`
- Modify: `.../config/SecurityConfig.java`
- Test: `src/test/java/lk/transitlk/ticketingservice/service/OperatorServiceTest.java`

**Interfaces:**
- Consumes: `TripDto`, `TripRepository.findByOperatorIdOrderByDepartureTimeAsc`, `EventPublisher.publishTripEvent`, `TestData` (Task 2).
- Produces:
  - `record CreateTripRequest(@NotNull UUID routeId, @NotBlank String vehicleReg, @NotNull Instant departureTime, @NotNull Instant arrivalTime, @Min(1) int totalSeats)`
  - `record OperatorSummary(BigDecimal totalRevenue, long totalTicketsSold, List<TripStats> trips)` and nested `record TripStats(UUID tripId, String routeName, String vehicleReg, Instant departureTime, TripStatus status, long ticketsSold, BigDecimal revenue, int totalSeats, double occupancy)` (occupancy is a 0..1 fraction rounded to 4 decimals).
  - `OperatorService(TripRepository, RouteRepository, TicketRepository, EventPublisher)` with `List<TripDto> listTrips(UUID operatorId)`, `TripDto createTrip(UUID operatorId, CreateTripRequest)`, `TripDto cancelTrip(UUID operatorId, UUID tripId)`, `OperatorSummary summary(UUID operatorId)`.
  - Endpoints: `GET /api/operator/trips`, `POST /api/operator/trips`, `POST /api/operator/trips/{id}/cancel`, `GET /api/operator/reports/summary`.

- [ ] **Step 1: Write the failing test**

```java
package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.TestData;
import lk.transitlk.ticketingservice.dto.CreateTripRequest;
import lk.transitlk.ticketingservice.dto.OperatorSummary;
import lk.transitlk.ticketingservice.dto.TripDto;
import lk.transitlk.ticketingservice.entity.*;
import lk.transitlk.ticketingservice.exception.ApiException;
import lk.transitlk.ticketingservice.repository.RouteRepository;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OperatorServiceTest {

    @Mock TripRepository tripRepository;
    @Mock RouteRepository routeRepository;
    @Mock TicketRepository ticketRepository;
    @Mock EventPublisher eventPublisher;
    @InjectMocks OperatorService operatorService;

    @Test
    void createTripAssignsOwnerAndSeats() {
        Trip template = TestData.trip(TripStatus.SCHEDULED);
        Route route = template.getRoute();
        when(routeRepository.findById(route.getRouteId())).thenReturn(Optional.of(route));
        when(tripRepository.save(any(Trip.class))).thenAnswer(i -> i.getArgument(0));

        TripDto dto = operatorService.createTrip(TestData.OPERATOR_ID, new CreateTripRequest(
                route.getRouteId(), "NB-9999", TestData.DEPARTURE, TestData.DEPARTURE.plusSeconds(7200), 30));

        assertThat(dto.operatorId()).isEqualTo(TestData.OPERATOR_ID);
        assertThat(dto.status()).isEqualTo(TripStatus.SCHEDULED);
        assertThat(dto.totalSeats()).isEqualTo(30);
        assertThat(dto.availableSeats()).isEqualTo(30);
        assertThat(dto.vehicleReg()).isEqualTo("NB-9999");
    }

    @Test
    void createTripRejectsArrivalBeforeDeparture() {
        Trip template = TestData.trip(TripStatus.SCHEDULED);
        Route route = template.getRoute();
        when(routeRepository.findById(route.getRouteId())).thenReturn(Optional.of(route));

        assertThatThrownBy(() -> operatorService.createTrip(TestData.OPERATOR_ID, new CreateTripRequest(
                route.getRouteId(), "NB-9999", TestData.DEPARTURE, TestData.DEPARTURE.minusSeconds(60), 30)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void cancelByAnotherOperatorLooksLikeNotFound() {
        Trip trip = TestData.trip(TripStatus.SCHEDULED);
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));

        assertThatThrownBy(() -> operatorService.cancelTrip(UUID.randomUUID(), trip.getTripId()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void cancelRejectsTripThatAlreadyStarted() {
        Trip trip = TestData.trip(TripStatus.ONGOING);
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));

        assertThatThrownBy(() -> operatorService.cancelTrip(TestData.OPERATOR_ID, trip.getTripId()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void cancelCancelsIssuedTicketsAndNotifiesTheirPassengers() {
        Trip trip = TestData.trip(TripStatus.SCHEDULED);
        Ticket issued = TestData.ticket(trip, TicketStatus.ISSUED, "100.00");
        Ticket validated = TestData.ticket(trip, TicketStatus.VALIDATED, "100.00");
        when(tripRepository.findById(trip.getTripId())).thenReturn(Optional.of(trip));
        when(tripRepository.save(trip)).thenReturn(trip);
        when(ticketRepository.findByTrip_TripId(trip.getTripId())).thenReturn(List.of(issued, validated));

        TripDto dto = operatorService.cancelTrip(TestData.OPERATOR_ID, trip.getTripId());

        assertThat(dto.status()).isEqualTo(TripStatus.CANCELLED);
        assertThat(issued.getStatus()).isEqualTo(TicketStatus.CANCELLED);
        assertThat(validated.getStatus()).isEqualTo(TicketStatus.VALIDATED);
        verify(eventPublisher).publishTripEvent("TRIP_CANCELLED", trip, List.of(issued.getPassengerId()));
    }

    @Test
    void summaryCountsOnlyNonCancelledTickets() {
        Trip trip = TestData.trip("Colombo - Kandy Express", TripStatus.COMPLETED, 10, TestData.OPERATOR_ID);
        when(tripRepository.findByOperatorIdOrderByDepartureTimeAsc(TestData.OPERATOR_ID)).thenReturn(List.of(trip));
        when(ticketRepository.findByTrip_TripId(trip.getTripId())).thenReturn(List.of(
                TestData.ticket(trip, TicketStatus.ISSUED, "100.00"),
                TestData.ticket(trip, TicketStatus.VALIDATED, "150.50"),
                TestData.ticket(trip, TicketStatus.CANCELLED, "999.00")));

        OperatorSummary summary = operatorService.summary(TestData.OPERATOR_ID);

        assertThat(summary.totalTicketsSold()).isEqualTo(2);
        assertThat(summary.totalRevenue()).isEqualByComparingTo(new BigDecimal("250.50"));
        assertThat(summary.trips()).hasSize(1);
        assertThat(summary.trips().get(0).occupancy()).isCloseTo(0.2, within(0.0001));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn -q test -Dtest=OperatorServiceTest`
Expected: FAIL, compilation errors (`OperatorService`, `CreateTripRequest`, `OperatorSummary` missing).

- [ ] **Step 3: Add the DTOs**

`dto/CreateTripRequest.java`:

```java
package lk.transitlk.ticketingservice.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public record CreateTripRequest(
        @NotNull UUID routeId,
        @NotBlank String vehicleReg,
        @NotNull Instant departureTime,
        @NotNull Instant arrivalTime,
        @Min(1) int totalSeats
) {
}
```

`dto/OperatorSummary.java`:

```java
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
```

- [ ] **Step 4: Write OperatorService**

```java
package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.dto.CreateTripRequest;
import lk.transitlk.ticketingservice.dto.OperatorSummary;
import lk.transitlk.ticketingservice.dto.OperatorSummary.TripStats;
import lk.transitlk.ticketingservice.dto.TripDto;
import lk.transitlk.ticketingservice.entity.*;
import lk.transitlk.ticketingservice.exception.ApiException;
import lk.transitlk.ticketingservice.repository.RouteRepository;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** FR8/FR9 - fleet operators manage their own trips and see revenue and occupancy. */
@Service
public class OperatorService {

    private final TripRepository tripRepository;
    private final RouteRepository routeRepository;
    private final TicketRepository ticketRepository;
    private final EventPublisher eventPublisher;

    public OperatorService(TripRepository tripRepository, RouteRepository routeRepository,
                           TicketRepository ticketRepository, EventPublisher eventPublisher) {
        this.tripRepository = tripRepository;
        this.routeRepository = routeRepository;
        this.ticketRepository = ticketRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public List<TripDto> listTrips(UUID operatorId) {
        return tripRepository.findByOperatorIdOrderByDepartureTimeAsc(operatorId).stream()
                .map(TripDto::from).toList();
    }

    @Transactional
    public TripDto createTrip(UUID operatorId, CreateTripRequest req) {
        Route route = routeRepository.findById(req.routeId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Route not found"));
        if (!req.arrivalTime().isAfter(req.departureTime())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Arrival must be after departure");
        }
        Trip trip = new Trip();
        trip.setRoute(route);
        trip.setVehicleReg(req.vehicleReg());
        trip.setDepartureTime(req.departureTime());
        trip.setArrivalTime(req.arrivalTime());
        trip.setStatus(TripStatus.SCHEDULED);
        trip.setTotalSeats(req.totalSeats());
        trip.setAvailableSeats(req.totalSeats());
        trip.setOperatorId(operatorId);
        return TripDto.from(tripRepository.save(trip));
    }

    @Transactional
    public TripDto cancelTrip(UUID operatorId, UUID tripId) {
        Trip trip = ownedTrip(operatorId, tripId);
        if (trip.getStatus() != TripStatus.SCHEDULED) {
            throw new ApiException(HttpStatus.CONFLICT, "Only a scheduled trip can be cancelled");
        }
        trip.setStatus(TripStatus.CANCELLED);
        List<Ticket> toCancel = ticketRepository.findByTrip_TripId(tripId).stream()
                .filter(t -> t.getStatus() == TicketStatus.ISSUED)
                .toList();
        toCancel.forEach(t -> t.setStatus(TicketStatus.CANCELLED));
        ticketRepository.saveAll(toCancel);
        Trip saved = tripRepository.save(trip);
        eventPublisher.publishTripEvent("TRIP_CANCELLED", saved,
                toCancel.stream().map(Ticket::getPassengerId).distinct().toList());
        return TripDto.from(saved);
    }

    @Transactional(readOnly = true)
    public OperatorSummary summary(UUID operatorId) {
        List<TripStats> stats = tripRepository.findByOperatorIdOrderByDepartureTimeAsc(operatorId).stream()
                .map(this::statsFor).toList();
        BigDecimal revenue = stats.stream().map(TripStats::revenue).reduce(BigDecimal.ZERO, BigDecimal::add);
        long sold = stats.stream().mapToLong(TripStats::ticketsSold).sum();
        return new OperatorSummary(revenue, sold, stats);
    }

    private TripStats statsFor(Trip trip) {
        List<Ticket> sold = ticketRepository.findByTrip_TripId(trip.getTripId()).stream()
                .filter(t -> t.getStatus() != TicketStatus.CANCELLED)
                .toList();
        BigDecimal revenue = sold.stream().map(Ticket::getFare).reduce(BigDecimal.ZERO, BigDecimal::add);
        double occupancy = trip.getTotalSeats() == 0 ? 0
                : Math.round(sold.size() * 10000.0 / trip.getTotalSeats()) / 10000.0;
        return new TripStats(trip.getTripId(), trip.getRoute().getName(), trip.getVehicleReg(),
                trip.getDepartureTime(), trip.getStatus(), sold.size(), revenue, trip.getTotalSeats(), occupancy);
    }

    /** Another operator's trip is reported as missing so ids cannot be probed. */
    private Trip ownedTrip(UUID operatorId, UUID tripId) {
        return tripRepository.findById(tripId)
                .filter(t -> operatorId.equals(t.getOperatorId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Trip not found"));
    }
}
```

- [ ] **Step 5: Write OperatorController**

```java
package lk.transitlk.ticketingservice.controller;

import jakarta.validation.Valid;
import lk.transitlk.ticketingservice.dto.CreateTripRequest;
import lk.transitlk.ticketingservice.dto.OperatorSummary;
import lk.transitlk.ticketingservice.dto.TripDto;
import lk.transitlk.ticketingservice.service.OperatorService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/operator")
public class OperatorController {

    private final OperatorService operatorService;

    public OperatorController(OperatorService operatorService) {
        this.operatorService = operatorService;
    }

    @GetMapping("/trips")
    public ResponseEntity<List<TripDto>> trips(Authentication authentication) {
        return ResponseEntity.ok(operatorService.listTrips(operatorId(authentication)));
    }

    @PostMapping("/trips")
    public ResponseEntity<TripDto> create(Authentication authentication, @Valid @RequestBody CreateTripRequest req) {
        return ResponseEntity.ok(operatorService.createTrip(operatorId(authentication), req));
    }

    @PostMapping("/trips/{id}/cancel")
    public ResponseEntity<TripDto> cancel(Authentication authentication, @PathVariable UUID id) {
        return ResponseEntity.ok(operatorService.cancelTrip(operatorId(authentication), id));
    }

    @GetMapping("/reports/summary")
    public ResponseEntity<OperatorSummary> summary(Authentication authentication) {
        return ResponseEntity.ok(operatorService.summary(operatorId(authentication)));
    }

    private UUID operatorId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
```

- [ ] **Step 6: Secure the endpoints**

In `SecurityConfig.java`, add before the `/api/tickets/validate` matcher:

```java
                        .requestMatchers("/api/operator/**").hasRole("OPERATOR")
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `mvn -q test -Dtest=OperatorServiceTest`
Expected: PASS (6 tests).

- [ ] **Step 8: Commit**

```bash
git add services/ticketing-service
git commit -m "feat(ticketing): operator trip management and summary report"
```

---

### Task 4: ticketing regulator analytics

**Files:**
- Create: `.../dto/RegulatorAnalytics.java`, `.../service/RegulatorService.java`, `.../controller/RegulatorController.java`
- Modify: `.../config/SecurityConfig.java`
- Test: `src/test/java/lk/transitlk/ticketingservice/service/RegulatorServiceTest.java`

**Interfaces:**
- Consumes: `TestData` (Task 2).
- Produces:
  - `record RegulatorAnalytics(long totalTrips, long totalTicketsSold, BigDecimal totalRevenue, List<RouteAnalytics> routes)` with nested `record RouteAnalytics(String routeName, UUID operatorId, long trips, long cancelledTrips, long ticketsSold, BigDecimal revenue, double avgOccupancy, Double avgDelayMinutes)`. `avgOccupancy` is a 0..1 fraction (4 decimals); `avgDelayMinutes` is null when no trip of the group has started.
  - `RegulatorService(TripRepository, TicketRepository)` with `RegulatorAnalytics analytics()`; endpoint `GET /api/regulator/analytics`.

- [ ] **Step 1: Write the failing test**

```java
package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.TestData;
import lk.transitlk.ticketingservice.dto.RegulatorAnalytics;
import lk.transitlk.ticketingservice.dto.RegulatorAnalytics.RouteAnalytics;
import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.TicketStatus;
import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegulatorServiceTest {

    @Mock TripRepository tripRepository;
    @Mock TicketRepository ticketRepository;
    @InjectMocks RegulatorService regulatorService;

    @Test
    void aggregatesPerRouteAndOperator() {
        Trip early = TestData.trip("Colombo - Kandy Express", TripStatus.COMPLETED, 10, TestData.OPERATOR_ID);
        early.setStartedAt(TestData.DEPARTURE.plusSeconds(5 * 60));
        Trip late = TestData.trip("Colombo - Kandy Express", TripStatus.COMPLETED, 10, TestData.OPERATOR_ID);
        late.setStartedAt(TestData.DEPARTURE.plusSeconds(15 * 60));
        Trip cancelled = TestData.trip("Colombo - Galle Highway", TripStatus.CANCELLED, 10, TestData.OPERATOR_ID);

        List<Ticket> tickets = new ArrayList<>();
        tickets.add(TestData.ticket(early, TicketStatus.ISSUED, "100.00"));
        tickets.add(TestData.ticket(early, TicketStatus.VALIDATED, "100.00"));
        tickets.add(TestData.ticket(early, TicketStatus.CANCELLED, "100.00"));
        for (int i = 0; i < 4; i++) {
            tickets.add(TestData.ticket(late, TicketStatus.VALIDATED, "100.00"));
        }
        when(tripRepository.findAll()).thenReturn(List.of(early, late, cancelled));
        when(ticketRepository.findAll()).thenReturn(tickets);

        RegulatorAnalytics result = regulatorService.analytics();

        assertThat(result.totalTrips()).isEqualTo(3);
        assertThat(result.totalTicketsSold()).isEqualTo(6);
        assertThat(result.totalRevenue()).isEqualByComparingTo(new BigDecimal("600.00"));
        assertThat(result.routes()).hasSize(2);

        RouteAnalytics galle = result.routes().get(0);
        assertThat(galle.routeName()).isEqualTo("Colombo - Galle Highway");
        assertThat(galle.cancelledTrips()).isEqualTo(1);
        assertThat(galle.ticketsSold()).isZero();
        assertThat(galle.avgDelayMinutes()).isNull();

        RouteAnalytics kandy = result.routes().get(1);
        assertThat(kandy.routeName()).isEqualTo("Colombo - Kandy Express");
        assertThat(kandy.trips()).isEqualTo(2);
        assertThat(kandy.ticketsSold()).isEqualTo(6);
        assertThat(kandy.revenue()).isEqualByComparingTo(new BigDecimal("600.00"));
        assertThat(kandy.avgOccupancy()).isCloseTo(0.3, within(0.0001));
        assertThat(kandy.avgDelayMinutes()).isCloseTo(10.0, within(0.01));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn -q test -Dtest=RegulatorServiceTest`
Expected: FAIL, compilation errors (`RegulatorService`, `RegulatorAnalytics` missing).

- [ ] **Step 3: Add the DTO**

```java
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
```

- [ ] **Step 4: Write RegulatorService**

```java
package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.dto.RegulatorAnalytics;
import lk.transitlk.ticketingservice.dto.RegulatorAnalytics.RouteAnalytics;
import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.TicketStatus;
import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import lk.transitlk.ticketingservice.repository.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** FR9 - aggregated, regulator-facing analytics per route and operator, computed live. */
@Service
public class RegulatorService {

    private record RouteKey(String routeName, UUID operatorId) {
    }

    private final TripRepository tripRepository;
    private final TicketRepository ticketRepository;

    public RegulatorService(TripRepository tripRepository, TicketRepository ticketRepository) {
        this.tripRepository = tripRepository;
        this.ticketRepository = ticketRepository;
    }

    @Transactional(readOnly = true)
    public RegulatorAnalytics analytics() {
        List<Trip> trips = tripRepository.findAll();
        Map<UUID, List<Ticket>> soldByTrip = ticketRepository.findAll().stream()
                .filter(t -> t.getStatus() != TicketStatus.CANCELLED)
                .collect(Collectors.groupingBy(t -> t.getTrip().getTripId()));

        List<RouteAnalytics> routes = trips.stream()
                .collect(Collectors.groupingBy(t -> new RouteKey(t.getRoute().getName(), t.getOperatorId())))
                .entrySet().stream()
                .map(e -> routeAnalytics(e.getKey(), e.getValue(), soldByTrip))
                .sorted(Comparator.comparing(RouteAnalytics::routeName))
                .toList();

        long sold = routes.stream().mapToLong(RouteAnalytics::ticketsSold).sum();
        BigDecimal revenue = routes.stream().map(RouteAnalytics::revenue).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new RegulatorAnalytics(trips.size(), sold, revenue, routes);
    }

    private RouteAnalytics routeAnalytics(RouteKey key, List<Trip> trips, Map<UUID, List<Ticket>> soldByTrip) {
        List<Trip> active = trips.stream().filter(t -> t.getStatus() != TripStatus.CANCELLED).toList();
        long cancelled = trips.size() - active.size();

        long ticketsSold = 0;
        BigDecimal revenue = BigDecimal.ZERO;
        double occupancySum = 0;
        for (Trip trip : active) {
            List<Ticket> sold = soldByTrip.getOrDefault(trip.getTripId(), List.of());
            ticketsSold += sold.size();
            revenue = revenue.add(sold.stream().map(Ticket::getFare).reduce(BigDecimal.ZERO, BigDecimal::add));
            occupancySum += trip.getTotalSeats() == 0 ? 0 : (double) sold.size() / trip.getTotalSeats();
        }
        double avgOccupancy = active.isEmpty() ? 0 : Math.round(occupancySum / active.size() * 10000.0) / 10000.0;

        List<Double> delays = active.stream()
                .filter(t -> t.getStartedAt() != null)
                .map(t -> Duration.between(t.getDepartureTime(), t.getStartedAt()).getSeconds() / 60.0)
                .toList();
        Double avgDelay = delays.isEmpty() ? null
                : Math.round(delays.stream().mapToDouble(Double::doubleValue).average().orElse(0) * 10.0) / 10.0;

        return new RouteAnalytics(key.routeName(), key.operatorId(), trips.size(), cancelled,
                ticketsSold, revenue, avgOccupancy, avgDelay);
    }
}
```

- [ ] **Step 5: Write RegulatorController**

```java
package lk.transitlk.ticketingservice.controller;

import lk.transitlk.ticketingservice.dto.RegulatorAnalytics;
import lk.transitlk.ticketingservice.service.RegulatorService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/regulator")
public class RegulatorController {

    private final RegulatorService regulatorService;

    public RegulatorController(RegulatorService regulatorService) {
        this.regulatorService = regulatorService;
    }

    @GetMapping("/analytics")
    public ResponseEntity<RegulatorAnalytics> analytics() {
        return ResponseEntity.ok(regulatorService.analytics());
    }
}
```

- [ ] **Step 6: Secure the endpoint**

In `SecurityConfig.java`, add next to the operator matcher:

```java
                        .requestMatchers("/api/regulator/**").hasAnyRole("REGULATOR", "ADMIN")
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `mvn -q test -Dtest=RegulatorServiceTest`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add services/ticketing-service
git commit -m "feat(ticketing): regulator analytics endpoint"
```

---

### Task 5: ticketing tracking-token endpoint

**Files:**
- Create: `.../dto/TrackTokenResponse.java`, `.../service/TrackTokenService.java`, `.../service/TrackingAccessService.java`, `.../controller/TrackingAccessController.java`
- Modify: `services/ticketing-service/src/main/resources/application.yml`
- Test: `src/test/java/lk/transitlk/ticketingservice/service/TrackingAccessServiceTest.java`

**Interfaces:**
- Consumes: `TestData` (Task 2).
- Produces:
  - `record TrackTokenResponse(String token, String vehicleReg, Instant expiresAt)`.
  - `TrackTokenService(String secret)` with `TrackTokenResponse issue(UUID ticketId, String vehicleReg)`. Token: HS256, `sub` ticket id, claims `purpose=track` and `vehicleReg`, 30 minute lifetime.
  - `TrackingAccessService(TicketRepository, TrackTokenService)` with `TrackTokenResponse issueFor(UUID ticketId, UUID requesterId)`; endpoint `POST /api/tickets/{id}/track-token` (any authenticated user; ownership enforced in the service). Errors: 404 ticket missing, 403 not owner, 409 ticket not `ISSUED`/`VALIDATED`, 409 trip not `ONGOING`.

- [ ] **Step 1: Write the failing test**

```java
package lk.transitlk.ticketingservice.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lk.transitlk.ticketingservice.TestData;
import lk.transitlk.ticketingservice.dto.TrackTokenResponse;
import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.TicketStatus;
import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.exception.ApiException;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TrackingAccessServiceTest {

    private static final String SECRET = "transitlk-tracking-token-secret-32bytes-min";

    @Mock TicketRepository ticketRepository;
    TrackingAccessService service;

    @BeforeEach
    void setUp() {
        service = new TrackingAccessService(ticketRepository, new TrackTokenService(SECRET));
    }

    private Ticket ticketOn(TripStatus tripStatus, TicketStatus ticketStatus) {
        Trip trip = TestData.trip(tripStatus);
        Ticket ticket = TestData.ticket(trip, ticketStatus, "100.00");
        when(ticketRepository.findById(ticket.getTicketId())).thenReturn(Optional.of(ticket));
        return ticket;
    }

    private static void assertStatus(Runnable call, HttpStatus expected) {
        assertThatThrownBy(call::run)
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(expected);
    }

    @Test
    void ownerOfActiveTicketOnOngoingTripGetsVehicleScopedToken() {
        Ticket ticket = ticketOn(TripStatus.ONGOING, TicketStatus.ISSUED);

        TrackTokenResponse resp = service.issueFor(ticket.getTicketId(), ticket.getPassengerId());

        Claims claims = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes()))
                .build().parseSignedClaims(resp.token()).getPayload();
        assertThat(claims.getSubject()).isEqualTo(ticket.getTicketId().toString());
        assertThat(claims.get("vehicleReg", String.class)).isEqualTo("NB-1234");
        assertThat(claims.get("purpose", String.class)).isEqualTo("track");
        assertThat(resp.vehicleReg()).isEqualTo("NB-1234");
    }

    @Test
    void validatedTicketStillGetsToken() {
        Ticket ticket = ticketOn(TripStatus.ONGOING, TicketStatus.VALIDATED);

        assertThat(service.issueFor(ticket.getTicketId(), ticket.getPassengerId()).token()).isNotBlank();
    }

    @Test
    void nonOwnerIsForbidden() {
        Ticket ticket = ticketOn(TripStatus.ONGOING, TicketStatus.ISSUED);

        assertStatus(() -> service.issueFor(ticket.getTicketId(), UUID.randomUUID()), HttpStatus.FORBIDDEN);
    }

    @Test
    void cancelledTicketIsRejected() {
        Ticket ticket = ticketOn(TripStatus.ONGOING, TicketStatus.CANCELLED);

        assertStatus(() -> service.issueFor(ticket.getTicketId(), ticket.getPassengerId()), HttpStatus.CONFLICT);
    }

    @Test
    void tripThatIsNotOngoingIsRejected() {
        Ticket ticket = ticketOn(TripStatus.SCHEDULED, TicketStatus.ISSUED);

        assertStatus(() -> service.issueFor(ticket.getTicketId(), ticket.getPassengerId()), HttpStatus.CONFLICT);
    }

    @Test
    void unknownTicketIsNotFound() {
        UUID id = UUID.randomUUID();
        when(ticketRepository.findById(id)).thenReturn(Optional.empty());

        assertStatus(() -> service.issueFor(id, UUID.randomUUID()), HttpStatus.NOT_FOUND);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn -q test -Dtest=TrackingAccessServiceTest`
Expected: FAIL, compilation errors (`TrackingAccessService` missing).

- [ ] **Step 3: Add the DTO and token service**

`dto/TrackTokenResponse.java`:

```java
package lk.transitlk.ticketingservice.dto;

import java.time.Instant;

public record TrackTokenResponse(String token, String vehicleReg, Instant expiresAt) {
}
```

`service/TrackTokenService.java`:

```java
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
```

- [ ] **Step 4: Add the access service and controller**

`service/TrackingAccessService.java`:

```java
package lk.transitlk.ticketingservice.service;

import lk.transitlk.ticketingservice.dto.TrackTokenResponse;
import lk.transitlk.ticketingservice.entity.Ticket;
import lk.transitlk.ticketingservice.entity.TicketStatus;
import lk.transitlk.ticketingservice.entity.Trip;
import lk.transitlk.ticketingservice.entity.TripStatus;
import lk.transitlk.ticketingservice.exception.ApiException;
import lk.transitlk.ticketingservice.repository.TicketRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** A passenger may watch only the vehicle of a trip they hold an active ticket for, while it is running. */
@Service
public class TrackingAccessService {

    private final TicketRepository ticketRepository;
    private final TrackTokenService tokenService;

    public TrackingAccessService(TicketRepository ticketRepository, TrackTokenService tokenService) {
        this.ticketRepository = ticketRepository;
        this.tokenService = tokenService;
    }

    @Transactional(readOnly = true)
    public TrackTokenResponse issueFor(UUID ticketId, UUID requesterId) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Ticket not found"));
        if (!ticket.getPassengerId().equals(requesterId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not your ticket");
        }
        if (ticket.getStatus() != TicketStatus.ISSUED && ticket.getStatus() != TicketStatus.VALIDATED) {
            throw new ApiException(HttpStatus.CONFLICT, "Ticket is not active");
        }
        Trip trip = ticket.getTrip();
        if (trip.getStatus() != TripStatus.ONGOING) {
            throw new ApiException(HttpStatus.CONFLICT, "Trip is not in progress");
        }
        return tokenService.issue(ticketId, trip.getVehicleReg());
    }
}
```

`controller/TrackingAccessController.java`:

```java
package lk.transitlk.ticketingservice.controller;

import lk.transitlk.ticketingservice.dto.TrackTokenResponse;
import lk.transitlk.ticketingservice.service.TrackingAccessService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/tickets")
public class TrackingAccessController {

    private final TrackingAccessService trackingAccessService;

    public TrackingAccessController(TrackingAccessService trackingAccessService) {
        this.trackingAccessService = trackingAccessService;
    }

    @PostMapping("/{id}/track-token")
    public ResponseEntity<TrackTokenResponse> trackToken(Authentication authentication, @PathVariable UUID id) {
        UUID requesterId = UUID.fromString(authentication.getName());
        return ResponseEntity.ok(trackingAccessService.issueFor(id, requesterId));
    }
}
```

- [ ] **Step 5: Add the secret to application.yml**

In `services/ticketing-service/src/main/resources/application.yml`, under the existing `transitlk:` block (next to `ticket:`) add:

```yaml
  tracking:
    token-secret: ${TRACKING_TOKEN_SECRET:transitlk-tracking-token-secret-32bytes-min}
```

- [ ] **Step 6: Run the full ticketing suite**

Run: `mvn -q test`
Expected: PASS for `TripServiceTest`, `OperatorServiceTest`, `RegulatorServiceTest`, `TrackingAccessServiceTest`.

- [ ] **Step 7: Commit**

```bash
git add services/ticketing-service
git commit -m "feat(ticketing): issue vehicle-scoped tracking tokens to ticket owners"
```

---

### Task 6: tracking-service token enforcement

**Files:**
- Create: `services/tracking-service/src/auth/access.service.ts`, `src/auth/auth.module.ts`, `src/auth/access.service.spec.ts`
- Modify: `package.json`, `src/location/location.gateway.ts`, `src/location/location.module.ts`, `src/vehicles/vehicles.controller.ts`, `src/vehicles/vehicles.module.ts`

**Interfaces:**
- Produces:
  - `type Access = { kind: 'fleet' } | { kind: 'vehicle'; vehicleReg: string }`
  - `AccessService.authorize(token: string | undefined): Access` (throws `UnauthorizedException`); `AccessService.canView(access: Access, vehicleReg: string): boolean`; exported helper `bearerToken(header?: string): string | undefined`.
  - `fleet` access = a user-service JWT (`JWT_SECRET`) whose `role` is `OPERATOR` or `ADMIN`; `vehicle` access = a ticketing track token (`TRACKING_TOKEN_SECRET`, `purpose=track`).
  - WebSocket: the client passes `auth: { token }` in the socket.io handshake; it is joined to room `fleet` or `vehicle:<reg>` and receives `location:update` only for those rooms. The old global broadcast and `subscribeVehicle` are removed.
  - REST: `GET /api/vehicles` needs fleet access; `GET /api/vehicles/:reg` and `/:reg/eta` need fleet access or a token for that `reg`. `POST /api/telemetry` is unchanged.

- [ ] **Step 1: Add dependencies**

In `package.json` add `"jsonwebtoken": "^9.0.2"` to `dependencies`, `"@types/jsonwebtoken": "^9.0.6"` to `devDependencies`, and this script:

```json
    "test": "nest build && node --test dist/auth/access.service.spec.js"
```

Run (in `services/tracking-service`): `npm install`
Expected: installs without errors; `package-lock.json` updates.

- [ ] **Step 2: Write the failing test**

Create `src/auth/access.service.spec.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as jwt from 'jsonwebtoken';
import { AccessService, bearerToken } from './access.service';

const USER_SECRET = 'user-secret-for-tests-user-secret-for-tests';
const TRACK_SECRET = 'track-secret-for-tests-track-secret-for-tests';

process.env.JWT_SECRET = USER_SECRET;
process.env.TRACKING_TOKEN_SECRET = TRACK_SECRET;

const service = new AccessService();

const trackToken = (reg: string, secret = TRACK_SECRET, expiresIn: string | number = '10m') =>
  jwt.sign({ purpose: 'track', vehicleReg: reg }, secret, { algorithm: 'HS256', subject: 'ticket-1', expiresIn } as jwt.SignOptions);

const userToken = (role: string) =>
  jwt.sign({ role }, USER_SECRET, { algorithm: 'HS256', subject: 'user-1', expiresIn: '10m' });

test('a track token grants access to exactly its vehicle', () => {
  const access = service.authorize(trackToken('NB-1234'));
  assert.deepEqual(access, { kind: 'vehicle', vehicleReg: 'NB-1234' });
  assert.equal(service.canView(access, 'NB-1234'), true);
  assert.equal(service.canView(access, 'SP-9012'), false);
});

test('operator and admin user tokens grant fleet access', () => {
  for (const role of ['OPERATOR', 'ADMIN']) {
    const access = service.authorize(userToken(role));
    assert.deepEqual(access, { kind: 'fleet' });
    assert.equal(service.canView(access, 'ANY-REG'), true);
  }
});

test('passenger and conductor user tokens are rejected', () => {
  for (const role of ['PASSENGER', 'CONDUCTOR']) {
    assert.throws(() => service.authorize(userToken(role)), /Unauthorized/);
  }
});

test('missing, forged and expired tokens are rejected', () => {
  assert.throws(() => service.authorize(undefined), /Unauthorized/);
  assert.throws(() => service.authorize('not-a-jwt'), /Unauthorized/);
  assert.throws(() => service.authorize(trackToken('NB-1234', 'some-other-secret-some-other-secret-xx')), /Unauthorized/);
  assert.throws(() => service.authorize(trackToken('NB-1234', TRACK_SECRET, -60)), /Unauthorized/);
});

test('a user token without the track purpose cannot be used as a track token', () => {
  const sneaky = jwt.sign({ vehicleReg: 'NB-1234', role: 'PASSENGER' }, USER_SECRET, { algorithm: 'HS256' });
  assert.throws(() => service.authorize(sneaky), /Unauthorized/);
});

test('bearerToken extracts the token from an Authorization header', () => {
  assert.equal(bearerToken('Bearer abc.def'), 'abc.def');
  assert.equal(bearerToken('bearer abc.def'), 'abc.def');
  assert.equal(bearerToken('Basic abc'), undefined);
  assert.equal(bearerToken(undefined), undefined);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, build error "Cannot find module './access.service'".

- [ ] **Step 4: Write the access service and module**

`src/auth/access.service.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export type Access = { kind: 'fleet' } | { kind: 'vehicle'; vehicleReg: string };

const STAFF_ROLES = ['OPERATOR', 'ADMIN'];

export function bearerToken(header?: string): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? '');
  return match ? match[1] : undefined;
}

/**
 * Decides what a caller may watch. Passengers carry a vehicle-scoped token issued by the
 * ticketing service; staff carry a normal user-service JWT. Verification is local, so
 * tracking never calls another service.
 */
@Injectable()
export class AccessService {
  private readonly userSecret =
    process.env.JWT_SECRET ?? 'transitlk-dev-secret-key-change-me-please-32bytes+';
  private readonly trackSecret =
    process.env.TRACKING_TOKEN_SECRET ?? 'transitlk-tracking-token-secret-32bytes-min';

  authorize(token: string | undefined): Access {
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    const track = this.verify(token, this.trackSecret);
    if (track && track.purpose === 'track' && typeof track.vehicleReg === 'string') {
      return { kind: 'vehicle', vehicleReg: track.vehicleReg };
    }

    const user = this.verify(token, this.userSecret);
    if (user && typeof user.role === 'string' && STAFF_ROLES.includes(user.role)) {
      return { kind: 'fleet' };
    }

    throw new UnauthorizedException('Invalid or insufficient token');
  }

  canView(access: Access, vehicleReg: string): boolean {
    return access.kind === 'fleet' || access.vehicleReg === vehicleReg;
  }

  private verify(token: string, secret: string): jwt.JwtPayload | undefined {
    try {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
      return typeof payload === 'string' ? undefined : payload;
    } catch {
      return undefined;
    }
  }
}
```

`src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AccessService } from './access.service';

@Module({
  providers: [AccessService],
  exports: [AccessService],
})
export class AuthModule {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (6 tests).

- [ ] **Step 6: Scope the WebSocket gateway**

Replace `src/location/location.gateway.ts` with:

```ts
import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AccessService } from '../auth/access.service';

const FLEET_ROOM = 'fleet';

/**
 * Live Location API (component diagram: "Vehicle Tracking Service -> Live Location API
 * (WebSocket)"). A client authenticates once at connection time with `auth: { token }` and is
 * placed in the room it is allowed to see: staff see the whole fleet, ticket holders see only
 * the vehicle named in their tracking token.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class LocationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationGateway.name);

  constructor(private readonly accessService: AccessService) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      const access = this.accessService.authorize(token);
      client.join(access.kind === 'fleet' ? FLEET_ROOM : `vehicle:${access.vehicleReg}`);
      this.logger.debug(`Client ${client.id} joined as ${access.kind}`);
    } catch {
      client.emit('error', 'Unauthorized');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  broadcastLocation(vehicleReg: string, payload: Record<string, unknown>) {
    this.server.to(FLEET_ROOM).to(`vehicle:${vehicleReg}`).emit('location:update', payload);
  }
}
```

In `src/location/location.module.ts` import `AuthModule`:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LocationGateway } from './location.gateway';

@Module({
  imports: [AuthModule],
  providers: [LocationGateway],
  exports: [LocationGateway],
})
export class LocationModule {}
```

- [ ] **Step 7: Guard the REST endpoints**

In `src/vehicles/vehicles.module.ts` add `AuthModule` to `imports` (import it from `'../auth/auth.module'`).

Replace `src/vehicles/vehicles.controller.ts` with:

```ts
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { AccessService, bearerToken } from '../auth/access.service';
import { EtaService } from '../eta/eta.service';
import { TelemetryService } from '../telemetry/telemetry.service';

@Controller('api/vehicles')
export class VehiclesController {
  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly etaService: EtaService,
    private readonly accessService: AccessService,
  ) {}

  @Get()
  async listLive(@Headers('authorization') auth?: string) {
    const access = this.accessService.authorize(bearerToken(auth));
    if (access.kind !== 'fleet') {
      throw new ForbiddenException('Fleet view is for staff only');
    }
    return this.telemetryService.getAllLive();
  }

  @Get(':reg')
  async getOne(@Param('reg') reg: string, @Headers('authorization') auth?: string) {
    this.requireVehicle(auth, reg);
    const live = await this.telemetryService.getLive(reg);
    if (!live) {
      throw new NotFoundException(`No live position for vehicle ${reg} (offline or unseen)`);
    }
    return live;
  }

  @Get(':reg/eta')
  async eta(
    @Param('reg') reg: string,
    @Query('destLat') destLat: string,
    @Query('destLon') destLon: string,
    @Headers('authorization') auth?: string,
  ) {
    this.requireVehicle(auth, reg);
    if (!destLat || !destLon) {
      throw new BadRequestException('destLat and destLon query params are required');
    }
    const live = await this.telemetryService.getLive(reg);
    if (!live) {
      throw new NotFoundException(`No live position for vehicle ${reg}`);
    }
    const lat2 = parseFloat(destLat);
    const lon2 = parseFloat(destLon);
    const distanceKm = this.etaService.haversineKm(live.lat, live.lon, lat2, lon2);
    const etaSeconds = this.etaService.etaSeconds(live.lat, live.lon, lat2, lon2, live.speedKmh);
    return { vehicleReg: reg, distanceKm: Math.round(distanceKm * 100) / 100, etaSeconds, current: live };
  }

  private requireVehicle(auth: string | undefined, reg: string) {
    const access = this.accessService.authorize(bearerToken(auth));
    if (!this.accessService.canView(access, reg)) {
      throw new ForbiddenException('Your ticket does not cover this vehicle');
    }
  }
}
```

In `src/app.module.ts` add `AuthModule` to the `imports` array (import from `'./auth/auth.module'`).

- [ ] **Step 8: Build to verify everything compiles and tests still pass**

Run: `npm test`
Expected: PASS; `nest build` finishes with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add services/tracking-service
git commit -m "feat(tracking): require vehicle-scoped or staff tokens for live location"
```

---

### Task 7: user-service notifications

**Files:**
- Create: `.../entity/Notification.java`, `.../repository/NotificationRepository.java`, `.../dto/NotificationResponse.java`, `.../service/NotificationService.java`, `.../service/NotificationEventListener.java`, `.../controller/NotificationController.java`
- Modify: `.../config/KafkaTopicConfig.java`, `services/user-service/src/main/resources/application.yml`
- Test: `src/test/java/lk/transitlk/userservice/service/NotificationServiceTest.java`, `src/test/java/lk/transitlk/userservice/service/NotificationEventListenerTest.java`

(Paths under `services/user-service/src/main/java/lk/transitlk/userservice/`.)

**Interfaces:**
- Produces:
  - `Notification` entity: `UUID notificationId`, `UUID userId`, `String type`, `String title`, `String message`, `boolean seen`, `Instant createdAt`.
  - `NotificationRepository.findByUserIdOrderByCreatedAtDesc(UUID)`.
  - `record NotificationResponse(UUID notificationId, String type, String title, String message, boolean seen, Instant createdAt)` with `static from(Notification)`.
  - `NotificationService(NotificationRepository, UserRepository)` with `Notification create(UUID userId, String type, String title, String message)` (also logs a mock `[MOCK SMS]` line), `List<Notification> list(UUID userId)`, `Notification markSeen(UUID userId, UUID notificationId)` (404 `ApiException` if missing or not owned).
  - `NotificationEventListener(NotificationService, ObjectMapper)` with public `void handle(Map<String, Object> event)` and the Kafka entry `onEvent(String payload)`.
  - Endpoints (authenticated): `GET /api/notifications`, `POST /api/notifications/{id}/read`.
  - Event mapping: `TICKET_ISSUED` -> "Booking confirmed"; `TICKET_CANCELLED` -> "Ticket cancelled"; `PAYMENT_SUCCESS` -> "Payment received"; `PAYMENT_FAILED` -> "Payment failed"; `TRIP_STARTED` -> "Your bus is on the way" (one per id in `passengerIds`); `TRIP_CANCELLED` -> "Trip cancelled" (one per id in `passengerIds`). Other event types are ignored.

- [ ] **Step 1: Write the failing service test**

```java
package lk.transitlk.userservice.service;

import lk.transitlk.userservice.entity.Notification;
import lk.transitlk.userservice.exception.ApiException;
import lk.transitlk.userservice.repository.NotificationRepository;
import lk.transitlk.userservice.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
class NotificationServiceTest {

    @Autowired NotificationRepository notificationRepository;
    @Autowired UserRepository userRepository;

    private NotificationService service() {
        return new NotificationService(notificationRepository, userRepository);
    }

    @Test
    void createStoresAnUnseenNotificationForTheUser() {
        UUID user = UUID.randomUUID();

        Notification n = service().create(user, "TICKET_ISSUED", "Booking confirmed", "Fare: Rs. 222.50");

        assertThat(n.getNotificationId()).isNotNull();
        assertThat(n.isSeen()).isFalse();
        assertThat(service().list(user)).hasSize(1);
    }

    @Test
    void listReturnsOnlyTheUsersNotificationsNewestFirst() throws InterruptedException {
        UUID user = UUID.randomUUID();
        service().create(user, "A", "first", "m");
        Thread.sleep(5);
        service().create(user, "B", "second", "m");
        service().create(UUID.randomUUID(), "C", "other user", "m");

        List<Notification> list = service().list(user);

        assertThat(list).extracting(Notification::getTitle).containsExactly("second", "first");
    }

    @Test
    void markSeenFlagsOwnNotification() {
        UUID user = UUID.randomUUID();
        Notification n = service().create(user, "A", "t", "m");

        Notification updated = service().markSeen(user, n.getNotificationId());

        assertThat(updated.isSeen()).isTrue();
    }

    @Test
    void markSeenOnSomeoneElsesNotificationIsNotFound() {
        Notification n = service().create(UUID.randomUUID(), "A", "t", "m");

        assertThatThrownBy(() -> service().markSeen(UUID.randomUUID(), n.getNotificationId()))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
```

- [ ] **Step 2: Write the failing listener test**

```java
package lk.transitlk.userservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class NotificationEventListenerTest {

    @Mock NotificationService notificationService;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @InjectMocks NotificationEventListener listener;

    private final UUID passenger = UUID.randomUUID();

    @Test
    void ticketIssuedBecomesBookingConfirmation() {
        listener.handle(Map.of("eventType", "TICKET_ISSUED", "passengerId", passenger.toString(), "fare", "222.50"));

        verify(notificationService).create(eq(passenger), eq("TICKET_ISSUED"), eq("Booking confirmed"), contains("222.50"));
    }

    @Test
    void paymentSuccessBecomesReceipt() {
        listener.handle(Map.of("eventType", "PAYMENT_SUCCESS", "passengerId", passenger.toString(),
                "amount", "222.50", "method", "CARD", "txnRef", "TXN-1"));

        verify(notificationService).create(eq(passenger), eq("PAYMENT_SUCCESS"), eq("Payment received"), contains("TXN-1"));
    }

    @Test
    void paymentFailureIsReported() {
        listener.handle(Map.of("eventType", "PAYMENT_FAILED", "passengerId", passenger.toString(),
                "amount", "222.50", "method", "CARD", "txnRef", "TXN-2"));

        verify(notificationService).create(eq(passenger), eq("PAYMENT_FAILED"), eq("Payment failed"), anyString());
    }

    @Test
    void tripStartedNotifiesEveryListedPassenger() {
        UUID other = UUID.randomUUID();
        listener.handle(Map.of("eventType", "TRIP_STARTED", "routeName", "Colombo - Kandy Express",
                "vehicleReg", "NB-1234", "passengerIds", List.of(passenger.toString(), other.toString())));

        verify(notificationService).create(eq(passenger), eq("TRIP_STARTED"), eq("Your bus is on the way"), contains("NB-1234"));
        verify(notificationService).create(eq(other), eq("TRIP_STARTED"), eq("Your bus is on the way"), contains("NB-1234"));
    }

    @Test
    void tripCancelledNotifiesPassengers() {
        listener.handle(Map.of("eventType", "TRIP_CANCELLED", "routeName", "Colombo - Kandy Express",
                "vehicleReg", "NB-1234", "passengerIds", List.of(passenger.toString())));

        verify(notificationService).create(eq(passenger), eq("TRIP_CANCELLED"), eq("Trip cancelled"), contains("Colombo - Kandy Express"));
    }

    @Test
    void unknownEventTypesAreIgnored() {
        listener.handle(Map.of("eventType", "TICKET_VALIDATED", "passengerId", passenger.toString()));

        verify(notificationService, never()).create(org.mockito.ArgumentMatchers.any(), anyString(), anyString(), anyString());
    }

    @Test
    void malformedJsonPayloadDoesNotThrow() {
        listener.onEvent("{not json");

        verify(notificationService, never()).create(org.mockito.ArgumentMatchers.any(), anyString(), anyString(), anyString());
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run (in `services/user-service`): `mvn -q test -Dtest='NotificationServiceTest,NotificationEventListenerTest'`
Expected: FAIL, compilation errors (`Notification`, `NotificationService`, ... missing).

- [ ] **Step 4: Add entity, repository and DTO**

`entity/Notification.java`:

```java
package lk.transitlk.userservice.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
public class Notification {

    @Id
    @GeneratedValue
    private UUID notificationId;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 1000)
    private String message;

    @Column(name = "seen", nullable = false)
    private boolean seen = false;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
```

`repository/NotificationRepository.java`:

```java
package lk.transitlk.userservice.repository;

import lk.transitlk.userservice.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
```

`dto/NotificationResponse.java`:

```java
package lk.transitlk.userservice.dto;

import lk.transitlk.userservice.entity.Notification;

import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(UUID notificationId, String type, String title, String message,
                                   boolean seen, Instant createdAt) {
    public static NotificationResponse from(Notification n) {
        return new NotificationResponse(n.getNotificationId(), n.getType(), n.getTitle(), n.getMessage(),
                n.isSeen(), n.getCreatedAt());
    }
}
```

- [ ] **Step 5: Write NotificationService**

```java
package lk.transitlk.userservice.service;

import lk.transitlk.userservice.entity.Notification;
import lk.transitlk.userservice.exception.ApiException;
import lk.transitlk.userservice.repository.NotificationRepository;
import lk.transitlk.userservice.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** FR7 - stores in-app notifications and logs a mock SMS (no real SMS gateway in the prototype). */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository notificationRepository, UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public Notification create(UUID userId, String type, String title, String message) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type);
        n.setTitle(title);
        n.setMessage(message);
        Notification saved = notificationRepository.save(n);
        userRepository.findById(userId).ifPresent(u ->
                log.info("[MOCK SMS] to {}: {} - {}", u.getPhone(), title, message));
        return saved;
    }

    @Transactional(readOnly = true)
    public List<Notification> list(UUID userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public Notification markSeen(UUID userId, UUID notificationId) {
        Notification n = notificationRepository.findById(notificationId)
                .filter(x -> x.getUserId().equals(userId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Notification not found"));
        n.setSeen(true);
        return notificationRepository.save(n);
    }
}
```

- [ ] **Step 6: Write the Kafka listener**

```java
package lk.transitlk.userservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Turns domain events from ticketing into passenger notifications. Payloads are read as plain
 * JSON strings so no producer type headers or trusted-package configuration is needed.
 */
@Component
public class NotificationEventListener {

    private static final Logger log = LoggerFactory.getLogger(NotificationEventListener.class);

    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    public NotificationEventListener(NotificationService notificationService, ObjectMapper objectMapper) {
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = {"ticket-events", "payment-events", "trip-events"})
    public void onEvent(String payload) {
        try {
            handle(objectMapper.readValue(payload, new TypeReference<Map<String, Object>>() {
            }));
        } catch (Exception e) {
            log.warn("Skipping unreadable event: {}", e.getMessage());
        }
    }

    public void handle(Map<String, Object> event) {
        String type = String.valueOf(event.get("eventType"));
        switch (type) {
            case "TICKET_ISSUED" -> toPassenger(event, type, "Booking confirmed",
                    "Your ticket is confirmed. Fare: Rs. " + event.get("fare"));
            case "TICKET_CANCELLED" -> toPassenger(event, type, "Ticket cancelled",
                    "Your ticket has been cancelled.");
            case "PAYMENT_SUCCESS" -> toPassenger(event, type, "Payment received",
                    "Rs. " + event.get("amount") + " paid via " + event.get("method")
                            + " (ref " + event.get("txnRef") + ").");
            case "PAYMENT_FAILED" -> toPassenger(event, type, "Payment failed",
                    "Your payment of Rs. " + event.get("amount") + " could not be processed (ref "
                            + event.get("txnRef") + ").");
            case "TRIP_STARTED" -> toAll(event, type, "Your bus is on the way",
                    event.get("routeName") + " (" + event.get("vehicleReg") + ") has departed. You can now track it live.");
            case "TRIP_CANCELLED" -> toAll(event, type, "Trip cancelled",
                    event.get("routeName") + " was cancelled by the operator.");
            default -> {
                // not a passenger-facing event
            }
        }
    }

    private void toPassenger(Map<String, Object> event, String type, String title, String message) {
        notificationService.create(UUID.fromString(String.valueOf(event.get("passengerId"))), type, title, message);
    }

    private void toAll(Map<String, Object> event, String type, String title, String message) {
        Object ids = event.get("passengerIds");
        if (ids instanceof List<?> list) {
            for (Object id : list) {
                notificationService.create(UUID.fromString(String.valueOf(id)), type, title, message);
            }
        }
    }
}
```

- [ ] **Step 7: Write the controller**

```java
package lk.transitlk.userservice.controller;

import lk.transitlk.userservice.dto.NotificationResponse;
import lk.transitlk.userservice.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> mine(Authentication authentication) {
        UUID userId = UUID.fromString(authentication.getName());
        return ResponseEntity.ok(notificationService.list(userId).stream().map(NotificationResponse::from).toList());
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> read(Authentication authentication, @PathVariable UUID id) {
        UUID userId = UUID.fromString(authentication.getName());
        return ResponseEntity.ok(NotificationResponse.from(notificationService.markSeen(userId, id)));
    }
}
```

No `SecurityConfig` change is needed: `anyRequest().authenticated()` already covers `/api/notifications`.

- [ ] **Step 8: Configure the consumer and topics**

In `services/user-service/src/main/resources/application.yml`, under `spring.kafka:` (sibling of `producer:`) add:

```yaml
    consumer:
      group-id: user-service-notifications
      auto-offset-reset: earliest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.apache.kafka.common.serialization.StringDeserializer
```

In `config/KafkaTopicConfig.java` add so the listener never starts before its topics exist:

```java
    @Bean
    public NewTopic ticketEventsTopic() {
        return TopicBuilder.name("ticket-events").partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic paymentEventsTopic() {
        return TopicBuilder.name("payment-events").partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic tripEventsTopic() {
        return TopicBuilder.name("trip-events").partitions(3).replicas(1).build();
    }
```

- [ ] **Step 9: Run the full user-service suite**

Run: `mvn -q test`
Expected: PASS for `DemoUserSeederTest`, `NotificationServiceTest`, `NotificationEventListenerTest`.

- [ ] **Step 10: Commit**

```bash
git add services/user-service
git commit -m "feat(user): Kafka-driven passenger notifications with mock SMS"
```

---

### Task 8: gateway, compose wiring and end-to-end smoke test

**Files:**
- Modify: `gateway/kong.yml`, `docker-compose.yml`, `README.md`
- Create: `scripts/smoke-backend.mjs`

**Interfaces:**
- Consumes: every endpoint from Tasks 1-7. Kong base URL `http://localhost:8000`, tracking-service direct `http://localhost:8083`.
- Produces: routes `/api/notifications` (user-service), `/api/operator` and `/api/regulator` (ticketing-service) through Kong; `node scripts/smoke-backend.mjs` exits 0 only if the whole demo story passes.

- [ ] **Step 1: Add Kong routes**

In `gateway/kong.yml`, under `user-service-route` `paths:` add `- /api/notifications`; under `ticketing-service-route` `paths:` add `- /api/operator` and `- /api/regulator`.

- [ ] **Step 2: Add compose environment**

In `docker-compose.yml`:
- `ticketing-service.environment`: add `TRACKING_TOKEN_SECRET: transitlk-tracking-token-secret-32bytes-min`
- `tracking-service.environment`: add `JWT_SECRET: transitlk-dev-secret-key-change-me-please-32bytes+` and `TRACKING_TOKEN_SECRET: transitlk-tracking-token-secret-32bytes-min`

- [ ] **Step 3: Write the smoke script**

Create `scripts/smoke-backend.mjs`:

```js
// End-to-end check of the backend demo story. Needs the stack from `docker compose up --build`
// on a fresh database (docker compose down -v first). Node 18+.
const API = process.env.API_URL || 'http://localhost:8000';
const TRACKING = process.env.TRACKING_URL || 'http://localhost:8083';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ' ' + detail}`);
  if (!ok) failures++;
};

async function call(base, method, path, token, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

async function login(email) {
  const r = await call(API, 'POST', '/api/auth/login', null, { emailOrPhone: email, password: 'demo1234' });
  if (r.status !== 200) throw new Error(`login ${email} failed: ${r.status}`);
  return r.json.token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, tries = 15) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await sleep(1000);
  }
  return null;
}

const passenger = await login('passenger@transitlk.lk');
const conductor = await login('conductor@transitlk.lk');
const operator = await login('operator@transitlk.lk');
const regulator = await login('regulator@transitlk.lk');

const trips = await call(API, 'GET', '/api/trips?status=SCHEDULED', conductor);
check('conductor lists scheduled trips', trips.status === 200 && trips.json.length > 0, JSON.stringify(trips));
const trip = trips.json.find((t) => t.vehicleReg === 'NB-1234');
check('seeded trip NB-1234 is owned by the demo operator', trip && trip.operatorId === '00000000-0000-0000-0000-0000000000a1');

const booking = await call(API, 'POST', '/api/bookings', passenger, { tripId: trip.tripId, seatNo: 1, paymentMethod: 'CARD' });
check('passenger books a ticket', booking.status === 200, JSON.stringify(booking));
const ticket = booking.json;

const early = await call(API, 'POST', `/api/tickets/${ticket.ticketId}/track-token`, passenger);
check('track token refused before the trip starts', early.status === 409, String(early.status));

const noAuth = await call(TRACKING, 'GET', '/api/vehicles');
check('fleet list needs a token', noAuth.status === 401, String(noAuth.status));

const started = await call(API, 'POST', `/api/trips/${trip.tripId}/start`, conductor);
check('conductor starts the trip', started.status === 200 && started.json.status === 'ONGOING', JSON.stringify(started));

const track = await call(API, 'POST', `/api/tickets/${ticket.ticketId}/track-token`, passenger);
check('ticket owner gets a track token', track.status === 200 && !!track.json.token, JSON.stringify(track));

await call(TRACKING, 'POST', '/api/telemetry', null, { vehicleReg: 'NB-1234', lat: 6.93, lon: 79.86, speedKmh: 40 });
await call(TRACKING, 'POST', '/api/telemetry', null, { vehicleReg: 'SP-9012', lat: 6.5, lon: 80.0, speedKmh: 40 });
const own = await call(TRACKING, 'GET', '/api/vehicles/NB-1234', track.json.token);
check('track token shows the paid bus', own.status === 200 && own.json.vehicleReg === 'NB-1234', JSON.stringify(own));
const other = await call(TRACKING, 'GET', '/api/vehicles/SP-9012', track.json.token);
check('track token cannot see another bus', other.status === 403, String(other.status));
const fleetAsPassenger = await call(TRACKING, 'GET', '/api/vehicles', track.json.token);
check('track token cannot list the fleet', fleetAsPassenger.status === 403, String(fleetAsPassenger.status));
const fleet = await call(TRACKING, 'GET', '/api/vehicles', operator);
check('operator sees the whole fleet', fleet.status === 200 && fleet.json.length >= 2, JSON.stringify(fleet));

const notes = await waitFor(async () => {
  const r = await call(API, 'GET', '/api/notifications', passenger);
  const titles = (r.json || []).map((n) => n.title);
  return titles.includes('Booking confirmed') && titles.includes('Payment received') && titles.includes('Your bus is on the way') ? titles : null;
});
check('passenger receives booking, payment and trip-started notifications', !!notes, 'timed out');

const validated = await call(API, 'POST', '/api/tickets/validate', conductor, { qrCode: ticket.qrCode });
check('conductor validates the QR', validated.status === 200 && validated.json.valid === true, JSON.stringify(validated));
const again = await call(API, 'POST', '/api/tickets/validate', conductor, { qrCode: ticket.qrCode });
check('second validation is refused', again.status === 200 && again.json.valid === false, JSON.stringify(again));

const completed = await call(API, 'POST', `/api/trips/${trip.tripId}/complete`, conductor);
check('trip completes with reconciliation 1 issued / 1 validated',
  completed.status === 200 && completed.json.ticketsIssued === 1 && completed.json.ticketsValidated === 1, JSON.stringify(completed));

const summary = await call(API, 'GET', '/api/operator/reports/summary', operator);
check('operator summary shows revenue', summary.status === 200 && Number(summary.json.totalRevenue) > 0, JSON.stringify(summary));
const notOperator = await call(API, 'GET', '/api/operator/reports/summary', passenger);
check('passenger cannot read the operator report', notOperator.status === 403, String(notOperator.status));

const analytics = await call(API, 'GET', '/api/regulator/analytics', regulator);
check('regulator analytics include punctuality', analytics.status === 200 &&
  analytics.json.routes.some((r) => r.avgDelayMinutes !== null), JSON.stringify(analytics));

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 4: Document the demo accounts**

In `README.md` add a section "Demo accounts" listing the four accounts and the password `demo1234`, a note that `docker compose down -v` is required once after upgrading, and the command `node scripts/smoke-backend.mjs`.

- [ ] **Step 5: Run the stack and the smoke test**

Run:

```bash
docker compose down -v
docker compose up --build -d
# wait ~60 s for services to become healthy, then:
node scripts/smoke-backend.mjs
```

Expected: every line `PASS`, final `All checks passed.`, exit code 0. If a check fails, run `docker compose logs <service>` for the failing service and fix before continuing.

- [ ] **Step 6: Commit**

```bash
git add gateway docker-compose.yml README.md scripts
git commit -m "feat: wire gateway and compose for new backend features, add smoke test"
```

---

## Self-Review

**Spec coverage**
- A (conductor trip controls, backend): Task 2. Web `/trips` page and offline queue: Plan 2.
- B (notifications, mock SMS, polling API): Task 7; Kafka trip events: Tasks 2-3. Expo polling UI: Plan 3.
- C (operator trips, cancel, summary, `operatorId`): Tasks 2-3. Web `/operator`: Plan 2.
- D (REGULATOR role, analytics incl. punctuality via `startedAt`): Tasks 1, 2, 4. Web `/regulator`: Plan 2.
- E (ticket-gated tracking, no global broadcast, staff fleet access): Tasks 5-6.
- F (Expo app): Plan 3.
- Testing and demo script: unit tests per task; Task 8 smoke script follows the demo story. "Vehicle approaching" alert and device-key telemetry protection are explicitly out of scope.

**Placeholder scan:** none; every code step contains code.

**Type consistency:** `TripDto`, `ManifestEntry`, `publishTripEvent(String, Trip, List<UUID>)`, `TestData` helpers, `TrackTokenResponse(token, vehicleReg, expiresAt)`, `Access`, `bearerToken` and the `purpose=track` claim are named identically in the tasks that define and use them. The demo operator id `...a1` matches in `DemoUserSeeder`, `DataSeeder`, `TestData` and the smoke script.
