package com.homeplate.schedule;

import com.homeplate.entity.outbox.HistoryStatus;
import com.homeplate.entity.outbox.OutboxEvents;
import com.homeplate.entity.outbox.OutboxHistory;
import com.homeplate.entity.outbox.OutboxStatus;
import com.homeplate.initializer.Outboxinitializer;
import com.homeplate.repository.jpa.OutboxHistoryRepository;
import com.homeplate.repository.jpa.OutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;


@Slf4j
@Component
@RequiredArgsConstructor
@Profile("worker")
public class OutboxScheduler {
    private final OutboxRepository outboxRepo;
    private final OutboxHistoryRepository historyRepo;
    private final Outboxinitializer init;
    private final KafkaTemplate<String, String> template;

    @Value("${TOPIC_NOTIFICATION}")
    private String topics;

    private static final int MAX_RETRY_COUNT = 3;

    @Scheduled(fixedDelay = 5000)
    @Transactional
    public void process() {
        List<OutboxEvents> events = outboxRepo.findTop10ByOutboxStatusAndLockedAtIsNullOrderByCreatedAtAsc(OutboxStatus.PENDING);

        if (events.isEmpty()) return;

        String workerId = init.getWorkerId();

        for (OutboxEvents event : events) {
            try {
                event.setLockedAt(LocalDateTime.now());
                event.setLockedBy(workerId);
                event.setOutboxStatus(OutboxStatus.SENDING);

                template.send(topics, event.getPayload());

                event.setOutboxStatus(OutboxStatus.SENT);
                event.setLockedAt(null);

                save(event, HistoryStatus.SUCCESS);
                log.info("[{}] Published to Kafka & History Saved: EventID={}", workerId, event.getEventId());

            } catch (Exception e) {
                int currentRetry = event.getRetryCount() + 1;
                event.setRetryCount(currentRetry);
                event.setLastError(e.getMessage());
                event.setLockedAt(null);

                if (currentRetry >= MAX_RETRY_COUNT) {
                    event.setOutboxStatus(OutboxStatus.FAILED);

                    save(event, HistoryStatus.FAILURE);
                    log.error("[{}] Max Retries Reached. History Saved(FAILURE): EventID={}, Error={}", workerId, event.getEventId(), e.getMessage());
                } else {
                    event.setOutboxStatus(OutboxStatus.PENDING);
                    log.warn("[{}] Failed to publish (Retry {}/{}): EventID={}", workerId, currentRetry, MAX_RETRY_COUNT, event.getEventId());
                }
            }
        }
    }

    private void save(OutboxEvents event, HistoryStatus status) {
        OutboxHistory history = OutboxHistory.builder()
                .orderId(event.getOrderId())
                .userId(event.getUserId())
                .dedupeKey(event.getEventId().toString())
                .historyStatus(status)
                .sentAt(LocalDateTime.now())
                .build();

        historyRepo.save(history);
    }

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void cleanUp() {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(7);
        List<OutboxStatus> targetStatuses = List.of(OutboxStatus.SENT, OutboxStatus.FAILED);
        log.info("[Cleanup] Starting cleanup for events older than {}", cutoffDate);

        int deletedCount = outboxRepo.deleteOldEvents(targetStatuses, cutoffDate);
        log.info("[Cleanup] Completed. Deleted {} old outbox events.", deletedCount);
    }
}
