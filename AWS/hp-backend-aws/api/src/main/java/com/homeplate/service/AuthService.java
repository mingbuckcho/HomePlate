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
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

@Slf4j
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
    private final JavaMailSender mailSender;
    private final StringRedisTemplate template;

    private static final String EMAILCODE_KEY = "auth:code:%s";
    private static final String EMAILVERIFIED_KEY = "auth:verified:%s";

    /**
     *
     * 이메일 인증코드 요청
     */
    public void sendCode(String email) {
        if (userRepo.existsByEmail(email)) {
            throw new CustomException(ErrorCode.EMAIL_ALREADY_EXIST);
        }

        SecureRandom secureRandom = new SecureRandom();
        int random = secureRandom.nextInt(900000) + 100000;
        String code = String.valueOf(random);
        String key = String.format(EMAILCODE_KEY, email);

        // TTL 5분
        template.opsForValue().set(key, code, Duration.ofMinutes(5));

        try {
            sendEmail(email, code);
        } catch (Exception e) {
            log.error("메일 전송 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.EMAIL_SEND_FAILED);
        }
    }

    private void sendEmail(String email, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("[HomePlate] 회원가입 인증코드");
        message.setText("인증코드: " + code + "\n\n5분 안에 입력해주세요.");
        mailSender.send(message);
        log.info("이메일 발송 완료: {}", email);
    }

    /**
     *
     * 이메일 인증코드 확인
     */
    public void verifyCode(String email, String code) {
        String key = String.format(EMAILCODE_KEY, email);
        String savedCode = template.opsForValue().get(key);

        if (savedCode == null) {
            throw new CustomException(ErrorCode.AUTHCODE_NOT_FOUND);
        }
        if (!savedCode.equals(code)) {
            throw new CustomException(ErrorCode.AUTHCODE_NOT_MATCH);
        }

        String verifiedKey = String.format(EMAILVERIFIED_KEY, email);
        template.opsForValue().set(verifiedKey, "true", Duration.ofMinutes(30));
        template.delete(key);
    }

    /**
     *
     * 회원가입
     */
    @Transactional
    public void signup(SignUpRequest request) {
        String key = String.format(EMAILVERIFIED_KEY, request.getEmail());
        String isVerified = template.opsForValue().get(key);

        if (!"true".equals(isVerified)) {
            throw new CustomException(ErrorCode.EMAIL_NOT_VERIFIED);
        }
        if (userRepo.existsByEmail(request.getEmail())) {
            throw new CustomException(ErrorCode.EMAIL_ALREADY_EXIST);
        }

        Users user = request.toEntity(passwordEncoder);
        userRepo.save(user);

        template.delete(key);
    }

    /**
     *
     * 로그인 (accessToken, refreshToken 발급)
     */
    @Transactional
    public LoginResponse login(LoginRequest request) {
        log.info("🚨🚨🚨 [CI/CD 배포 팩트체크] 로그인 API가 호출되었습니다! ID: {} 🚨🚨🚨", request.getEmail());

        Users user = userRepo.findByEmail(request.getEmail())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new CustomException(ErrorCode.PASSWORD_NOT_MATCH);
        }

        String accessToken = jwt.createAccessToken(user.getUserId(), user.getEmail());
        String refreshToken = jwt.createRefreshToken(user.getUserId(), user.getEmail());

        tokenRepo.save(RefreshTokenEntity.builder()
                .email(user.getEmail())
                .token(refreshToken)
                .build());

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .userName(user.getUserName())
                .role(user.getRole().name())
                .build();
    }

    /**
     *
     * 로그아웃 (refreshToken, WAITING_TOKEN 삭제)
     */
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
    public String refresh(String refreshToken) {
        if (!jwt.validateToken(refreshToken)) {
            throw new CustomException(ErrorCode.TOKEN_NOT_VALID);
        }

        String email = jwt.getEmail(refreshToken);

        RefreshTokenEntity token = tokenRepo.findById(email)
                .orElseThrow(() -> new CustomException(ErrorCode.REFRESHTOKEN_NOT_FOUND));

        if (!token.getToken().equals(refreshToken)) {
            throw new CustomException(ErrorCode.TOKEN_NOT_VALID);
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
