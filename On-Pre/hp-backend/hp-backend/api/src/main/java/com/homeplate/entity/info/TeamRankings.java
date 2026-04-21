package com.homeplate.entity.info;


import com.homeplate.entity.AtEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Getter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Table(name = "team_rankings")
public class TeamRankings extends AtEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ranking_id", nullable = false)
    private Long rankingId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Teams team;

    @Column(name = "rank_no", nullable = false)
    private int rankNo;

    @Column(nullable = false)
    private int played;

    @Column(nullable = false)
    private int win;

    @Column(nullable = false)
    private int loss;

    @Column(nullable = false)
    private int draw;

    @Column(name = "win_rate", nullable = false)
    private BigDecimal winRate;

    @Column(name = "game_behind", nullable = false)
    private BigDecimal gameBehind;

    //
    public static TeamRankings of(Teams team, int rankNo, int played, int win, int loss, int draw, BigDecimal winRate, BigDecimal gameBehind) {
        return TeamRankings.builder()
                .team(team)
                .rankNo(rankNo)
                .played(played)
                .win(win)
                .loss(loss)
                .draw(draw)
                .winRate(winRate)
                .gameBehind(gameBehind)
                .build();
    }
}
