package com.homeplate.entity.outbox;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Table(name = "outbox_history")
public class OutboxHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "history_id", nullable = false)
    private Long historyId;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "dedupe_key", nullable = false, unique = true)
    private String dedupeKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "history_status", nullable = false)
    private HistoryStatus historyStatus;

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;
}
