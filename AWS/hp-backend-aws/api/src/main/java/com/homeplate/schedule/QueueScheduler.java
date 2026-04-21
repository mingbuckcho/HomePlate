package com.homeplate.schedule;

import com.homeplate.entity.book.Games;
import com.homeplate.repository.jpa.GameRepository;
import com.homeplate.service.RedisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
@Profile("queue")
public class QueueScheduler {
    private final RedisService redisService;
    private final GameRepository repo;
    // 서버 성능에 따라 입장 인원 조절
    private static final long ENTER_RATE = 50L;

    @Scheduled(fixedDelay = 10000)
    @Transactional(readOnly = true)
    public void scheduledQueue() {
        LocalDateTime nowKst = ZonedDateTime.now(ZoneId.of("Asia/Seoul")).toLocalDateTime();
        List<Games> games = repo.findAllByGameStartAtAfterOrderByGameStartAtAsc(nowKst);

        log.info("🚨 [스케줄러 동작 확인] 현재 KST: {}, 찾은 게임 수: {} 🚨", nowKst, games.size());

        for (Games game : games) {
            Long gameId = game.getGameId();
            redisService.toActivate(gameId, ENTER_RATE);
        }
    }
}
