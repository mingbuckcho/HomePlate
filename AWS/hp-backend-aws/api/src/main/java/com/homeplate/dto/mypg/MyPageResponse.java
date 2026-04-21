package com.homeplate.dto.mypg;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
@AllArgsConstructor
public class MyPageResponse {
    private List<OrderResponse> activeOrders;
    private List<OrderResponse> inactiveOrders;

    public static MyPageResponse from(List<OrderResponse> activeOrders, List<OrderResponse> inactiveOrders) {
        return MyPageResponse.builder()
                .activeOrders(activeOrders)
                .inactiveOrders(inactiveOrders)
                .build();
    }
}
