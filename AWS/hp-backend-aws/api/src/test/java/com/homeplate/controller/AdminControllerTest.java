package com.homeplate.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.homeplate.dto.admin.GameRequest;
import com.homeplate.service.AdminService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doNothing;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminController.class)
class AdminControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @MockBean
    private AdminService service;

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("경기 생성 POST 요청 시 경기 번호와 생성 완료 메시지를 반환한다.")
    void createTest() throws Exception {
        LocalDateTime start = LocalDateTime.of(2026, 1, 1, 1, 1);
        LocalDateTime open = LocalDateTime.of(2026, 1, 1, 1, 1);

        GameRequest request = GameRequest.builder()
                .stadiumId("HOMEPLATE")
                .homeTeamId("A")
                .awayTeamId("B")
                .gameStartAt(start)
                .ticketOpenAt(open)
                .maxSeats(100)
                .build();

        Long expectedGameId = 1L;

        given(service.create(any(GameRequest.class))).willReturn(expectedGameId);

        mvc.perform(post("/admin")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(content().string(expectedGameId + ": 경기 생성 완료"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("경기 수정 PUT 요청 시 경기 번호와 수정 완료 메시지를 반환한다.")
    void updateTest() throws Exception {
        Long gameId = 1L;
        GameRequest request = new GameRequest();

        doNothing().when(service).update(eq(gameId), any(GameRequest.class));

        mvc.perform(put("/admin/{gameId}", gameId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(content().string(gameId + ": 경기 수정 완료"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("경기 삭제 DELETE 요청 시 경기 번호와 삭제 완료 메시지를 반환한다.")
    void deleteTest() throws Exception {
        Long gameId = 1L;

        doNothing().when(service).delete(gameId);

        mvc.perform(delete("/admin/{gameId}", gameId)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(content().string(gameId + ": 경기 삭제 완료"));
    }
}