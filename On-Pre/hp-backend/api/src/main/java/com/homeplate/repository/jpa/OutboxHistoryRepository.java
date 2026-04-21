package com.homeplate.repository.jpa;

import com.homeplate.entity.outbox.OutboxHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OutboxHistoryRepository extends JpaRepository<OutboxHistory, Long> {
}
