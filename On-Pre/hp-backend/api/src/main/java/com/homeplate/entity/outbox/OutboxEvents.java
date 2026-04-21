package com.homeplate.entity.outbox;

import com.homeplate.entity.AtEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
@Table(name = "outbox_events")
public class OutboxEvents extends AtEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "outbox_id", nullable = false)
    private Long outboxId;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "event_id", nullable = false, unique = true, length = 36)
    private String eventId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false)
    private EventType eventType;

    @Column(nullable = false, length = 50)
    private String topic;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, columnDefinition = "json")
    private String payload;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Setter
    @Column(nullable = false, length = 20)
    private OutboxStatus outboxStatus = OutboxStatus.PENDING;

    @Builder.Default
    @Setter
    @Column(name = "retry_count")
    private int retryCount = 0;

    @Setter
    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    @Setter
    @Column(name = "locked_at")
    private LocalDateTime lockedAt;

    @Setter
    @Column(name = "locked_by", length = 64)
    private String lockedBy;

    public static OutboxEvents create(Long orderId, Long userId, EventType type, String payload) {
        return OutboxEvents.builder()
                .orderId(orderId)
                .userId(userId)
                .eventId(UUID.randomUUID().toString())
                .eventType(type)
                .topic("ticket.notifications")
                .payload(payload)
                .outboxStatus(OutboxStatus.PENDING)
                .build();
    }
}
