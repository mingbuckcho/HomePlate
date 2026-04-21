package com.homeplate.initializer;

import com.homeplate.entity.book.Stadiums;
import com.homeplate.repository.jpa.SeatRepository;
import com.homeplate.repository.jpa.StadiumRepository;
import com.homeplate.service.InitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class BookInitializer implements CommandLineRunner {
    private final StadiumRepository stadiumRepo;
    private final SeatRepository seatRepo;
    private final InitService service;

    @Override
    public void run(String... args) throws Exception {
        if (seatRepo.count() > 0) {
            log.info("이미 좌석 데이터가 존재합니다.");
            return;
        }

        List<Stadiums> stadiums = stadiumRepo.findAll();
        if (stadiums.isEmpty()) {
            log.warn("등록된 구장이 없습니다. DB에 Stadium 데이터가 있는지 확인해주세요.");
            return;
        }
        log.info("총 {}개의 구장을 찾았습니다. 생성을 시작합니다.", stadiums.size());

        for (Stadiums stadium : stadiums) {
            try {
                service.initStadium(stadium);
                log.info("[성공] {} 좌석 생성 완료", stadium.getStadiumName());
            } catch (Exception e) {
                log.error("[실패] {}", e.getMessage());
            }
        }
    }
}
