package com.homeplate.dto.book;

import com.homeplate.entity.book.ZoneStatus;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class ZoneResponse {
    private String zoneId;
    private ZoneStatus status;
    private int totalSeats;
    private int bookedSeats;
    private double occupancyRate;
    private List<SeatResponse> seats;

    public static ZoneResponse from(String zoneId, ZoneStatus status, int totalSeats, int bookedSeats, double occupancyRate, List<SeatResponse> seats) {
        return ZoneResponse.builder()
                .zoneId(zoneId)
                .status(status)
                .totalSeats(totalSeats)
                .bookedSeats(bookedSeats)
                .occupancyRate(Math.round(occupancyRate * 1000) / 10.0)
                .seats(seats)
                .build();
    }
}
