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
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "goods")
public class Goods extends AtEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "goods_id", nullable = false)
    private Long goodsId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Teams team;

    @Column(name = "goods_name", nullable = false, length = 100)
    private String goodsName;

    @Column(name = "goods_price", nullable = false)
    private BigDecimal goodsPrice;

    @Column(name = "goods_thumbnail")
    private String goodsThumbnail;

    @Column(name = "goods_url", nullable = false)
    private String goodsUrl;

    //
    public static Goods of(Teams team, String goodsName, BigDecimal goodsPrice, String goodsThumbnail, String goodsUrl) {
        return Goods.builder()
                .team(team)
                .goodsName(goodsName)
                .goodsPrice(goodsPrice)
                .goodsThumbnail(goodsThumbnail)
                .goodsUrl(goodsUrl)
                .build();
    }
}
