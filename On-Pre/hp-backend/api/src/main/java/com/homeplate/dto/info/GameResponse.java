package com.homeplate.dto.info;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.homeplate.entity.book.Games;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Builder
public class GameResponse {
    private Long gameId;
    private String gameTitle;
    private String stadiumName;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate gameDate;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime gameTime;

    private String homeName;
    private String awayName;

    public static GameResponse from(Games game) {
        String gameTitle = String.format("%s vs %s",
                game.getHome().getTeamName(),
                game.getAway().getTeamName());

        return GameResponse.builder()
                .gameId(game.getGameId())
                .gameTitle(gameTitle)
                .stadiumName(game.getStadium().getStadiumName())
                .gameDate(game.getGameStartAt().toLocalDate())
                .gameTime(game.getGameStartAt().toLocalTime())
                .homeName(game.getHome().getTeamName())
                .awayName(game.getAway().getTeamName())
                .build();
    }


}
