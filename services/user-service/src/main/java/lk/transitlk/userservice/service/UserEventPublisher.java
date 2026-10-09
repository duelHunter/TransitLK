package lk.transitlk.userservice.service;

import lk.transitlk.userservice.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

@Component
public class UserEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(UserEventPublisher.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public UserEventPublisher(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishUserRegistered(User user) {
        Map<String, Object> event = Map.of(
                "eventType", "USER_REGISTERED",
                "userId", user.getUserId().toString(),
                "role", user.getRole().name(),
                "email", user.getEmail(),
                "timestamp", Instant.now().toString()
        );
        kafkaTemplate.send("user-events", user.getUserId().toString(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.warn("Failed to publish USER_REGISTERED event: {}", ex.getMessage());
                    }
                });
    }
}
