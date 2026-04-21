# 토큰·대기열(Queue) 플로우 점검 보고서

백엔드를 Core / Queue / Booking 3파드로 분리한 뒤, 프론트엔드의 인증·대기열 연동 상태를 점검한 결과입니다.

---

## 1. 현재 상태 요약

| 항목                                | 상태          | 비고                                                                                                                              |
| ----------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| AccessToken 저장                    | ✅ 구현됨     | 로그인 시 `setLogin({ accessToken, ... })` → zustand persist (sessionStorage `homeplate_auth_session_v1`)                         |
| AccessToken 사용                    | ✅ 구현됨     | `LayoutClient`에서 `setAccessTokenGetter(() => useAuthStore.getState().accessToken)` → `http.ts`에서 `Authorization: Bearer` 부착 |
| **RefreshToken 갱신**               | ❌ **미구현** | `auth.ts`에 `refreshToken()` 존재하나 **어디에서도 호출되지 않음**                                                                |
| **401 시 재시도**                   | ❌ **미구현** | 401 시 곧바로 `logout()` + 로그인 페이지 리다이렉트만 수행, refresh 시도 없음                                                     |
| **Queue 토큰 수신·저장**            | ❌ **미구현** | `QueueResponse`에 `queueToken` 필드 없음, `enterQueue()` 응답에서 토큰 저장 안 함                                                 |
| **Booking 요청 시 Queue 토큰 첨부** | ❌ **미구현** | `/book/*` 요청에 Queue 증표 헤더 없음                                                                                             |

---

## 2. AccessToken / RefreshToken

### 2.1 저장 구조

- **auth store** (`src/features/auth/store.ts`): `isAuthed`, `user`, `accessToken` 만 persist.
- **RefreshToken**: 백엔드는 Body가 아니라 **쿠키로만** 전달한다고 문서화됨 (`docs/ADMIN-AUTH.md`). 프론트는 쿠키를 읽지 않고, **갱신 API를 호출하지도 않음**.

### 2.2 문제점

1. **갱신 로직 부재**
   - `src/shared/api/auth.ts`의 `refreshToken()`은 `/auth/refresh`를 호출해 새 accessToken을 받지만, **호출하는 코드가 전혀 없음**.
   - AccessToken 만료 시: 401 → 즉시 로그아웃 + 리다이렉트만 발생.

2. **앱 초기 로드 시 복구 없음**
   - RefreshToken 쿠키만 있고 AccessToken이 없거나 만료된 경우(새 탭, 오래 방치 등)를 대비한 “한 번 refresh 시도” 로직이 없음.

3. **Application 탭에서 RefreshToken만 보이고 AccessToken/QueueToken이 없다는 상황**
   - AccessToken은 `sessionStorage`의 zustand persist 키(`homeplate_auth_session_v1`) 안에 들어 있음.
   - 로그인 응답에서 `accessToken`을 안 주거나, 다른 키로 저장하는 등 백엔드/프론트 스펙이 어긋나면 저장이 안 될 수 있음.
   - QueueToken은 아예 저장하지 않으므로 당연히 없음.

### 2.3 권장 조치 (구현함)

- **401 응답 인터셉터**: 401 발생 시 **한 번만** `/auth/refresh` 호출 → 성공 시 새 accessToken을 store에 반영 후 해당 요청 재시도, 실패 시 기존처럼 logout + 로그인 페이지로 이동.
- (선택) 앱 마운트 시점에 accessToken이 없으면 refresh 한 번 시도하는 로직 추가 가능.

---

## 3. 대기열(Queue) → Booking 2단계 토큰 릴레이

### 3.1 기대 플로우

1. **Queue 파드**: `POST /queue/{gameId}` 호출 → 응답으로 **Queue 토큰(증표)** 수신.
2. **브라우저**: 해당 토큰을 저장.
3. **Booking 파드**: `/book/*` 호출 시 **저장한 Queue 토큰을 헤더 등으로 첨부**.

### 3.2 현재 구현

- **Queue**
  - `QueueResponse` 타입: `{ status, rank }` 만 존재. **queueToken(또는 이에 상응하는 필드) 없음.**
  - `enterQueue()` 호출 후 응답에서 토큰을 꺼내 저장하는 코드 없음.

- **Booking**
  - `lockSeats`, `getZoneSeats`, `createOrder`, `payment` 등은 모두 공용 `http` 인스턴스만 사용.
  - `http`는 `Authorization: Bearer <accessToken>` 만 붙이고, **Queue 증표용 헤더는 없음.**

### 3.3 문제점

- Queue 파드가 응답 body 또는 cookie로 토큰을 줘도, 프론트가 **필드/쿠키를 읽지 않고**, Booking 요청 시 **어디에도 붙이지 않음**.
- 그래서 Booking 파드에서 “대기열 통과 증표 없음”으로 403 등을 내고,  
  → 구역/좌석 로딩 실패 → `zoneLoadStatus === "error"` → “해당 구역 정보를 불러올 수 없습니다” 또는 결제하기 버튼 비활성화 등으로 이어질 수 있음.

### 3.4 권장 조치 (구현함)

- **타입**: `QueueResponse`에 `queueToken?: string` (또는 백엔드 스펙에 맞는 필드명) 추가.
- **저장**: `enterQueue(gameId)` 응답에 토큰이 있으면 **gameId별로** 저장 (sessionStorage 또는 메모리 스토어).
- **Booking 요청**: `getZoneSeats`, `lockSeats`, `createOrder`, `payment` 등 **gameId를 아는** 모든 `/book/*` 호출에, 해당 gameId의 Queue 토큰이 있으면 **헤더**(예: `X-Queue-Token`)에 첨부.
- **백엔드 확인 필요**: Queue 응답의 토큰 필드명, Booking 파드가 기대하는 헤더 이름/형식.

