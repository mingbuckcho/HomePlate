package com.homeplate.util.auth;

import com.homeplate.entity.auth.Users;
import com.homeplate.repository.jpa.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {
    private final JwtUtil jwt;
    private final UserRepository userRepo;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException {
        log.info("OAUTH Login Success");

        try {
            OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
            String email = oAuth2User.getAttribute("email");
            String name = oAuth2User.getAttribute("name");

            Users user = userRepo.findByEmail(email)
                    .orElseGet(() -> {
                        log.info("신규 구글 회원가입 진행: {}", email);
                        Users newUser = Users.socialUser(email, name);
                        return userRepo.save(newUser);
                    });

            String accessToken = jwt.createAccessToken(user.getUserId(), user.getEmail());
            String refreshToken = jwt.createRefreshToken(user.getUserId(), user.getEmail());

            String targetUrl = UriComponentsBuilder.fromUriString("https://homeplate.site/oauth2/redirect")
                    .queryParam("accessToken", accessToken)
                    .queryParam("refreshToken", refreshToken)
                    .build().toUriString();

            getRedirectStrategy().sendRedirect(request, response, targetUrl);
        } catch (Exception e) {
            log.error("OAuth2 로그인 처리 중 에러 발생", e);
            throw e;
        }
    }
}
