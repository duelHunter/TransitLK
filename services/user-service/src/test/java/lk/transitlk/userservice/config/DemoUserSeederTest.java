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
