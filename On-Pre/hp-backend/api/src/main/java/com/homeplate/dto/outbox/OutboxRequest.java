package com.homeplate.dto.outbox;

import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OutboxRequest {
    private Long orderId;
    private Long userId;
    private String email;

    public static OutboxRequest create(Long orderId, Long userId, String email) {
        return OutboxRequest.builder()
                .orderId(orderId)
                .userId(userId)
                .email(email)
                .build();
    }
}
