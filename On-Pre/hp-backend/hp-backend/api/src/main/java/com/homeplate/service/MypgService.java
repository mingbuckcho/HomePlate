package com.homeplate.service;

import com.homeplate.dto.mypg.MyPageResponse;
import com.homeplate.dto.mypg.OrderResponse;
import com.homeplate.entity.book.Orders;
import com.homeplate.entity.book.TicketStatus;
import com.homeplate.entity.book.Tickets;
import com.homeplate.exception.CustomException;
import com.homeplate.exception.ErrorCode;
import com.homeplate.repository.jpa.OrderRepository;
import com.homeplate.repository.jpa.TicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MypgService {
    private final OrderRepository orderRepo;
    private final TicketRepository ticketRepo;

    /**
     *
     * 예매 상태 조회 (active/inactive)
     */
    @Transactional
    public MyPageResponse getMyOrders(Long userId) {
        List<Orders> orders = orderRepo.findAllByUserIdWithDetails(userId);

        List<OrderResponse> activeOrders = new ArrayList<>();
        List<OrderResponse> inactiveOrders = new ArrayList<>();

        for (Orders order : orders) {
            if (!order.isActive() && order.isPaid()) {
                order.expire();
            }

            if (order.isActive()) {
                activeOrders.add(OrderResponse.from(order));
            } else {
                inactiveOrders.add(OrderResponse.from(order));
            }
        }

        return MyPageResponse.from(activeOrders, inactiveOrders);
    }

    /**
     *
     * 예매 취소 (주문 전체 취소)
     */
    @Transactional
    public void cancelOrder(Long orderId, Long userId) {
        Orders order = orderRepo.findById(orderId)
                .orElseThrow(() -> new CustomException(ErrorCode.ORDER_NOT_FOUND));

        if (!order.getUser().getUserId().equals(userId)) {
            throw new CustomException(ErrorCode.USER_NOT_MATCH);
        }
        if (!order.isActive()) {
            throw new CustomException(ErrorCode.INVALID_ORDER_STATUS);
        }

        order.cancel();
        List<Tickets> tickets = ticketRepo.findAllByOrder_OrderId(orderId);
        for (Tickets ticket : tickets) {
            ticket.setTicketStatus(TicketStatus.CANCELLED);
        }
    }
}
