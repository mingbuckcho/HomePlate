package com.homeplate.dto.admin;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.homeplate.entity.book.GameStatus;
import com.homeplate.entity.book.Games;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class GameResponse {
    private Long gameId;
    private String stadiumName;
    private String homeTeamName;
    private String awayTeamName;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
    private LocalDateTime gameStartAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
    private LocalDateTime ticketOpenAt;

    private GameStatus gameStatus;
    private int maxSeats;

    public static GameResponse from(Games game) {
        return GameResponse.builder()
                .gameId(game.getGameId())
                .stadiumName(game.getStadium().getStadiumName())
                .homeTeamName(game.getHome().getTeamName())
                .awayTeamName(game.getAway().getTeamName())
                .gameStartAt(game.getGameStartAt())
                .ticketOpenAt(game.getTicketOpenAt())
                .gameStatus(game.getGameStatus())
                .maxSeats(game.getMaxSeats())
                .build();
    }
}