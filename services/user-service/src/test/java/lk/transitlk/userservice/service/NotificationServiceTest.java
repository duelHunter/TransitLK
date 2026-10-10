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
