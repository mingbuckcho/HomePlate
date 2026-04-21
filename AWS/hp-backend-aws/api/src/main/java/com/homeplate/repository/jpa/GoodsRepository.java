package com.homeplate.repository.jpa;

import com.homeplate.entity.info.Goods;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GoodsRepository extends JpaRepository<Goods, Long> {
    List<Goods> findAllByOrderByGoodsIdDesc();

    List<Goods> findByTeam_TeamIdOrderByGoodsIdDesc(String teamId);
}
