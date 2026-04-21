package com.homeplate.service;

import com.homeplate.dto.admin.GameRequest;
import com.homeplate.dto.admin.GameResponse;
import com.homeplate.dto.outbox.OutboxResponse;
import com.homeplate.entity.book.Games;
import com.homeplate.entity.book.Stadiums;
import com.homeplate.entity.info.Teams;
import com.homeplate.entity.outbox.OutboxHistory;
import com.homeplate.exception.CustomException;
import com.homeplate.exception.ErrorCode;
import com.homeplate.repository.jpa.GameRepository;
import com.homeplate.repository.jpa.OutboxHistoryRepository;
import com.homeplate.repository.jpa.StadiumRepository;
import com.homeplate.repository.jpa.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminService {
    private final GameRepository gameRepo;
    private final TeamRepository teamRepos;
    private final StadiumRepository stadiumRepo;
    private final OutboxHistoryRepository historyRepo;

    /**
     *
     * Create 경기 생성
     */
    @Transactional
    public Long create(GameRequest request) {
        Stadiums stadium = stadiumRepo.findById(request.getStadiumId())
                .orElseThrow(() -> new CustomException(ErrorCode.RESOURCE_NOT_FOUND));
        Teams home = teamRepos.findById(request.getHomeTeamId())
                .orElseThrow(() -> new CustomException(ErrorCode.RESOURCE_NOT_FOUND));
        Teams away = teamRepos.findById(request.getAwayTeamId())
                .orElseThrow(() -> new CustomException(ErrorCode.RESOURCE_NOT_FOUND));
        Games game = request.toEntity(stadium, home, away);

        return gameRepo.save(game).getGameId();
    }

    /**
     * 전체 경기 목록 조회
     */
    public Page<GameResponse> getAllGames(Pageable pageable) {
        return gameRepo.findAll(pageable)
                .map(GameResponse::from);
    }

    /**
     *
     * Update 경기 수정
     */
    @Transactional
    public void update(Long gameId, GameRequest request) {
        Games game = gameRepo.findById(gameId)
                .orElseThrow(() -> new CustomException(ErrorCode.RESOURCE_NOT_FOUND));
        Stadiums stadium = stadiumRepo.findById(request.getStadiumId())
                .orElseThrow(() -> new CustomException(ErrorCode.RESOURCE_NOT_FOUND));
        Teams home = teamRepos.findById(request.getHomeTeamId())
                .orElseThrow(() -> new CustomException(ErrorCode.RESOURCE_NOT_FOUND));
        Teams away = teamRepos.findById(request.getAwayTeamId())
                .orElseThrow(() -> new CustomException(ErrorCode.RESOURCE_NOT_FOUND));

        game.update(stadium, home, away, request.getGameStartAt(), request.getTicketOpenAt(), request.getGameStatus(), request.getMaxSeats());
    }

    /**
     *
     * Delete 경기 삭제
     */
    @Transactional
    public void delete(Long gameId) {
        Games game = gameRepo.findById(gameId)
                .orElseThrow(() -> new CustomException(ErrorCode.GAME_NOT_FOUND));

        gameRepo.delete(game);
    }

    /**
     *
     * OUTBOX 발송이력 조회
     */
    public Page<OutboxResponse> outboxHistory(Pageable pageable) {
        Page<OutboxHistory> histories = historyRepo.findAll(pageable);
        return histories.map(OutboxResponse::from);
    }
}
