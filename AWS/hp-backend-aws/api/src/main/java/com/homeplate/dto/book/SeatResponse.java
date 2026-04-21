package com.homeplate.dto.book;

import com.homeplate.entity.book.Seats;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SeatResponse {
    private Long seatId;
    private String seatCode;
    private String seatRow;
    private int seatCol;
    private boolean isBooked;

    public static SeatResponse from(Seats seat, boolean isLocked, boolean isSold) {
        return SeatResponse.builder()
                .seatId(seat.getSeatId())
                .seatCode(seat.getSeatCode())
                .seatRow(seat.getSeatRow())
                .seatCol(seat.getSeatCol())
                .isBooked(isSold || isLocked)
                .build();
    }
}
