package com.homeplate.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.redis.core.RedisHash;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@RedisHash(value = "refreshToken", timeToLive = 60 * 60 * 24 * 7)
public class RefreshTokenEntity {
    @Id
    private String email;
    private String token;

    public static RefreshTokenEntity of(String email, String token) {
        return RefreshTokenEntity.builder()
                .email(email)
                .token(token)
                .build();
    }
}
