package com.homeplate.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.homeplate.service.InfoService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(InfoController.class)
class InfoControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @MockBean
    private InfoService service;

    @Test
    @WithMockUser
    @DisplayName("다가오는 경기 일정 GET 요청 시 상태코드 200을 반환한다.")
    void getUpcomingGamesTest() throws Exception {
        given(service.getUpcomingGames()).willReturn(List.of());

        mvc.perform(get("/info/games/top5")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    @DisplayName("구단별 경기 일정 GET 요청 시 파라미터를 받아 상태코드 200을 반환한다.")
    void getGamesByTeamTest() throws Exception {
        String teamId = "KIA";
        String date = "2026-04-01";

        given(service.getGamesByTeam(anyString(), any(LocalDate.class))).willReturn(List.of());

        mvc.perform(get("/info/games/byTeam")
                        .param("teamId", teamId)
                        .param("date", date)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    @DisplayName("야구 뉴스 조회 GET 요청 시 상태코드 200을 반환한다.")
    void getNewsListTest() throws Exception {
        given(service.getNewsList()).willReturn(List.of());

        mvc.perform(get("/info/news")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    @DisplayName("구단 순위 조회 GET 요청 시 상태코드 200을 반환한다.")
    void getRankingsTest() throws Exception {
        given(service.getRankings()).willReturn(List.of());

        mvc.perform(get("/info/rankings")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    @DisplayName("굿즈 목록 조회 GET 요청 시 파라미터를 받아 상태코드 200을 반환한다.")
    void getGoodsListTest() throws Exception {
        String teamId = "LG";

        given(service.getGoodsList(anyString())).willReturn(List.of());

        mvc.perform(get("/info/goods")
                        .param("teamId", teamId)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }
}