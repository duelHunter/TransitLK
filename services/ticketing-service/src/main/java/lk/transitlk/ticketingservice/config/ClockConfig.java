package lk.transitlk.ticketingservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class ClockConfig {

    /** Injected so time-dependent logic (search windows) can be tested with a fixed clock. */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
