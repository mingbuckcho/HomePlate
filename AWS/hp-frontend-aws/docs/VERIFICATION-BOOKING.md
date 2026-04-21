# 예매 플로우 점검 가이드 (백엔드 팀 요청 3가지)

백엔드 파드 분리 후 "예매하기/결제하기가 멈춘다"는 현상 원인 파악을 위해, 프론트엔드에서 아래 3가지를 확인할 수 있도록 반영했습니다.

---

## 1. AccessToken 유실 여부

**질문:** 예매하기 버튼을 누르는 순간, sessionStorage에 AccessToken이 들어있는지 100% 확신할 수 있나요?

### 프론트 반영

- **저장 위치:** `sessionStorage` 키 `homeplate_auth_session_v1` (Zustand persist).  
  값은 `{ isAuthed, user, accessToken }` 형태의 JSON입니다.  
  → **Application 탭 → Session Storage → `homeplate_auth_session_v1`** 에서 `accessToken` 필드 존재 여부 확인.

- **방어 로직:**
  - **좌석 선점(예매하기)** 시: 백엔드 연동 시(`getApiBase()` 있음) AccessToken이 없으면 API 호출 전에 **즉시 return**하고,
    - 콘솔에 `[Booking] AccessToken 유실: ...` **경고** 출력
    - 사용자에게 "로그인 세션이 없습니다. 다시 로그인한 뒤 예매해 주세요. (AccessToken 없음)" 메시지 표시
  - **결제하기** 시: 동일하게 Token 없으면 결제 API 호출 전 **return** + 콘솔 경고 + 토스트 "로그인 세션이 없습니다. 다시 로그인한 뒤 결제해 주세요."

따라서 **AccessToken이 없으면 조용히 return되지 않고**, 콘솔 경고와 사용자 메시지가 나와야 합니다.  
여전히 아무 반응이 없다면, 해당 버튼의 onClick까지 도달하지 못하는 다른 경로(예: `useRequireAuth` 리다이렉트, 버튼 disabled 등)를 의심할 수 있습니다.

---

## 2. CORS 차단 여부

**질문:** 네트워크 탭에 요청이 안 찍힌다면, Preflight(OPTIONS) 실패로 요청 자체가 막혔을 수 있습니다.

### 확인 방법

1. 브라우저 **개발자 도구 → Console** 열기
2. 상단 필터에서 **"Warnings"**(경고) 선택
3. 예매하기 / 결제하기 클릭 후 **CORS, OPTIONS, Cross-Origin** 관련 메시지\*\* 가 있는지 확인

예시 메시지:

- `Access to fetch at '...' from origin '...' has been blocked by CORS policy`
- `Response to preflight request doesn't pass access control check`

이런 메시지가 보이면 백엔드에서 해당 API의 CORS(Allow-Origin, Allow-Headers 등) 설정을 점검해야 합니다.

---

## 3. 데이터 바인딩 실패 여부 (zoneId / gameId undefined)

**질문:** 버튼 클릭 시 파라미터(zoneId, gameId)가 undefined로 넘어가는지 확인해 주세요.

### 프론트 반영 (디버깅용 console.log)

다음 버튼 클릭 시 **콘솔에 `[Booking Debug]`** 로 시작하는 로그가 출력됩니다.  
값이 `undefined`인지 확인하면 됩니다.

| 위치             | 버튼                   | 로그 내용                                             |
| ---------------- | ---------------------- | ----------------------------------------------------- |
| 구역 선택 페이지 | **좌석 선택으로 이동** | `gameId`, `zoneId`(선택한 구역 id)                    |
| 좌석 선택 페이지 | **결제하기**(예매하기) | `gameId`, `zoneId`, `selectedSeatIds`                 |
| 결제 페이지      | **결제 완료**          | `gameId`, `zoneId`, `selectedSeatsCount`, `seatCodes` |

- **확인 방법:**
  1. 개발자 도구 Console 열기
  2. 예매 플로우에서 위 버튼들 순서대로 클릭
  3. 각 클릭 시 `[Booking Debug]` 로그에서 `gameId`, `zoneId` 등이 **undefined가 아닌지** 확인

- **정리:**  
  디버깅이 끝나면 `[Booking Debug]` 로그는 제거하거나, 환경 변수(예: `NEXT_PUBLIC_DEBUG_BOOKING`)로 감싸서 개발 시에만 출력하도록 변경해도 됩니다.

---

## 요약

| 항목                 | 프론트에서 할 수 있는 확인                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **AccessToken 유실** | Application 탭에서 `homeplate_auth_session_v1` → `accessToken` 존재 여부 확인. Token 없으면 이제 경고 로그 + 사용자 메시지로 드러남. |
| **CORS**             | Console **Warnings** 필터에서 CORS/OPTIONS/Preflight 관련 메시지 확인.                                                               |
| **데이터 바인딩**    | `[Booking Debug]` 로그로 `gameId`, `zoneId` 등이 undefined인지 확인.                                                                 |

이 3가지를 위 순서대로 확인하면, "단일 서버일 때는 되다가 파드 분리 후 멈춘 현상"의 원인이 AccessToken 유실 / CORS / 파라미터 undefined 중 어디인지 좁혀갈 수 있습니다.
