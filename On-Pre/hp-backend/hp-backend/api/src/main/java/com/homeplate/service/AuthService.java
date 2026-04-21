package com.homeplate.service;

import com.homeplate.dto.auth.LoginRequest;
import com.homeplate.dto.auth.LoginResponse;
import com.homeplate.dto.auth.SignUpRequest;
import com.homeplate.entity.book.Games;
import com.homeplate.entity.auth.Users;
import com.homeplate.entity.RefreshTokenEntity;
import com.homeplate.exception.CustomException;
import com.homeplate.exception.ErrorCode;
import com.homeplate.repository.jpa.GameRepository;
import com.homeplate.repository.redis.RefreshTokenRepository;
import com.homeplate.repository.jpa.UserRepository;
import com.homeplate.util.auth.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {
    private final UserRepository userRepo;
    private final RefreshTokenRepository tokenRepo;
    private final GameRepository gameRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwt;
    private final RedisService redisService;

    /**
     *
     * 회원가입
     */
    @Transactional
    public Long signup(SignUpRequest request) {
        if (userRepo.existsByEmail(request.getEmail())) {
            throw new CustomException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        Users user = request.toEntity(passwordEncoder);
        return userRepo.save(user).getUserId();
    }

    /**
     *
     * 로그인 (accessToken, refreshToken 발급)
     */
    @Transactional
    public LoginResponse login(LoginRequest request) {
        Users user = findUserByEmail(request.getEmail());
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new CustomException(ErrorCode.PASSWORD_NOT_MATCH);
        }

        String accessToken = jwt.createAccessToken(user.getUserId(), user.getEmail());
        String refreshToken = jwt.createRefreshToken(user.getUserId(), user.getEmail());

        tokenRepo.save(RefreshTokenEntity.of(user.getEmail(), refreshToken));

        return LoginResponse.from(accessToken, refreshToken, user.getUserName());
    }

    /**
     *
     * 로그아웃 (refreshToken, WAITING_TOKEN 삭제)
     */
    @Transactional
    public void logout(String email) {
        tokenRepo.findById(email)
                .ifPresent(tokenRepo::delete);

        Users user = findUserByEmail(email);
        List<Games> games = gameRepo.findAllByGameStartAtAfterOrderByGameStartAtAsc(LocalDateTime.now());

        for (Games game : games) {
            redisService.removeQueue(game.getGameId(), user.getUserId());
        }
    }

    /**
     *
     * 토큰재발급 (refreshToken 갱신)
     */
    @Transactional
    public String refresh(String refreshToken) {
        if (!jwt.validateToken(refreshToken)) {
            throw new CustomException(ErrorCode.INVALID_TOKEN);
        }

        String email = jwt.getEmail(refreshToken);

        RefreshTokenEntity token = tokenRepo.findById(email)
                .orElseThrow(() -> new CustomException(ErrorCode.REFRESH_TOKEN_NOT_FOUND));

        if (!token.getToken().equals(refreshToken)) {
            throw new CustomException(ErrorCode.INVALID_TOKEN);
        }

        Users user = findUserByEmail(email);

        return jwt.createAccessToken(user.getUserId(), user.getEmail());
    }

    /**
     * private helper methods
     */
    private Users findUserByEmail(String email) {
        return userRepo.findByEmail(email)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
