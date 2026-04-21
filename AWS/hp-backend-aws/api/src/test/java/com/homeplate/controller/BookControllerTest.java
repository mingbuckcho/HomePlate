package com.homeplate.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.homeplate.dto.book.ZoneResponse;
import com.homeplate.entity.auth.Role;
import com.homeplate.entity.auth.Users;
import com.homeplate.service.BookService;
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

import java.util.Arrays;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(BookController.class)
public class BookControllerTest {
    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper mapper;
    @MockBean
    private BookService service;

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
    @DisplayName("구역별 좌석 조회 GET 요청 시 해당 구역의 상태를 반환한다.")
    void getSeatTest() throws Exception {
        Long gameId = 1L;
        String zoneNumber = "101";
        ZoneResponse response = ZoneResponse.builder()
                .zoneId(zoneNumber)
                .totalSeats(100)
                .bookedSeats(0)
                .build();

        given(service.getZoneStatus(anyLong(), anyString())).willReturn(response);

        mvc.perform(get("/book/{gameId}/zones/{zoneNumber}", gameId, zoneNumber)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("좌석 선점 POST 요청 시 정상적으로 성공 메시지를 반환한다.")
    void lockSeatTest() throws Exception {
        Long gameId = 1L;
        List<String> seatCodes = Arrays.asList("101-A1", "101-A2");

        mvc.perform(post("/book/{gameId}/seats/lock", gameId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(seatCodes)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value("좌석이 선점되었습니다. 5분 내에 결제해주세요."));
    }
}
