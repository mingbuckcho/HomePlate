package com.homeplate.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.homeplate.dto.book.ZoneResponse;
import com.homeplate.dto.chat.ChatRequest;
import com.homeplate.dto.chat.ChatResponse;
import com.homeplate.entity.book.Games;
import com.homeplate.entity.chat.ChatMenu;
import com.homeplate.exception.CustomException;
import com.homeplate.exception.ErrorCode;
import com.homeplate.repository.jpa.GameRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {
    private final GameRepository gameRepo;
    private final BookService service;
    private final ObjectMapper mapper;
    private final WebClient webClient;
    private final TransactionTemplate txTemplate;

    @Value("${WEATHER_API_KEY}")
    private String apiKey;

    /**
     *
     * menu process
     */
    public ChatResponse menu(ChatRequest request) {
        Integer menuId = request.getMenuId();

        switch (menuId) {
            case 1:
            case 2:
                return new ChatResponse(ChatMenu.getMessage(menuId));
            case 3:
                return getZoneStatus(request.getGameId(), request.getZoneNumber());
            case 4:
                return getWeather(request.getGameId());
            default:
                return new ChatResponse(ChatMenu.CS.getMessage());
        }

    }

    /**
     *
     * menu 3 (구장별 좌석현황)
     */
    private ChatResponse getZoneStatus(Long gameId, String zoneNumber) {
        // DB 조회가 필요하므로 이 블록만 짧게 트랜잭션으로 묶어줍니다.
        return txTemplate.execute(status -> {
            if (gameId == null) {
                List<Games> games = gameRepo.findAllByGameStartAtAfterOrderByGameStartAtAsc(LocalDateTime.now());
                if (games.isEmpty()) return new ChatResponse("현재 예매 가능한 경기가 없습니다.");

                StringBuilder gamesb = new StringBuilder("현재 예매 가능한 경기 목록입니다.\n\n");
                for (Games game : games) {
                    gamesb.append(String.format(" - [%s] %s vs %s , %s (ID: %d) \n",
                            game.getStadium().getStadiumName(), game.getHome().getTeamName(),
                            game.getAway().getTeamName(), game.getGameStartAt(), game.getGameId()));
                }
                return new ChatResponse(gamesb.toString());
            }

            if (zoneNumber == null || zoneNumber.trim().isEmpty()) {
                Games game = gameRepo.findById(gameId).orElseThrow(() -> new CustomException(ErrorCode.GAME_NOT_FOUND));
                return new ChatResponse("구장 좌석도를 확인하시고, 조회하실 구역 번호를 입력해주세요.");
            }

            try {
                ZoneResponse zoneStatus = service.getZoneStatus(gameId, zoneNumber);
                String state = zoneStatus.getStatus().name();
                int remain = zoneStatus.getTotalSeats() - zoneStatus.getBookedSeats();
                return new ChatResponse(String.format("선택하신 %s 구역은 현재 [%s] 상태입니다. (잔여 %d석 / 총 %d석)",
                        zoneNumber, state, remain, zoneStatus.getTotalSeats()));
            } catch (CustomException e) {
                return new ChatResponse("좌석 정보를 조회할 수 없습니다: " + e.getMessage());
            }
        });
    }

    /**
     *
     * menu 4 (날씨 조회)
     */
    private ChatResponse getWeather(Long gameId) {
        // 1. DB 조회는 짧게 끝내고 바로 커넥션을 반납합니다.
        String[] gameInfo = txTemplate.execute(status -> {
            if (gameId == null) {
                return null;
            }
            Games game = gameRepo.findById(gameId).orElseThrow(() -> new CustomException(ErrorCode.GAME_NOT_FOUND));
            // Lazy 로딩 강제 초기화 후 데이터만 빼옵니다.
            return new String[]{
                    game.getGameStartAt().format(DateTimeFormatter.ofPattern("yyyyMMdd")),
                    game.getStadium().getStadiumName()
            };
        });

        if (gameInfo == null) {
            return txTemplate.execute(status -> {
                LocalDateTime now = LocalDateTime.now();
                LocalDateTime next = now.plusDays(3);
                List<Games> games = gameRepo.findAllByGameStartAtBetweenOrderByGameStartAtAsc(now, next);
                if (games.isEmpty()) return new ChatResponse("3일 이내에 예정된 경기가 없습니다.");

                StringBuilder gamesb = new StringBuilder("날씨를 조회할 경기를 선택해주세요. (3일 이내 경기만 조회 가능)");
                for (Games game : games) {
                    gamesb.append(String.format("\n - [%s] %s vs %s , %s (ID: %d)",
                            game.getStadium().getStadiumName(), game.getHome().getTeamName(),
                            game.getAway().getTeamName(), game.getGameStartAt(), game.getGameId()));
                }
                return new ChatResponse(gamesb.toString());
            });
        }

        // 2. 외부 API 통신 (이 시점에는 DB 커넥션을 쥐고 있지 않아 아주 안전합니다!)
        try {
            int pop = getPop(gameInfo[0], gameInfo[1]);
            if (pop >= 95) {
                return new ChatResponse(String.format("해당 경기 시간의 예상 강수확률은 %d%%입니다.\n우천으로 인해 경기가 취소될 확률이 매우 높으니 구단 공지사항을 반드시 확인해주세요.", pop));
            } else if (pop >= 70) {
                return new ChatResponse(String.format("해당 경기 시간의 예상 강수확률은 %d%%입니다.\n우천 시 경기 진행 여부가 변동될 수 있으니 주의 바랍니다.", pop));
            } else {
                return new ChatResponse(String.format("해당 경기 시간의 예상 강수확률은 %d%%입니다.\n날씨로 인한 경기 지연 및 취소 확률은 낮습니다. 즐거운 관람 되세요!", pop));
            }
        } catch (Exception e) {
            log.error("기상청 API 호출 중 오류 발생", e);
            return new ChatResponse("일시적으로 날씨 정보를 불러올 수 없거나, 아직 기상청 예보가 발표되지 않은 날짜입니다.");
        }
    }

    private int getPop(String gameDate, String stadiumName) throws JsonProcessingException {
        LocalDateTime yesterday = LocalDateTime.now().minusDays(1);
        String baseDate = yesterday.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String baseTime = "2300";

        int[] xy = getGrid(stadiumName);
        int nx = xy[0];
        int ny = xy[1];

        String json = webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/1360000/VilageFcstInfoService_2.0/getVilageFcst")
                        .queryParam("ServiceKey", apiKey)
                        .queryParam("pageNo", "1")
                        .queryParam("numOfRows", "300")
                        .queryParam("dataType", "JSON")
                        .queryParam("base_date", baseDate)
                        .queryParam("base_time", baseTime)
                        .queryParam("nx", nx)
                        .queryParam("ny", ny)
                        .build())
                .retrieve()
                .bodyToMono(String.class)
                .block();

        JsonNode root = mapper.readTree(json);
        JsonNode header = root.path("response").path("header");

        if (!"00".equals(header.path("resultCode").asText())) {
            log.warn("기상청 API 응답 에러: {}", header.path("resultMsg").asText());
            return 0;
        }

        JsonNode items = root.path("response").path("body").path("items").path("item");
        if (items.isMissingNode() || !items.isArray()) throw new RuntimeException("기상청 API 응답 형식이 올바르지 않습니다.");

        for (JsonNode item : items) {
            String category = item.path("category").asText();
            String fcstDate = item.path("fcstDate").asText();

            if ("POP".equals(category) && gameDate.equals(fcstDate)) {
                return item.path("fcstValue").asInt();
            }
        }
        return 0;
    }

    private int[] getGrid(String stadiumName) {
        // 1. 창원NC파크 (경남 창원시 마산회원구)
        if (stadiumName.contains("창원")) {
            return new int[]{89, 74};
        }
        // 2. 대구삼성라이온즈파크 (대구 수성구)
        else if (stadiumName.contains("대구") || stadiumName.contains("라이온즈")) {
            return new int[]{89, 90};
        }
        // 3. 고척스카이돔 (서울 구로구)
        else if (stadiumName.contains("고척")) {
            return new int[]{58, 125};
        }
        // 4. 광주기아챔피언스필드 (광주 북구)
        else if (stadiumName.contains("광주") || stadiumName.contains("챔피언스")) {
            return new int[]{58, 74};
        }
        // 5. 인천SSG랜더스필드 (인천 미추홀구)
        else if (stadiumName.contains("인천") || stadiumName.contains("랜더스")) {
            return new int[]{54, 124};
        }
        // 6. 수원케이티위즈파크 (경기 수원시 장안구)
        else if (stadiumName.contains("수원") || stadiumName.contains("케이티")) {
            return new int[]{60, 121};
        }
        // 7. 사직야구장 (부산 동래구)
        else if (stadiumName.contains("사직")) {
            return new int[]{98, 76};
        }
        // 8. 서울종합운동장 야구장 / 잠실 (서울 송파구)
        else if (stadiumName.contains("종합운동장") || stadiumName.contains("잠실")) {
            return new int[]{62, 126};
        }
        // 9. 대전한화생명볼파크 (대전 중구)
        else if (stadiumName.contains("대전") || stadiumName.contains("한화")) {
            return new int[]{68, 100};
        }
        // 기본값 (서울 중심부)
        else {
            return new int[]{60, 127};
        }
    }
}
