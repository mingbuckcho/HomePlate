package com.homeplate.repository.jpa;

import com.homeplate.entity.book.Seats;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SeatRepository extends JpaRepository<Seats, Long> {
    List<Seats> findByZone_ZoneIdOrderBySeatRowAscSeatColAsc(String zoneId);

    @Query("SELECT s FROM Seats s " +
            "WHERE s.zone.stadium.stadiumId = :stadiumId " +
            "AND s.seatCode IN :seatCodes")
    List<Seats> findAllByStadiumAndSeatCodes(@Param("stadiumId") String stadiumId,
                                             @Param("seatCodes") List<String> seatCodes);

    @Query("SELECT s FROM Seats s " +
            "WHERE s.zone.stadium.stadiumId = :stadiumId " +
            "AND s.seatCode = :seatCode")
    Optional<Seats> findByStadiumAndSeatCode(@Param("stadiumId") String stadiumId,
                                             @Param("seatCode") String seatCode);
}
