package com.homeplate.schedule;

import com.homeplate.entity.book.OrderStatus;
import com.homeplate.repository.jpa.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderScheduler {
    private final OrderRepository orderRepo;

    @Scheduled(cron = "0 0/1 * * * *")
    @Transactional
    public void expiredOrders() {
        LocalDateTime now = LocalDateTime.now();
        int updatedCount = orderRepo.expiredOrders(now, OrderStatus.EXPIRED);
        if (updatedCount > 0) {
            log.info("Expired {} orders because the game started.", updatedCount);
        }
    }
}
