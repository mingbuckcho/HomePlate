package com.homeplate.controller;

import com.homeplate.dto.info.GameResponse;
import com.homeplate.dto.info.GoodsResponse;
import com.homeplate.dto.info.NewsResponse;
import com.homeplate.dto.info.TeamRankingResponse;
import com.homeplate.service.InfoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/info")
@RequiredArgsConstructor
@Tag(name = "5. Info", description = "경기 일정, 뉴스, 순위, 굿즈 정보")
public class InfoController {
    private final InfoService service;

    @GetMapping("/games/top5")
    @Operation(summary = "다가오는 경기 일정", description = "현재 시간 이후의 경기 5개를 조회합니다.")
    public ResponseEntity<List<GameResponse>> getUpcomingGames() {
        return ResponseEntity.ok(service.getUpcomingGames());
    }

    @GetMapping("/games/byTeam")
    @Operation(summary = "구단별 경기 일정", description = "특정 구단의 경기 일정을 조회합니다. 날짜를 입력하면 해당 날짜의 경기만 반환합니다. (default: 모든 경기 일정)")
    public ResponseEntity<List<GameResponse>> getGamesByTeam(
            @RequestParam String teamId,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate date) {
        return ResponseEntity.ok(service.getGamesByTeam(teamId, date));
    }

    @GetMapping("/news")
    @Operation(summary = "야구 뉴스 조회", description = "최신 야구 뉴스 목록을 조회합니다.")
    public ResponseEntity<List<NewsResponse>> getNewsList() {
        return ResponseEntity.ok(service.getNewsList());
    }

    @GetMapping("/rankings")
    @Operation(summary = "구단 순위 조회", description = "현재 시즌 KBO 구단 순위를 조회합니다.")
    public ResponseEntity<List<TeamRankingResponse>> getRankings() {
        return ResponseEntity.ok(service.getRankings());
    }

    @GetMapping("/goods")
    @Operation(summary = "굿즈 목록 조회", description = "최신순 또는 구단별로 굿즈를 조회합니다.")
    public ResponseEntity<List<GoodsResponse>> getGoodsList(
            @RequestParam(required = false) String teamId) {
        return ResponseEntity.ok(service.getGoodsList(teamId));
    }
}
