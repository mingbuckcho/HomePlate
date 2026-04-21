package com.homeplate.util;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(-101)
public class HttpRequestLogFilter extends OncePerRequestFilter {

    private static final Logger httpLogger = LoggerFactory.getLogger("http.request");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        long startTime = System.currentTimeMillis();

        // 🌟 핵심 수정: filterChain.doFilter()를 타기 전에, 미리 Trace 정보를 캡처합니다!
        // 모니터링 팀의 요청대로 MDC에 의존하지 않고 OTEL의 Span을 직접 읽어옵니다.
        SpanContext spanContext = Span.current().getSpanContext();
        String capturedTraceId = "";
        String capturedSpanId = "";

        if (spanContext.isValid()) {
            capturedTraceId = spanContext.getTraceId();
            capturedSpanId = spanContext.getSpanId();
        } else {
            // Span이 유효하지 않을 경우(예: 헬스체크) MDC를 마지막으로 확인하는 Fallback (안전장치)
            String mdcTrace = MDC.get("trace_id") != null ? MDC.get("trace_id") : MDC.get("traceId");
            String mdcSpan = MDC.get("span_id") != null ? MDC.get("span_id") : MDC.get("spanId");
            capturedTraceId = (mdcTrace != null && !mdcTrace.trim().isEmpty() && !mdcTrace.equals("-")) ? mdcTrace : "";
            capturedSpanId = (mdcSpan != null && !mdcSpan.trim().isEmpty() && !mdcSpan.equals("-")) ? mdcSpan : "";
        }

        // 최종적으로 값을 빈 문자열로 정규화
        final String finalTraceId = capturedTraceId;
        final String finalSpanId = capturedSpanId;

        try {
            // 이후 비즈니스 로직(Security, Controller 등) 실행
            filterChain.doFilter(request, response);
        } finally {
            // 🌟 finally 블록이 실행될 때 MDC나 Span 컨텍스트가 청소되어 있더라도,
            // 진입 시점에 안전하게 캡처해둔 지역 변수(finalTraceId)를 사용하므로 절대 증발하지 않습니다!

            long durationMs = System.currentTimeMillis() - startTime;
            String method = request.getMethod() != null ? request.getMethod() : "UNKNOWN";
            String path = request.getRequestURI() != null ? request.getRequestURI() : "/";
            if (request.getQueryString() != null) {
                path += "?" + request.getQueryString();
            }
            String status = String.valueOf(response.getStatus());

            MDC.put("trace_id", finalTraceId);
            MDC.put("span_id", finalSpanId);
            MDC.put("http_method", method);
            MDC.put("http_path", path);
            MDC.put("http_status", status);
            MDC.put("http_duration_ms", String.valueOf(durationMs));

            try {
                httpLogger.info("HTTP Request Completed");
            } finally {
                MDC.remove("trace_id");
                MDC.remove("span_id");
                MDC.remove("http_method");
                MDC.remove("http_path");
                MDC.remove("http_status");
                MDC.remove("http_duration_ms");
            }
        }
    }
}