package com.homeplate.repository.jpa;

import com.homeplate.entity.auth.Users;
import com.homeplate.entity.book.OrderStatus;
import com.homeplate.entity.book.Orders;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface OrderRepository extends JpaRepository<Orders, Long> {
    @Query("SELECT o FROM Orders o " +
            "JOIN FETCH o.game g " +
            "JOIN FETCH g.stadium " +
            "JOIN FETCH g.home " +
            "JOIN FETCH g.away " +
            "WHERE o.user.userId = :userId " +
            "ORDER BY g.gameStartAt DESC")
    List<Orders> findAllByUserIdWithDetails(@Param("userId") Long userId);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE Orders o SET o.orderStatus = :status " +
            "WHERE o.orderStatus = 'PAID' AND o.game.gameStartAt < :now")
    int expiredOrders(@Param("now") LocalDateTime now, @Param("status") OrderStatus status);
}
