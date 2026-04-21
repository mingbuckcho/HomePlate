package com.homeplate.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.homeplate.dto.mypg.MyPageResponse;
import com.homeplate.entity.auth.Role;
import com.homeplate.entity.auth.Users;
import com.homeplate.service.MypgService;
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

import java.util.List;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doNothing;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MypgController.class)
class MypgControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @MockBean
    private MypgService service;

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
    @DisplayName("예매 내역 조회 GET 요청 시 MyPageResponse 객체를 반환한다.")
    void getMyOrdersTest() throws Exception {
        MyPageResponse response = MyPageResponse.builder()
                .activeOrders(List.of())
                .inactiveOrders(List.of())
                .build();

        given(service.getMyOrders(anyLong())).willReturn(response);

        mvc.perform(get("/mypage/orders")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("예매 취소 DELETE 요청 시 정상적으로 취소 완료 메시지를 반환한다.")
    void cancelOrderTest() throws Exception {
        Long orderId = 1L;

        doNothing().when(service).cancelOrder(anyLong(), anyLong());

        mvc.perform(delete("/mypage/orders/{orderId}", orderId)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(content().string("예매가 정상적으로 취소되었습니다."));
    }
}