package com.homeplate.controller;

import com.homeplate.dto.chat.ChatRequest;
import com.homeplate.dto.chat.ChatResponse;
import com.homeplate.service.ChatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@Tag(name = "6. Chatbot", description = "Chatbot API")
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {
    private final ChatService service;

    @PostMapping("/ask")
    @Operation(summary = "챗봇 질문하기", description = "선택한 메뉴 번호에 따라 답변을 받습니다.")
    public ResponseEntity<ChatResponse> menu(@RequestBody ChatRequest request) {
        log.info("챗봇 요청 수신: menuId={}, gameId={}, zoneNumber={}",
                request.getMenuId(), request.getGameId(), request.getZoneNumber());
        ChatResponse response = service.menu(request);

        return ResponseEntity.ok(response);
    }
}
