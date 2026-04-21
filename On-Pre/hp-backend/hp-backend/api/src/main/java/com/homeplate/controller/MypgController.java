package com.homeplate.controller;

import com.homeplate.dto.mypg.MyPageResponse;
import com.homeplate.util.auth.UserDetailsImpl;
import com.homeplate.service.MypgService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mypage")
@RequiredArgsConstructor
@Tag(name = "4. MyPage", description = "예매 내역 조회 및 취소")
public class MypgController {
    private final MypgService service;

    @GetMapping("/orders")
    @Operation(summary = "예매 내역 조회", description = "활성/비활성 예매 내역을 구분하여 조회합니다. (최신순)")
    public ResponseEntity<MyPageResponse> getMyOrders(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        MyPageResponse responses = service.getMyOrders(userDetails.getUser().getUserId());
        return ResponseEntity.ok(responses);
    }

    @DeleteMapping("/orders/{orderId}")
    @Operation(summary = "예매 전체 취소", description = "주문번호를 통해 전체 예매를 취소합니다. 경기 시작 전까지만 가능합니다.")
    public ResponseEntity<String> cancelOrder(
            @PathVariable Long orderId,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        service.cancelOrder(orderId, userDetails.getUser().getUserId());
        return ResponseEntity.ok("예매가 정상적으로 취소되었습니다.");
    }
}
