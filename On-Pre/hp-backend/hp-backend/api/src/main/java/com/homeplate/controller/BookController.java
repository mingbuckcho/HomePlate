package com.homeplate.controller;

import com.homeplate.dto.book.OrderRequest;
import com.homeplate.dto.book.PaymentRequest;
import com.homeplate.dto.book.ZoneResponse;
import com.homeplate.util.auth.UserDetailsImpl;
import com.homeplate.service.BookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/book")
@RequiredArgsConstructor
@Tag(name = "3. Book", description = "좌석 조회 및 예매")
public class BookController {
    private final BookService service;

    @GetMapping("/{gameId}/zones/{zoneNumber}")
    @Operation(summary = "구역별 좌석 조회", description = "구역의 혼잡도(여유/매진임박/매진)와 좌석 리스트(예매 여/부)를 반환합니다.")
    public ResponseEntity<ZoneResponse> getSeats(
            @PathVariable Long gameId,
            @PathVariable String zoneNumber) {

        ZoneResponse response = service.getZoneStatus(gameId, zoneNumber);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{gameId}/seats/lock")
    @Operation(summary = "좌석 선점", description = "여러 좌석을 선택하여 5분간 선점합니다.")
    public ResponseEntity<String> lockSeat(
            @PathVariable Long gameId,
            @RequestBody List<String> seatCodes,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        service.reserveSeat(gameId, seatCodes, userDetails.getUser().getUserId());
        return ResponseEntity.ok("좌석이 선점되었습니다. 5분 내에 결제해주세요.");
    }

    @PostMapping("/orders")
    @Operation(summary = "주문 생성", description = "선점한 좌석들에 대해 결제 대기 주문을 생성합니다.")
    public ResponseEntity<Long> createOrder(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestBody OrderRequest request) {

        Long orderId = service.createOrder(userDetails.getUser().getUserId(), request);
        return ResponseEntity.ok(orderId);
    }

    @PostMapping("/payment")
    @Operation(summary = "가상 결제", description = "주문에 대해 가상 결제를 진행하고 티켓을 발급합니다.")
    public ResponseEntity<String> mockPayment(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestBody PaymentRequest request) {

        service.mockPayment(userDetails.getUser().getUserId(), request);
        return ResponseEntity.ok("결제가 완료되었습니다. 티켓이 발권되었습니다.");
    }
}
