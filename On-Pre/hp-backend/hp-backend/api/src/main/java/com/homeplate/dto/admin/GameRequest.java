package com.homeplate.dto.admin;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.homeplate.entity.book.GameStatus;
import com.homeplate.entity.book.Games;
import com.homeplate.entity.book.Stadiums;
import com.homeplate.entity.info.Teams;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GameRequest {
    private String stadiumId;
    private String homeTeamId;
    private String awayTeamId;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
    private LocalDateTime gameStartAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
    private LocalDateTime ticketOpenAt;

    private int maxSeats;

    public Games toEntity(Stadiums stadium, Teams home, Teams away) {
        return Games.builder()
                .stadium(stadium)
                .home(home)
                .away(away)
                .gameStartAt(this.gameStartAt)
                .ticketOpenAt(this.ticketOpenAt)
                .maxSeats(this.maxSeats)
                .gameStatus(GameStatus.SCHEDULED)
                .build();
    }
}
