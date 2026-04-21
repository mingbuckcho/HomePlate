package com.homeplate.dto.info;

import com.homeplate.entity.info.TeamRankings;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class TeamRankingResponse {
    private Long rankingId;
    private int rankNo;
    private int played;
    private int win;
    private int loss;
    private int draw;
    private BigDecimal winRate;
    private BigDecimal gameBehind;
    private String teamName;
    private String teamLogo;

    public static TeamRankingResponse from(TeamRankings ranking) {
        return TeamRankingResponse.builder()
                .rankingId(ranking.getRankingId())
                .rankNo(ranking.getRankNo())
                .played(ranking.getPlayed())
                .win(ranking.getWin())
                .loss(ranking.getLoss())
                .draw(ranking.getDraw())
                .winRate(ranking.getWinRate())
                .gameBehind(ranking.getGameBehind())
                .teamName(ranking.getTeam().getTeamName())
                .teamLogo(ranking.getTeam().getTeamLogo())
                .build();
    }
}
