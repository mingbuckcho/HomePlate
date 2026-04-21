package com.homeplate.repository.jpa;

import com.homeplate.entity.book.Games;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface GameRepository extends JpaRepository<Games, Long> {
    List<Games> findAllByGameStartAtAfterOrderByGameStartAtAsc(LocalDateTime now);

    List<Games> findTop5ByGameStartAtAfterOrderByGameStartAtAsc(LocalDateTime now);

    List<Games> findAllByGameStartAtBetweenOrderByGameStartAtAsc(LocalDateTime start, LocalDateTime end);

    @Query("SELECT g FROM Games g " +
            "WHERE g.home.teamId = :teamId OR g.away.teamId = :teamId " +
            "ORDER BY g.gameStartAt ASC")
    List<Games> findAllByTeamId(@Param("teamId") String teamId);

    @Query("SELECT g FROM Games g " +
            "WHERE (g.home.teamId = :teamId OR g.away.teamId = :teamId) " +
            "AND g.gameStartAt BETWEEN :startOfDay AND :endOfDay " +
            "ORDER BY g.gameStartAt ASC")
    List<Games> findAllByTeamIdAndDate(@Param("teamId") String teamId,
                                       @Param("startOfDay") LocalDateTime startOfDay,
                                       @Param("endOfDay") LocalDateTime endOfDay);
}
