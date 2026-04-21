package com.homeplate.controller;

import com.homeplate.dto.auth.LoginRequest;
import com.homeplate.dto.auth.LoginResponse;
import com.homeplate.dto.auth.SignUpRequest;
import com.homeplate.exception.CustomException;
import com.homeplate.exception.ErrorCode;
import com.homeplate.util.auth.UserDetailsImpl;
import com.homeplate.service.AuthService;
import com.homeplate.util.auth.CookieUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "1. Auth", description = "회원가입/로그인 API")
public class AuthController {
    private final AuthService service;
    private final CookieUtil cookieUtil;

    @PostMapping("/signup")
    @Operation(summary = "회원가입", description = "신규 회원을 등록합니다.")
    public ResponseEntity<String> signup(@Valid @RequestBody SignUpRequest request) {

        service.signup(request);
        return ResponseEntity.status(HttpStatus.CREATED).body("회원가입 성공");
    }

    @PostMapping("/login")
    @Operation(summary = "로그인", description = "Access Token은 Body로, Refresh Token은 Cookie로 발급합니다.")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request,
                                               HttpServletResponse response) {

        LoginResponse loginResponse = service.login(request);
        cookieUtil.addCookie(response, "RefreshToken", loginResponse.getRefreshToken(), 7 * 24 * 60 * 60);
        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("/logout")
    @Operation(summary = "로그아웃", description = "Redis DB의 Token을 삭제하고, browser의 Cookie를 삭제합니다.")
    public ResponseEntity<String> logout(@AuthenticationPrincipal UserDetailsImpl userDetails,
                                         HttpServletResponse response) {

        service.logout(userDetails.getUsername());
        cookieUtil.deleteCookie(response, "RefreshToken");
        return ResponseEntity.ok("로그아웃 성공");
    }

    @PostMapping("/refresh")
    @Operation(summary = "토큰 재발급", description = "Cookie에 있는 Refresh Token으로 재발급합니다.")
    public ResponseEntity<String> refresh(@CookieValue(value = "RefreshToken", required = false) String refreshToken) {

        if (refreshToken == null) {
            throw new CustomException(ErrorCode.REFRESH_TOKEN_MISSING);
        }

        String newAccessToken = service.refresh(refreshToken);
        return ResponseEntity.ok(newAccessToken);
    }
}
