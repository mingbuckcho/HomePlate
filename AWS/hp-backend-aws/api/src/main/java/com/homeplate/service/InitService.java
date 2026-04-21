package com.homeplate.service;

import com.homeplate.entity.book.Seats;
import com.homeplate.entity.book.Stadiums;
import com.homeplate.entity.book.ZoneGrade;
import com.homeplate.entity.book.Zones;
import com.homeplate.repository.jpa.SeatRepository;
import com.homeplate.repository.jpa.ZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InitService {
    private final ZoneRepository zoneRepo;
    private final SeatRepository seatRepo;

    private static final int SEATS_PER_ZONE = 200;

    @Transactional
    public void initStadium(Stadiums stadiums) {
        for (ZoneGrade grade : ZoneGrade.values()) {
            createZone(stadiums, grade);
        }
    }

    private void createZone(Stadiums stadium, ZoneGrade grade) {
        int startId = grade.getStartId();
        int count = grade.getZoneCount();

        for (int i = 0; i < count; i++) {
            String zoneNumber = String.valueOf(startId + i);
            String gameZoneId = stadium.getStadiumId() + "-" + zoneNumber;
            String zoneName = grade.name() + "-" + zoneNumber;

            if (zoneRepo.existsById(gameZoneId)) continue;

            Zones zone=Zones.builder()
                    .zoneId(gameZoneId)
                    .stadium(stadium)
                    .zoneName(zoneName)
                    .zoneGrade(grade)
                    .zoneNumber(zoneNumber)
                    .build();

            zoneRepo.save(zone);

            createSeats(zone, zoneNumber);
        }
    }

    private void createSeats(Zones zone, String zoneNumber) {
        List<Seats> seats = new ArrayList<>();
        int[] colPerRow = {
                2, 4, 6, 8,
                10, 10, 10, 10, 10, 10, 10, 10,
                10, 10, 10, 10, 10, 10, 10, 10,
                8, 6, 4, 2
        };

        int createdCount = 0;
        for (int r = 0; r < colPerRow.length; r++) {
            String row = String.valueOf((char) ('A' + r));
            int col = colPerRow[r];

            for (int c = 1; c <= col; c++) {
                if (createdCount >= SEATS_PER_ZONE) break;

                String seatCode = String.format("%s-%s%d", zoneNumber, row, c);

                seats.add(Seats.builder()
                        .zone(zone)
                        .seatRow(row)
                        .seatCol(col)
                        .seatCode(seatCode)
                        .build());
                createdCount++;
            }
        }
        seatRepo.saveAll(seats);
    }
}
