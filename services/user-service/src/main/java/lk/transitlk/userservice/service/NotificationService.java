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
