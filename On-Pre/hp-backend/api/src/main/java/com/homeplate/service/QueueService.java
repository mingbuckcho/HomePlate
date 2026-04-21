package com.homeplate.service;

import com.homeplate.dto.queue.QueueResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QueueService {
    private final RedisService redisService;

    /**
     *
     * 대기열 진입 (Trace: Context)
     */
    public QueueResponse enterQueue(Long gameId, Long userId) {
        if (redisService.isActive(gameId, userId)) {
            return QueueResponse.active();
        }

        redisService.addQueue(gameId, userId);
        Long rank = redisService.getQueueRank(gameId, userId);

        return QueueResponse.waiting(rank);
    }

    /**
     *
     * 대기열 순번조회 (Trace: Context)
     */
    public QueueResponse getQueueStatus(Long gameId, Long userId) {
        if (redisService.isActive(gameId, userId)) {
            return QueueResponse.active();
        }

        Long rank = redisService.getQueueRank(gameId, userId);
        if (rank == null) {
            return QueueResponse.expired();
        }

        return QueueResponse.waiting(rank);
    }
}
