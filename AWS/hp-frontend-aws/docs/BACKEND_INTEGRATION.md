# 백엔드(Spring Boot) 연동 요약

- **백엔드**: 수정 금지. `hp-backend-main` 폴더는 참고용.
- **연동 조건**: `.env.local`에 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080` 설정 시 실제 API 호출, 미설정 시 기존 목업/로컬 API 사용.

---

## 1. 변경/추가된 파일 목록

### 1) API 레이어 (Swagger 경로/메서드/바디 그대로 사용)

| 파일                        | 설명                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/shared/api/client.ts`  | **신규.** `getApiBase()`, `getAccessToken()`, `setAccessTokenGetter()`                                      |
| `src/shared/api/types.ts`   | **신규.** 백엔드 DTO 타입 (Auth, Info, Book, Mypage, Queue, Error)                                          |
| `src/shared/api/mappers.ts` | **신규.** `GameResponse`→`Game`, `OrderResponse`→`Ticket` 변환                                              |
| `src/shared/api/http.ts`    | **수정.** `client` 사용, Bearer 토큰 주입                                                                   |
| `src/shared/api/auth.ts`    | **신규.** POST /auth/signup, /auth/login, /auth/logout, /auth/refresh                                       |
| `src/shared/api/info.ts`    | **신규.** GET /info/games/top5, /info/games/byTeam, /info/rankings, /info/news, /info/goods                 |
| `src/shared/api/book.ts`    | **신규.** GET /book/{gameId}/zones/{zoneNumber}, POST .../seats/lock, POST /book/orders, POST /book/payment |
| `src/shared/api/mypage.ts`  | **신규.** GET /mypage/orders, DELETE /mypage/orders/{orderId}                                               |
| `src/shared/api/queue.ts`   | **신규.** POST /queue/{gameId}, GET /queue/{gameId}/rank                                                    |

### 2) 인증

| 파일                             | 변경 내용                                                              |
| -------------------------------- | ---------------------------------------------------------------------- |
| `src/features/auth/store.ts`     | `accessToken`, `setLogin()` 추가. 로그아웃 시 토큰 초기화              |
| `src/app/layout.tsx`             | `setAccessTokenGetter(() => useAuthStore.getState().accessToken)` 등록 |
| `src/app/auth/login/page.tsx`    | `getApiBase()` 시 `login` API 호출 후 `setLogin(accessToken, …)`       |
| `src/app/auth/register/page.tsx` | `getApiBase()` 시 `signUp` API 호출 후 로그인 페이지로 이동            |

### 3) 일정/홈

| 파일                               | 변경 내용                                                         |
| ---------------------------------- | ----------------------------------------------------------------- |
| `src/features/games/store.ts`      | `setItems(items)` 추가                                            |
| `src/app/(tabs)/schedule/page.tsx` | `getApiBase()` 시 GET /info/games/top5, byTeam 호출 후 `setItems` |
| `src/app/(tabs)/page.tsx`          | `getApiBase()` 시 GET /info/games/top5 호출 후 `setItems`         |

### 4) 좌석/예매/결제

| 파일                                              | 변경 내용                                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/features/booking/api.ts`                     | `getApiBase()` 시 `lockSeats`(shared/api/book), `fetchClaimedSeats` 시 GET zone으로 선점 좌석 반영 |
| `src/app/(tabs)/games/[gid]/zones/[zid]/page.tsx` | `getApiBase()` 시 GET /book/{gameId}/zones/{zoneNumber}로 좌석/구역 상태 표시, 좌석 id=seatCode    |
| `src/app/(tabs)/checkout/page.tsx`                | `getApiBase()` 시 POST /book/orders → POST /book/payment 후 마이페이지로 이동                      |

### 5) 마이페이지/티켓

| 파일                                    | 변경 내용                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(tabs)/mypage/page.tsx`        | `getApiBase()` 시 GET /mypage/orders로 예매확정/예매취소·만료 탭 표시, 예매취소 시 DELETE /mypage/orders/{orderId}, 로그아웃 시 POST /auth/logout |
| `src/app/(tabs)/tickets/[tid]/page.tsx` | `getApiBase()` 시 GET /mypage/orders 후 orderId=tid 인 주문을 티켓으로 표시                                                                       |

### 6) 대기열 / 순위

