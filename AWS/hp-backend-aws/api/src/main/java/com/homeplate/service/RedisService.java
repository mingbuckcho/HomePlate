package com.homeplate.service;

import com.homeplate.exception.CustomException;
import com.homeplate.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class RedisService {
    private final StringRedisTemplate redis;
    private static final String WAITING_KEY = "queue:waiting:game:%d";
    private static final String ACTIVE_KEY = "queue:active:game:%d";
    private static final String RESERVE_KEY = "game:%d:seat:%s";

    /**
     *
     * WAITING_KEY
     */
    public void addQueue(Long gameId, Long userId) {
        String key = String.format(WAITING_KEY, gameId);
        long now = System.currentTimeMillis();

        redis.opsForZSet().addIfAbsent(key, String.valueOf(userId), now);
    }

    public Long getQueueRank(Long gameId, Long userId) {
        String key = String.format(WAITING_KEY, gameId);
        Long rank = redis.opsForZSet().rank(key, String.valueOf(userId));

        return (rank != null) ? rank + 1 : null;
    }

    /**
     *
     * ACTIVE_KEY
     */
    public boolean isActive(Long gameId, Long userId) {
        String key = String.format(ACTIVE_KEY, gameId);

        return Boolean.TRUE.equals(redis.opsForSet().isMember(key, String.valueOf(userId)));
    }

    public void toActivate(Long gameId, long count) {
        String waitingKey = String.format(WAITING_KEY, gameId);
        String activeKey = String.format(ACTIVE_KEY, gameId);

        Set<String> activate = redis.opsForZSet().range(waitingKey, 0, count - 1);
        if (activate == null || activate.isEmpty()) return;

        for (String userId : activate) {
            redis.opsForSet().add(activeKey, userId);
            redis.opsForZSet().remove(waitingKey, userId);
        }

        // Active Key TTL 10분
        redis.expire(activeKey, 10, TimeUnit.MINUTES);
    }

    public void removeQueue(Long gameId, Long userId) {
        String waitingKey = String.format(WAITING_KEY, gameId);
        String activeKey = String.format(ACTIVE_KEY, gameId);

        redis.opsForZSet().remove(waitingKey, String.valueOf(userId));
        redis.opsForSet().remove(activeKey, String.valueOf(userId));
    }

    /**
     *
     * RESERVE_KEY
     */
    public void tryLock(Long gameId, List<String> seatCodes, Long userId) {
        List<String> lockedSeats = new ArrayList<>();
        try {
            for (String seatCode : seatCodes) {
                if (!lockSeat(gameId, seatCode, userId)) {
                    throw new CustomException(ErrorCode.SEAT_ALREADY_LOCKED);
                }
                lockedSeats.add(seatCode);
            }
        } catch (Exception e) {
            for (String seat : lockedSeats) {
                unlockSeat(gameId, seat);
            }
            throw e;
        }
    }

    public boolean lockSeat(Long gameId, String seatCode, Long userId) {
        String key = String.format(RESERVE_KEY, gameId, seatCode);
        // 좌석 선점 TTL 5분
        return Boolean.TRUE.equals(redis.opsForValue()
                .setIfAbsent(key, String.valueOf(userId), Duration.ofMinutes(5)));
    }

    public void unlockSeat(Long gameId, String seatCode) {
        String key = String.format(RESERVE_KEY, gameId, seatCode);

        redis.delete(key);
    }

    public String getLockerId(Long gameId, String seatCode) {
        String key = String.format(RESERVE_KEY, gameId, seatCode);

        return redis.opsForValue().get(key);
    }

    public void verifyLocker(Long gameId, String seatCode, Long userId) {
        String lockerId = getLockerId(gameId, seatCode);
        if (lockerId == null || !lockerId.equals(String.valueOf(userId))) {
            throw new CustomException(ErrorCode.LOCKEXPIRED_OR_NOTMINE);
        }
    }
}
