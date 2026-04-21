package com.homeplate.entity.book;

import com.homeplate.entity.auth.Users;
import com.homeplate.entity.AtEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Entity
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "orders")
public class Orders extends AtEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private Users user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "game_id", nullable = false)
    private Games game;

    @Column(name = "seat_list", nullable = false)
    private String seatList;

    @Column(name = "total_price", nullable = false)
    private BigDecimal totalPrice;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_status", nullable = false)
    @Builder.Default
    private OrderStatus orderStatus = OrderStatus.PENDING;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    //builder
    public static Orders of(Users user, Games game, List<String> seatList, BigDecimal totalPrice) {
        return Orders.builder()
                .user(user)
                .game(game)
                .seatList(String.join(",", seatList))
                .totalPrice(totalPrice)
                .orderStatus(OrderStatus.PENDING)
                .build();
    }

    //setter
    public void paid() {
        this.orderStatus = OrderStatus.PAID;
        this.paidAt = LocalDateTime.now();
    }

    public void cancel() {
        this.orderStatus = OrderStatus.CANCELLED;
    }

    public void expire() {
        this.orderStatus = OrderStatus.EXPIRED;
    }

    //getter
    public boolean isActive() {
        return this.orderStatus == OrderStatus.PAID
                && this.game.getGameStartAt().isAfter(LocalDateTime.now());
    }

    public boolean isPaid() {
        return this.orderStatus == OrderStatus.PAID;
    }

    public List<String> getSeatCodes() {
        if (this.seatList == null || this.seatList.isEmpty()) {
            return new ArrayList<>();
        }
        return Arrays.asList(this.seatList.split(","));
    }
}
