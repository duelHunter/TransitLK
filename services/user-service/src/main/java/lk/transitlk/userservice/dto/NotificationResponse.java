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
