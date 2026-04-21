package com.homeplate.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.homeplate.dto.queue.QueueResponse;
import com.homeplate.entity.auth.Role;
import com.homeplate.entity.auth.Users;
import com.homeplate.service.QueueService;
import com.homeplate.util.auth.UserDetailsImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(QueueController.class)
class QueueControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @MockBean
    private QueueService service;

    private UserDetailsImpl userDetails;

    @BeforeEach
    void set() {
        Users user = new Users(1L, "tester@test.com", "1234", "tester", "010-1234-5678", Role.ROLE_USER);
        userDetails = new UserDetailsImpl(user);

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities())
        );
    }

    @Test
    @DisplayName("대기열 진입 POST 요청 시 현재 순번을 반환한다.")
    void enterQueueTest() throws Exception {
        Long gameId = 1L;

        QueueResponse response = QueueResponse.builder()
                .status("WAITING")
                .rank(100L)
                .build();

        given(service.enterQueue(anyLong(), anyLong())).willReturn(response);

        mvc.perform(post("/queue/{gameId}", gameId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("실시간 순번 확인 GET 요청 시 남은 순번을 반환한다.")
    void getQueueStatusTest() throws Exception {
        Long gameId = 1L;

        QueueResponse response = QueueResponse.builder()
                .status("WAITING")
                .rank(99L)
                .build();

        given(service.getQueueStatus(anyLong(), anyLong())).willReturn(response);

        mvc.perform(get("/queue/{gameId}/rank", gameId)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }
}