| 파일                            | 변경 내용                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/app/(tabs)/queue/page.tsx` | `getApiBase()` 시 POST /queue/{gameId} 진입, GET /queue/{gameId}/rank 폴링, status ACTIVE 시 구역 선택으로 이동 |
| `src/app/(tabs)/ranks/page.tsx` | `getApiBase()` 시 GET /info/rankings로 순위 탭 데이터 표시                                                      |

---

## 2. 테스트 방법 (백엔드 localhost:8080 + 프론트 localhost:3000 가정)

1. **환경**
   - `.env.local`: `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`
   - 백엔드(Spring Boot) 실행, MySQL 등 DB 준비.
   - **관리자 경기 생성**을 쓸 경우: 구장·팀 초기 데이터 필요. → **권장:** `docs/data.sql` 내용을 `hp-backend-main/api/src/main/resources/data.sql`로 복사 후 백엔드 재시작. 또는 MySQL에서 `docs/seed-stadiums-teams.sql` 실행. 자세한 내용은 `docs/README-ADMIN-SEED.md` 참고.

2. **로그인**
   - **페이지**: `/auth/login`
   - **확인**: 이메일/비밀번호 입력 후 "로그인" → 성공 시 상단 "My" 등 로그인 상태로 이동.

3. **회원가입**
   - **페이지**: `/auth/register`
   - **확인**: 이름/전화번호/이메일/비밀번호 입력 후 "가입하기" → 로그인 페이지로 이동.

4. **일정(경기 목록)**
   - **페이지**: `/schedule` (TICKETS)
   - **확인**: 다가오는 경기 5건 또는 구단 필터 시 해당 구단 경기가 백엔드 데이터로 표시.

5. **홈 히어로**
   - **페이지**: `/`
   - **확인**: 상단 히어로에 다가오는 경기가 백엔드 top5 기준으로 표시.

6. **좌석 선택 ~ 결제**
   - **페이지**: `/schedule` → 경기 선택 → 구역 선택 → `/games/[gid]/zones/[zid]`
   - **확인**:
     - 좌석 그리드가 백엔드 구역/좌석 데이터로 표시되고,
     - 좌석 선택 후 "결제하기" → 좌석 선점(lock) 성공 시 결제 페이지로 이동.
   - **페이지**: `/checkout`
   - **확인**: "결제 완료" 클릭 → 주문 생성·가상 결제 후 마이페이지로 이동.

7. **마이페이지**
   - **페이지**: `/mypage`
   - **확인**: 예매확정 / 예매취소·만료 탭에 백엔드 주문 목록 표시, "예매취소" 시 해당 주문 취소 후 목록 갱신, "로그아웃" 시 백엔드 로그아웃 후 로그인 화면으로 이동.

8. **티켓 상세**
   - **페이지**: `/mypage` → 예매확정 항목에서 "보기"
   - **확인**: `/tickets/[orderId]` 에서 해당 주문이 티켓 형태(QR 등)로 표시.

9. **대기열**
   - **페이지**: `/queue?gameId=1&from=popup` (실제 경기 ID로 테스트)
   - **확인**: 대기열 진입 후 순번/상태 표시, status ACTIVE 시 구역 선택으로 자동 이동.

10. **순위**
    - **페이지**: `/ranks`
    - **확인**: "순위" 탭에 GET /info/rankings 데이터(구단 순위) 표시.

---

## 3. 사용한 Swagger 엔드포인트 요약

| 메서드 | 경로                              | 용도                                 |
| ------ | --------------------------------- | ------------------------------------ |
| POST   | /auth/signup                      | 회원가입                             |
| POST   | /auth/login                       | 로그인                               |
| POST   | /auth/logout                      | 로그아웃                             |
| POST   | /auth/refresh                     | 토큰 재발급                          |
| GET    | /info/games/top5                  | 다가오는 경기 5개                    |
| GET    | /info/games/byTeam                | 구단별 경기 (teamId, date 선택)      |
| GET    | /info/rankings                    | 구단 순위                            |
| GET    | /book/{gameId}/zones/{zoneNumber} | 구역별 좌석/혼잡도                   |
| POST   | /book/{gameId}/seats/lock         | 좌석 선점 (body: string[] seatCodes) |
| POST   | /book/orders                      | 주문 생성 (body: OrderRequest)       |
| POST   | /book/payment                     | 가상 결제 (body: PaymentRequest)     |
| GET    | /mypage/orders                    | 예매 내역(활성/비활성)               |
| DELETE | /mypage/orders/{orderId}          | 예매 전체 취소                       |
| POST   | /queue/{gameId}                   | 대기열 진입                          |
| GET    | /queue/{gameId}/rank              | 대기열 순번/상태                     |

추측으로 만든 엔드포인트는 없으며, 위 목록은 Swagger/백엔드 컨트롤러 기준입니다.
