package com.homeplate.entity.book;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDateTime;

@Getter
@RequiredArgsConstructor
public enum ZoneGrade {
    PREMIUM(101, 1, new BigDecimal("90000"), new BigDecimal("90000")), //1구역 * 200좌석
    BLUE(201, 12, new BigDecimal("22000"), new BigDecimal("24000")),    //12구역 * 200좌석
    ORANGE(301, 8, new BigDecimal("20000"), new BigDecimal("22000")),  //8구역 * 200좌석
    RED(401, 20, new BigDecimal("17000"), new BigDecimal("19000")),     //20구역 * 200좌석
    NAVY(501, 34, new BigDecimal("14000"), new BigDecimal("16000")),    //34구역 * 200좌석
    GREEN(601, 21, new BigDecimal("9000"), new BigDecimal("10000"))    //21구역 * 200좌석
    ;

    private final int startId;
    private final int zoneCount;
    private final BigDecimal weekdayPrice;
    private final BigDecimal weekendPrice;

    public BigDecimal getPriceByDate(LocalDateTime match) {
        DayOfWeek day = match.getDayOfWeek();

        if (day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY) {
            return this.weekendPrice;
        }

        return this.weekdayPrice;
    }
}
