package com.homeplate.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.homeplate.dto.outbox.OutboxRequest;
import com.homeplate.entity.outbox.EventType;
import com.homeplate.entity.outbox.OutboxEvents;
import com.homeplate.repository.jpa.OutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class OutboxService {
    private final OutboxRepository outboxRepo;
    private final ObjectMapper mapper;

    /**
     *
     * 결제 완료 이벤트 생성
     */
    @Transactional
    public String paid(OutboxRequest request) {
        String title = "[HomePlate] 예매가 확정되었습니다.";
        String body = String.format("고객님, 주문하신 내역(주문번호: %s)의 결제가 완료되어 예매가 확정되었습니다.", request.getOrderId());

        return saveEvent(request, title, body, EventType.SEND_ORDER_PAID);
    }

    /**
     *
     * 결제 취소 이벤트 생성
     */
    @Transactional
    public String cancelled(OutboxRequest request) {
        String title = "[HomePlate] 예매가 취소되었습니다.";
        String body = String.format("고객님, 요청하신 주문(주문번호: %s)이 정상적으로 취소 처리되었습니다.", request.getOrderId());

        return saveEvent(request, title, body, EventType.SEND_ORDER_CANCELLED);
    }

    private String saveEvent(OutboxRequest request, String title, String body, EventType eventType) {
        try {
            String payload = mapper.writeValueAsString(Map.of(
                    "email", request.getEmail(),
                    "title", title,
                    "body", body
            ));

            OutboxEvents event = OutboxEvents.create(
                    request.getOrderId(),
                    request.getUserId(),
                    eventType,
                    payload
            );

            return outboxRepo.save(event).getEventId();
        } catch (JsonProcessingException e) {

            log.error("Outbox payload serialization failed for order: {}", request.getOrderId());
            throw new RuntimeException("알림 이벤트 생성 실패", e);
        }
    }
}
