package com.homeplate.schedule;

import com.homeplate.entity.book.Games;
import com.homeplate.repository.jpa.GameRepository;
import com.homeplate.service.RedisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class QueueScheduler {
    private final RedisService redisService;
    private final GameRepository repo;
    // 서버 성능에 따라 입장 인원 조절
    private static final long ENTER_RATE = 50L;

    @Scheduled(fixedDelay = 1000)
    public void scheduledQueue() {
        List<Games> games = repo.findAllByGameStartAtAfterOrderByGameStartAtAsc(LocalDateTime.now());

        for (Games game : games) {
            Long gameId = game.getGameId();
            redisService.toActivate(gameId, ENTER_RATE);
        }
    }
}
