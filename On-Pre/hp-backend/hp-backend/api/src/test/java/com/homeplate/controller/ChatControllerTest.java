package com.homeplate.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.homeplate.dto.chat.ChatRequest;
import com.homeplate.dto.chat.ChatResponse;
import com.homeplate.service.ChatService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ChatController.class)
class ChatControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @MockBean
    private ChatService service;

    @Test
    @WithMockUser
    @DisplayName("챗봇 질문 POST 요청 시 메뉴 번호에 맞는 답변 객체를 반환한다.")
    void askChatbotTest() throws Exception {
        ChatRequest request = new ChatRequest();

        ChatResponse expectedResponse = new ChatResponse("안녕하세요! 무엇을 도와드릴까요?");

        given(service.menu(any(ChatRequest.class))).willReturn(expectedResponse);

        mvc.perform(post("/chat/ask")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").exists());
    }
}