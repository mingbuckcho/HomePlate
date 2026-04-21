package com.homeplate.entity.book;

import com.homeplate.entity.auth.Users;
import com.homeplate.entity.AtEntity;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "tickets",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"game_id", "seat_id"})
        })
@EntityListeners(AuditingEntityListener.class)
public class Tickets extends AtEntity {
    @Id
    @Column(name = "ticket_id", nullable = false, length = 50)
    private String ticketId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Orders order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "game_id", nullable = false)
    private Games game;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seat_id", nullable = false)
    private Seats seat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private Users user;

    @Column(name = "ticket_price", nullable = false)
    private BigDecimal ticketPrice;

    @Enumerated(EnumType.STRING)
    @Column(name = "ticket_status", nullable = false)
    private TicketStatus ticketStatus;

    @Column(name = "qr_code")
    private String qrCode;

    public static Tickets create(Orders order, Seats seats, BigDecimal ticketPrice) {
        return Tickets.builder()
                .ticketId(UUID.randomUUID().toString())
                .order(order)
                .game(order.getGame())
                .seat(seats)
                .user(order.getUser())
                .ticketPrice(ticketPrice)
                .ticketStatus(TicketStatus.ACTIVE)
                .build();
    }
}
