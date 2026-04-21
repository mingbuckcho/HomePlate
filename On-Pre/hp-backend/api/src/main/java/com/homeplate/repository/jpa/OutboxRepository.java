package com.homeplate.repository.jpa;

import com.homeplate.entity.outbox.OutboxEvents;
import com.homeplate.entity.outbox.OutboxStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OutboxRepository extends JpaRepository<OutboxEvents, Long> {
    List<OutboxEvents> findTop10ByOutboxStatusAndLockedAtIsNullOrderByCreatedAtAsc(OutboxStatus status);

    @Modifying
    @Query("DELETE FROM OutboxEvents e WHERE e.outboxStatus IN :statuses AND e.createdAt < :cutoffDate")
    int deleteOldEvents(@Param("statuses") List<OutboxStatus> statuses, @Param("cutoffDate") LocalDateTime cutoffDate);
}
