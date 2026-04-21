package com.homeplate.entity.book;

import com.homeplate.entity.info.Teams;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
@Table(name = "games")
public class Games {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stadium_id", nullable = false)
    private Stadiums stadium;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "home_team", nullable = false)
    private Teams home;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "away_team", nullable = false)
    private Teams away;

    @Column(name = "game_start_at", nullable = false)
    private LocalDateTime gameStartAt;

    @Column(name = "ticket_open_at", nullable = false)
    private LocalDateTime ticketOpenAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "game_status", nullable = false)
    private GameStatus gameStatus;

    @Column(name = "max_seats", nullable = false)
    private int maxSeats;

    //setter
    public void update(Stadiums stadium, Teams home, Teams away, LocalDateTime gameStartAt, LocalDateTime ticketOpenAt, int maxSeats) {
        this.stadium = stadium;
        this.home = home;
        this.away = away;
        this.gameStartAt = gameStartAt;
        this.ticketOpenAt = ticketOpenAt;
        this.maxSeats = maxSeats;
    }
}
