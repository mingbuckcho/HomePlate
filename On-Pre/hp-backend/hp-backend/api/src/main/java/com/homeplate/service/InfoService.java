package com.homeplate.service;

import com.homeplate.dto.info.GameResponse;
import com.homeplate.dto.info.GoodsResponse;
import com.homeplate.dto.info.NewsResponse;
import com.homeplate.dto.info.TeamRankingResponse;
import com.homeplate.entity.book.Games;
import com.homeplate.repository.jpa.GameRepository;
import com.homeplate.repository.jpa.GoodsRepository;
import com.homeplate.repository.jpa.NewsRepository;
import com.homeplate.repository.jpa.TeamRankingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InfoService {
    private final GameRepository gameRepo;
    private final NewsRepository newsRepo;
    private final TeamRankingRepository rankingRepo;
    private final GoodsRepository goodsRepo;

    /**
     *
     * 다가오는 경기 5개
     */
    public List<GameResponse> getUpcomingGames() {
        return gameRepo.findTop5ByGameStartAtAfterOrderByGameStartAtAsc(LocalDateTime.now())
                .stream()
                .map(GameResponse::from)
                .collect(Collectors.toList());
    }

    /**
     *
     * 구단별 경기 일정 조회 (teamId 필수, date 선택)
     */
    public List<GameResponse> getGamesByTeam(String teamId, LocalDate date) {
        List<Games> games;

        if (date == null) {
            games = gameRepo.findAllByTeamId(teamId);
        } else {
            LocalDateTime startOfDay = date.atStartOfDay();
            LocalDateTime endOfDay = date.atTime(LocalTime.MAX);

            games = gameRepo.findAllByTeamIdAndDate(teamId, startOfDay, endOfDay);
        }

        return games.stream()
                .map(GameResponse::from)
                .collect(Collectors.toList());
    }

    /**
     *
     * 야구 뉴스 목록 (제목 10자 제한)
     */
    public List<NewsResponse> getNewsList() {
        return newsRepo.findAllByOrderByPublishedAtDesc()
                .stream()
                .map(NewsResponse::from)
                .collect(Collectors.toList());
    }

    /**
     *
     * 구단 순위 (최신순 또는 구단별 정렬)
     */
    public List<TeamRankingResponse> getRankings() {
        return rankingRepo.findAllByOrderByRankNoAsc()
                .stream()
                .map(TeamRankingResponse::from)
                .collect(Collectors.toList());
    }

    public List<GoodsResponse> getGoodsList(String teamId) {
        if (teamId == null || teamId.isBlank()) {
            return goodsRepo.findAllByOrderByGoodsIdDesc()
                    .stream()
                    .map(GoodsResponse::from)
                    .collect(Collectors.toList());
        } else {
            return goodsRepo.findByTeam_TeamIdOrderByGoodsIdDesc(teamId)
                    .stream()
                    .map(GoodsResponse::from)
                    .collect(Collectors.toList());
        }
    }
}
