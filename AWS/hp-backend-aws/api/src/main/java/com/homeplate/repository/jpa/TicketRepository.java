package com.homeplate.repository.jpa;

import com.homeplate.entity.book.Tickets;
import com.homeplate.entity.book.TicketStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TicketRepository extends JpaRepository<Tickets, String> {
    @Query("SELECT t FROM Tickets t WHERE t.game.gameId = :gameId AND t.seat.zone.zoneId = :zoneId AND t.ticketStatus = 'ACTIVE'")
    List<Tickets> findBookedTickets(@Param("gameId") Long gameId,
                                    @Param("zoneId") String zoneId);

    List<Tickets> findAllByOrder_OrderId(Long orderId);

    boolean existsByGame_GameIdAndSeat_SeatCodeAndTicketStatus(Long gameId, String seatCode, TicketStatus ticketStatus);

    int countByGame_GameIdAndUser_UserIdAndTicketStatus(Long gameId, Long userId, TicketStatus status);
}
