package com.homeplate.controller;

import com.homeplate.dto.admin.GameRequest;
import com.homeplate.service.AdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "*. Admin", description = "관리자 기능")
public class AdminController {
    private final AdminService service;

    @PostMapping
    @Operation(summary = "경기 생성", description = "새로운 경기를 등록합니다.")
    public ResponseEntity<String> create(@RequestBody GameRequest request) {
        Long gameId = service.create(request);
        return ResponseEntity.ok(gameId + ": 경기 생성 완료");
    }

    @PutMapping("/{gameId}")
    @Operation(summary = "경기 수정", description = "기존 경기 정보를 수정합니다.")
    public ResponseEntity<String> update(
            @PathVariable Long gameId,
            @RequestBody GameRequest request) {
        service.update(gameId, request);
        return ResponseEntity.ok(gameId + ": 경기 수정 완료");
    }

    @DeleteMapping("/{gameId}")
    @Operation(summary = "경기 삭제", description = "경기를 삭제합니다.")
    public ResponseEntity<String> delete(@PathVariable Long gameId) {
        service.delete(gameId);
        return ResponseEntity.ok(gameId + ": 경기 삭제 완료");
    }
}
