package com.homeplate.dto.info;

import com.homeplate.entity.info.Goods;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class GoodsResponse {
    private Long goodsId;
    private String goodsName;
    private String teamName;
    private BigDecimal goodsPrice;
    private String goodsThumbnail;
    private String goodsUrl;

    public static GoodsResponse from(Goods goods) {
        return GoodsResponse.builder()
                .goodsId(goods.getGoodsId())
                .goodsName(goods.getGoodsName())
                .teamName(goods.getTeam().getTeamName())
                .goodsPrice(goods.getGoodsPrice())
                .goodsThumbnail(goods.getGoodsThumbnail())
                .goodsUrl(goods.getGoodsUrl())
                .build();
    }
}
