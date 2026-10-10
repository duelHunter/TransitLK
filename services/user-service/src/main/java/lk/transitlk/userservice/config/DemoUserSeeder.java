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