---

## 4. “조용히 return” 가능성

- **admin**: `getAccessToken()`이 없으면 `alert` 후 `return` → 조용한 실패는 아님.
- **일반 예매**:
  - `useRequireAuth()`는 미인증 시 로그인으로 **리다이렉트**하므로 “조용히 return”은 아님.
  - 다만 **AccessToken이 없거나 만료**된 상태에서 API만 호출하면 401 → 인터셉터에서 logout + 리다이렉트.
  - **Queue 토큰이 없어** Booking이 403을 주면: `getZoneSeats` 실패 → `zoneLoadStatus === "error"` → 구역 선택 화면에서 “해당 구역 정보를 불러올 수 없습니다”만 표시되고, 좌석으로 들어가는 버튼이 비활성화될 수 있어, “에러 메시지 없이 동작만 안 하는” 느낌을 줄 수 있음.

---

## 5. 백엔드 측 확인 요청 사항

1. **로그인 응답**
   - `POST /auth/login` 응답 Body에 `accessToken`, `userName`(또는 동일 역할 필드)이 그대로 오는지.
   - RefreshToken은 정말 쿠키 전달만 하는지, 쿠키 이름/경로.

2. **Refresh**
   - `POST /auth/refresh`: 쿠키만으로 호출하는지, 응답 Body에 새 accessToken 문자열(또는 JSON 필드)을 주는지.

3. **Queue**
   - `POST /queue/{gameId}` 응답에 **대기열 통과 증표(QueueToken)**를 주는지.
   - 주는 경우: **필드 이름**(예: `queueToken`, `token`)과 값 형식(예: JWT 문자열).

4. **Booking**
   - `/book/*`에서 위 Queue 증표를 **어떤 헤더**로 기대하는지(예: `X-Queue-Token`, `Authorization: Bearer <queueToken>` 등).

위가 확정되면 타입/필드명/헤더명만 맞춰서 프론트 수정을 마무리할 수 있습니다.

---

## 6. 적용한 수정 사항 (프론트엔드)

- **401 시 Refresh 후 재시도**
  - `src/shared/api/http.ts`: 401 발생 시 `/auth/refresh` 1회 호출(쿠키 전송).
  - 성공 시 새 accessToken을 auth store에 반영(`setAccessToken`) 후 해당 요청 재시도.
  - 실패 시 기존과 동일하게 로그아웃 후 `/auth/login?expired=1`로 이동.
  - `/auth/refresh` 요청 자체가 401이면 refresh 재시도 없이 로그아웃.

- **Auth store**
  - `src/features/auth/store.ts`: Refresh로 accessToken만 갱신하기 위한 `setAccessToken(accessToken)` 액션 추가.

- **Queue 토큰 수신·저장·Booking 첨부**
  - `src/shared/api/types.ts`: `QueueResponse`에 `queueToken?: string` 추가.
  - `src/shared/api/client.ts`: `getQueueToken(gameId)`, `setQueueToken(gameId, token)`, `QUEUE_TOKEN_HEADER` 상수 추가. gameId별 토큰은 sessionStorage 키 `homeplate_queue_tokens`에 JSON으로 저장.
  - `src/app/(tabs)/queue/page.tsx`: `enterQueue(gameId)` 응답에 `queueToken`이 있으면 `setQueueToken(gameId, res.queueToken)` 호출.
  - `src/shared/api/book.ts`: `getZoneSeats`, `lockSeats`, `createOrder`, `payment` 호출 시 해당 gameId의 Queue 토큰이 있으면 `X-Queue-Token` 헤더로 첨부.
  - `payment(orderId, gameId?)`: 결제 시에도 대기열 토큰을 보내도록 두 번째 인자로 gameId 전달 가능.
  - `src/app/(tabs)/checkout/page.tsx`: `payment(orderId, gameId)` 호출로 gameId 전달.

- **백엔드와 확인할 것**
  - `/auth/refresh` 응답: Body가 `{ "accessToken": "..." }` 인지, 아니면 JWT 문자열만 내려오는지(현재 둘 다 처리).

- **Queue 토큰 관련 (롤백 완료)**
  - 백엔드 확인 결과: Booking API는 **QueueToken을 요구하지 않고 AccessToken만 사용**합니다.
  - 따라서 Queue 토큰 수신·저장·Booking 헤더 첨부 코드는 **전부 제거(롤백)** 했습니다.

---

## 7. 예매 플로우 점검용 추가 (백엔드 팀 요청)

- **AccessToken 유실 시 조용한 return 방지**
  - `src/features/booking/api.ts`: 백엔드 연동 시 좌석 선점 전 `getAccessToken()` 확인. 없으면 API 호출 없이 return + **console.warn** + 사용자 메시지("로그인 세션이 없습니다...").
  - `src/app/(tabs)/checkout/page.tsx`: 결제 클릭 시 Token 없으면 동일하게 경고 로그 + 토스트 후 return.

- **데이터 바인딩 디버깅 로그**
  - 구역 선택 → "좌석 선택으로 이동" 클릭 시: `[Booking Debug]` + gameId, zoneId.
  - 좌석 선택 → "결제하기" 클릭 시: `[Booking Debug]` + gameId, zoneId, selectedSeatIds.
  - 결제 페이지 → "결제 완료" 클릭 시: `[Booking Debug]` + gameId, zoneId, seatCodes 등.

- **CORS**
  - 코드 변경 없음. Console **Warnings** 필터로 Preflight(OPTIONS) 실패 메시지 확인하도록 `docs/VERIFICATION-BOOKING.md`에 정리.
