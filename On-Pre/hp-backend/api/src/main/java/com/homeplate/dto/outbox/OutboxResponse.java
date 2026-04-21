package com.homeplate.dto.outbox;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.homeplate.entity.outbox.HistoryStatus;
import com.homeplate.entity.outbox.OutboxHistory;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class OutboxResponse {
    private Long historyId;
    private Long orderId;
    private Long userId;
    private HistoryStatus historyStatus;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime sentAt;

    public static OutboxResponse from(OutboxHistory history) {
        return OutboxResponse.builder()
                .historyId(history.getHistoryId())
                .orderId(history.getOrderId())
                .userId(history.getUserId())
                .historyStatus(history.getHistoryStatus())
                .sentAt(history.getSentAt())
                .build();
    }
}
