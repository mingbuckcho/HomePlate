package com.homeplate.repository.jpa;

import com.homeplate.entity.info.TeamRankings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TeamRankingRepository extends JpaRepository<TeamRankings, Long> {
    @Query("SELECT r FROM TeamRankings r JOIN FETCH r.team ORDER BY r.rankNo ASC")
    List<TeamRankings> findAllByOrderByRankNoAsc();
}
