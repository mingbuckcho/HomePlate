package com.homeplate.service;

import com.homeplate.dto.book.*;
import com.homeplate.dto.outbox.OutboxRequest;
import com.homeplate.entity.auth.Users;
import com.homeplate.entity.book.*;
import com.homeplate.exception.CustomException;
import com.homeplate.exception.ErrorCode;
import com.homeplate.repository.jpa.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BookService {
    private final GameRepository gameRepo;
    private final SeatRepository seatRepo;
    private final UserRepository userRepo;
    private final OrderRepository orderRepo;
    private final TicketRepository ticketRepo;
    private final RedisService redisService;
    private final OutboxService outboxService;

    // user: 경기당 최대 4매
    private final int MAX_TICKETS_PER_GAME = 4;
    // zoneStatus: 여유(예매율 70% 미만), 매진임박(예매율 70% 이상), 매진(예매율 100%)
    private static final double ZONESTATUS_BY_OCCUPYRATE = 0.7;

    /**
     *
     * 좌석 상태 (isBooked: true/false)
     */
    public List<SeatResponse> getSeatStatus(Long gameId, String zoneNumber) {
        Games game = getGameOrThrow(gameId);

        String zoneId = generateZoneId(game.getStadium().getStadiumId(), zoneNumber);
        List<Seats> seats = seatRepo.findByZone_ZoneIdOrderBySeatRowAscSeatColAsc(zoneId);
        List<Tickets> tickets = ticketRepo.findBookedTickets(gameId, zoneId);

        Set<String> soldSeatCodes = tickets.stream()
                .map(ticket -> ticket.getSeat().getSeatCode())
                .collect(Collectors.toSet());

        return seats.stream()
                .map(seat -> {
                    boolean isLocked = redisService.getLockerId(gameId, seat.getSeatCode()) != null;
                    boolean isSold = soldSeatCodes.contains(seat.getSeatCode());
                    return SeatResponse.from(seat, isLocked, isSold);
                })
                .collect(Collectors.toList());
    }

    /**
     *
     * 구역 상태 (zoneStatus: 여유/매진임박/매진)
     */
    public ZoneResponse getZoneStatus(Long gameId, String zoneNumber) {
        Games game = getGameOrThrow(gameId);

        List<SeatResponse> seats = getSeatStatus(gameId, zoneNumber);
        String zoneId = generateZoneId(game.getStadium().getStadiumId(), zoneNumber);

        int totalSeats = seats.size();
        int bookedSeats = (int) seats.stream()
                .filter(SeatResponse::isBooked).count();
        double occupancyRate = (totalSeats > 0) ? (double) bookedSeats / totalSeats : 0.0;

        ZoneStatus status = ZoneStatus.calcZoneStatus(bookedSeats, totalSeats, ZONESTATUS_BY_OCCUPYRATE);

        return ZoneResponse.from(zoneId, status, totalSeats, bookedSeats, occupancyRate, seats);
    }

    /**
     *
     * 좌석선점 (Trace: seatlock.acquire, TTL: 5분)
     */
    @Transactional
    public void reserveSeat(Long gameId, List<String> seatCodes, Long userId) {
        Games game = getGameOrThrow(gameId);
        getSeatsOrThrow(game.getStadium().getStadiumId(), seatCodes);

        int maxCount = ticketRepo.countByGame_GameIdAndUser_UserIdAndTicketStatus(gameId, userId, TicketStatus.ACTIVE);
        if (maxCount + seatCodes.size() > MAX_TICKETS_PER_GAME) {
            throw new CustomException(ErrorCode.MAXTICKET_LIMIT_EXCEEDED);
        }

        for (String seatCode : seatCodes) {
            if (ticketRepo.existsByGame_GameIdAndSeat_SeatCodeAndTicketStatus(gameId, seatCode, TicketStatus.ACTIVE)) {
                throw new CustomException(ErrorCode.SEAT_ALREADY_BOOKED);
            }
        }
        redisService.tryLock(gameId, seatCodes, userId);
    }

    /**
     *
     * 주문생성 (Trace: context)
     */
    @Transactional
    public Long createOrder(Long userId, OrderRequest request) {
        Games game = getGameOrThrow(request.getGameId());
        Users user = userRepo.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        List<Seats> seats = getSeatsOrThrow(game.getStadium().getStadiumId(), request.getSeatCodes());
        List<String> seatCodes = request.getSeatCodes();

        BigDecimal totalPrice = BigDecimal.ZERO;

        for (Seats seat : seats) {
            redisService.verifyLocker(game.getGameId(), seat.getSeatCode(), userId);

            BigDecimal price = seat.getZone().getZoneGrade().getPriceByDate(game.getGameStartAt());
            totalPrice = totalPrice.add(price);
        }

        Orders order = Orders.of(user, game, seatCodes, totalPrice);
        Long orderId = orderRepo.save(order).getOrderId();

        return orderId;
    }

    /**
     *
     * 가상결제 (Trace: payment.authorize)
     */
    @Transactional
    public void mockPayment(Long userId, PaymentRequest request) {
        Orders order = getOrderOrThrow(request.getOrderId(), userId);

        order.paid();
        createTickets(order);

        OutboxRequest outbox=OutboxRequest.create(request.getOrderId(), userId, order.getUser().getEmail());

        outboxService.paid(outbox);

        log.info("Payment success & Outbox event created for Order: {}", order.getOrderId());
    }

    private void createTickets(Orders order) {
        List<String> seatCodes = order.getSeatCodes();
        List<Tickets> tickets = new ArrayList<>();
        String stadiumId = order.getGame().getStadium().getStadiumId();

        for (String seatCode : seatCodes) {
            Seats seat = seatRepo.findByStadiumAndSeatCode(stadiumId, seatCode)
                    .orElseThrow(() -> new CustomException(ErrorCode.SEAT_NOT_FOUND));

            tickets.add(Tickets.create(order, seat, order.getTotalPrice()));
            redisService.unlockSeat(order.getGame().getGameId(), seatCode);
        }

        ticketRepo.saveAll(tickets);
    }

    /**
     *
     * private helper method
     */
    private Games getGameOrThrow(Long gameId) {
        return gameRepo.findById(gameId)
                .orElseThrow(() -> new CustomException(ErrorCode.GAME_NOT_FOUND));
    }

    private List<Seats> getSeatsOrThrow(String stadiumId, List<String> seatCodes) {
        List<Seats> seats = seatRepo.findAllByStadiumAndSeatCodes(stadiumId, seatCodes);
        if (seats.size() != seatCodes.size()) {
            throw new CustomException(ErrorCode.SEAT_NOT_VALID);
        }
        return seats;
    }

    private Orders getOrderOrThrow(Long orderId, Long userId) {
        Orders order = orderRepo.findById(orderId)
                .orElseThrow(() -> new CustomException(ErrorCode.ORDER_NOT_FOUND));

        if (!order.getUser().getUserId().equals(userId)) {
            throw new CustomException(ErrorCode.USER_NOT_MATCH);
        }
        if (order.getOrderStatus() != OrderStatus.PENDING) {
            throw new CustomException(ErrorCode.ORDER_NOT_VALID);
        }
        return order;
    }

    private String generateZoneId(String stadiumId, String zoneNumber) {
        return stadiumId + "-" + zoneNumber;
    }
}