package lk.transitlk.userservice.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaTopicConfig {

    @Bean
    public NewTopic userEventsTopic() {
        return TopicBuilder.name("user-events").partitions(3).replicas(1).build();
    }

    // Declared here too so the notification listener never starts before its topics exist.
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
}
