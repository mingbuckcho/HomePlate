package com.homeplate.dto.mypg;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.homeplate.entity.book.OrderStatus;
import com.homeplate.entity.book.Orders;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Builder
public class OrderResponse {
    private Long orderId;
    private String gameTitle;
    private String stadiumName;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd", timezone = "Asia/Seoul")
    private LocalDate gameDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "HH:mm", timezone = "Asia/Seoul")
    private LocalTime gameTime;

    private String zoneNumber;
    private String seatCode;
    private String qrCode;
    private String homeLogo;
    private OrderStatus orderStatus;

    public static OrderResponse from(Orders order) {
        String gameTitle = String.format("%s vs %s",
                order.getGame().getHome().getTeamName(),
                order.getGame().getAway().getTeamName());

        List<String> seatCodes = order.getSeatCodes();

        String zoneNumber = seatCodes.stream()
                .map(s -> s.split("-")[0])
                .distinct()
                .collect(Collectors.joining(", "));

        String seatCode = seatCodes.stream()
                .map(s -> s.split("-")[1])
                .collect(Collectors.joining(", "));

        return OrderResponse.builder()
                .orderId(order.getOrderId())
                .gameTitle(gameTitle)
                .stadiumName(order.getGame().getStadium().getStadiumName())
                .gameDate(order.getGame().getGameStartAt().toLocalDate())
                .gameTime(order.getGame().getGameStartAt().toLocalTime())
                .zoneNumber(zoneNumber)
                .seatCode(seatCode)
                .qrCode(String.valueOf(order.getOrderId()))
                .homeLogo(order.getGame().getHome().getTeamLogo())
                .orderStatus(order.getOrderStatus())
                .build();
    }
}