package com.homeplate.dto.queue;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class QueueResponse {
    private String status;
    private Long rank;

    public static QueueResponse active() {
        return QueueResponse.builder()
                .status("ACTIVE")
                .rank(0L)
                .build();
    }

    public static QueueResponse waiting(Long rank) {
        return QueueResponse.builder()
                .status("WAITING")
                .rank(rank)
                .build();
    }

    public static QueueResponse expired() {
        return QueueResponse.builder()
                .status("EXPIRED")
                .rank(null)
                .build();
    }
}
