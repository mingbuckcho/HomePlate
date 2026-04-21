package com.homeplate.entity.book;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ZoneStatus {
    AVAILABLE("여유"),
    NEAR_SOLD_OUT("매진임박"),
    SOLD_OUT("매진");

    private final String description;

    public static ZoneStatus calcZoneStatus(int bookedSeats, int totalSeats, double standardRate) {
        if (totalSeats == 0 || bookedSeats == totalSeats) {
            return SOLD_OUT;
        }

        double occupancyRate = (double) bookedSeats / totalSeats;
        if (occupancyRate >= standardRate) {
            return NEAR_SOLD_OUT;
        }

        return AVAILABLE;
    }
}
