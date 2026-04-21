package com.homeplate.dto.auth;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class LoginResponse {
    private String accessToken;
    @JsonIgnore
    private String refreshToken;
    private String userName;
}
