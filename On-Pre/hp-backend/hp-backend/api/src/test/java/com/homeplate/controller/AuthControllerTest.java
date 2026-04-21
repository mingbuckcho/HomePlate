package com.homeplate.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.homeplate.dto.auth.SignUpRequest;
import com.homeplate.service.AuthService;
import com.homeplate.util.auth.CookieUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper mapper;

    @MockBean
    private AuthService service;

    @MockBean
    private CookieUtil util;

    @Test
    @WithMockUser
    @DisplayName("회원가입 요청 시 HTTP 201 Created 와 성공 메시지를 반환한다.")
    void signupTest() throws Exception {
        SignUpRequest request = new SignUpRequest("tester@test.com", "1234", "tester", "010-1234-5678");

        doNothing().when(service).signup(any(SignUpRequest.class));

        mvc.perform(post("/auth/signup")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(content().string("회원가입 성공"));
    }
}