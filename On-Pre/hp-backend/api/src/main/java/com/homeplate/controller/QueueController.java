package com.homeplate.controller;

import com.homeplate.dto.queue.QueueResponse;
import com.homeplate.util.auth.UserDetailsImpl;
import com.homeplate.service.QueueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/queue")
@RequiredArgsConstructor
@Profile("queue")
@Tag(name = "2. Queue", description = "대기열 시스템")
public class QueueController {
    private final QueueService service;

    @PostMapping("/{gameId}")
    @Operation(summary = "대기열 진입", description = "대기열에 진입합니다. 현재 순번을 반환합니다.")
    public ResponseEntity<QueueResponse> enterQueue(
            @PathVariable Long gameId,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        return ResponseEntity.ok(service.enterQueue(gameId, userDetails.getUser().getUserId()));
    }

    @GetMapping("/{gameId}/rank")
    @Operation(summary = "실시간 순번 확인", description = "주기적으로 호출하여 남은 순번을 확인합니다.")
    public ResponseEntity<QueueResponse> getQueueStatus(
            @PathVariable Long gameId,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        return ResponseEntity.ok(service.getQueueStatus(gameId, userDetails.getUser().getUserId()));
    }
}
