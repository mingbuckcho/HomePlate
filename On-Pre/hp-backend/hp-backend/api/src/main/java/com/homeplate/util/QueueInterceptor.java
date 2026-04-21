package com.homeplate.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.homeplate.dto.error.ErrorResponse;
import com.homeplate.exception.ErrorCode;
import com.homeplate.service.RedisService;
import com.homeplate.util.auth.UserDetailsImpl;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import java.io.IOException;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class QueueInterceptor implements HandlerInterceptor {
    private final RedisService redisService;
    private final ObjectMapper mapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !(auth.getPrincipal() instanceof UserDetailsImpl)) {
            return true;
        }

        UserDetailsImpl userDetails = (UserDetailsImpl) auth.getPrincipal();
        Long userId = userDetails.getUser().getUserId();

        Map<?, ?> path = (Map<?, ?>) request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (path == null || !path.containsKey("gameId")) {
            return true;
        }

        try {
            Long gameId = Long.parseLong(String.valueOf(path.get("gameId")));

            if (!redisService.isActive(gameId, userId)) {
                sendErrorResponse(response, ErrorCode.ACCESS_DENIED_NOT_ACTIVE);
                return false;
            }
        } catch (NumberFormatException e) {
            return true;
        }

        return true;
    }

    private void sendErrorResponse(HttpServletResponse response, ErrorCode errorCode) throws IOException {
        response.setStatus(errorCode.getHttpStatus().value());
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        ErrorResponse errorResponse = ErrorResponse.builder()
                .status(errorCode.getHttpStatus().value())
                .error(errorCode.getHttpStatus().name())
                .code(errorCode.name())
                .message(errorCode.getMessage())
                .build();

        String json = mapper.writeValueAsString(errorResponse);
        response.getWriter().write(json);
    }
}