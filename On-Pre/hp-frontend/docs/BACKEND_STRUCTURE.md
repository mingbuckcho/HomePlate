# 백엔드 연동 가이드 (HOMEPLATE)

백엔드 담당자가 API를 붙일 때 참고할 파일/폴더 규칙과 변경 포인트입니다.

---

## 1. 환경 변수

| 변수                       | 용도                          | 예시                                |
| -------------------------- | ----------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | API 서버 베이스 URL           | `https://api.homeplate.example.com` |
| `NEXT_PUBLIC_USE_MOCKS`    | `true`면 목(mock) 데이터 사용 | `false` (운영)                      |

**변경 위치**: `.env.local` (또는 배포 환경 설정)

```env
NEXT_PUBLIC_API_BASE_URL=https://your-api.com
NEXT_PUBLIC_USE_MOCKS=false
```

---

## 2. HTTP 클라이언트 / 인증

| 파일                     | 역할                                | 백엔드 연동 시 수정                                                                                              |
| ------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/shared/api/http.ts` | axios 인스턴스, `baseURL`, 인터셉터 | `getAccessToken()` 구현: 세션/토큰 저장소에서 accessToken 반환. 401 시 refresh 로직은 여기 또는 별도 훅에서 처리 |

---

## 3. API 호출 위치 (기능별)

API 호출은 **기능 단위**로 `src/features/<기능>/api.ts` 또는 `src/shared/api/`에 두고, 페이지/컴포넌트는 이 레이어만 사용합니다.

| 기능            | API/데이터 파일                                                           | 연동 시 할 일                                                                                                           |
| --------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 경기 목록/상세  | `src/features/games/api.ts`                                               | `USE_MOCKS` 분기 제거 후 `http.get('/games')` 등 실제 엔드포인트 호출. 응답 타입은 `src/entities/game/type.ts`에 맞추기 |
| 홈(배너 등)     | `src/features/home/api.ts`                                                | 필요 시 홈 전용 API 호출로 교체                                                                                         |
| 일정            | `src/features/schedule/api.ts`                                            | 경기 API와 통합이면 games API 재사용 가능                                                                               |
| 순위/기록       | `src/features/ranks/api.ts`                                               | 순위/팀 기록 API 응답을 `src/app/(tabs)/ranks/page.tsx`에서 사용하도록 연결                                             |
| 굿즈            | `src/shared/mocks/goods.ts` 참고, 페이지: `src/app/(tabs)/goods/page.tsx` | 굿즈 API 추가 후 목 데이터 제거, 페이지에서 API 호출로 교체                                                             |
| 티켓            | `src/shared/api/tickets.ts`, `src/features/tickets/store.ts`              | 발급/조회/취소 API 연동. 타입: `src/entities/tickets/type.ts`                                                           |
| 예매(좌석 선택) | `src/features/booking/store.ts`, `src/features/seats/`                    | 좌석 가용 여부/예약 잠금 API 연동                                                                                       |
| 인증            | `src/shared/api/auth.ts`, `src/features/auth/store.ts`                    | 로그인/회원가입/토큰 갱신 API 연동. 토큰은 store 또는 쿠키에 저장 후 `http.ts`의 `getAccessToken()`에서 사용            |

---

## 4. 타입(엔티티) 위치

**규칙**: API **응답/요청 DTO**는 `src/entities/` 아래 도메인별로 정의합니다. 백엔드 스펙이 정해지면 이 타입만 수정하면 됩니다.

| 디렉터리                       | 내용                                   |
| ------------------------------ | -------------------------------------- |
| `src/entities/game/type.ts`    | 경기(Game), 강제 상태(ForcedStatus) 등 |
| `src/entities/goods/type.ts`   | 굿즈                                   |
| `src/entities/tickets/type.ts` | 티켓, 예매 스냅샷                      |
| `src/entities/seat/type.ts`    | 좌석                                   |
| `src/entities/zone/type.ts`    | 구역                                   |
| `src/entities/ranks/type.ts`   | 순위/기록 (필요 시)                    |
| `src/entities/news/type.ts`    | 뉴스 (필요 시)                         |

**백엔드 연동 시**:

- API 응답이 위 타입과 다르면 `entities/<도메인>/type.ts` 수정
- 그 다음 해당 API를 쓰는 `features/*/api.ts` 또는 `shared/api/*.ts`에서 매핑만 맞추면 됩니다.

---

## 5. 목(mock) 데이터 제거

| 위치                            | 설명                                                                  |
| ------------------------------- | --------------------------------------------------------------------- |
| `src/shared/mocks/`             | 홈, 굿즈, 순위, 일정 등 더미 데이터. API 전환 후 import 제거          |
| `src/features/games/store.ts`   | localStorage 기반 경기 목록. API 연동 시 서버에서 fetch 후 store 갱신 |
| `src/features/auth/store.ts`    | 더미 로그인. 실제 로그인 API + 토큰 저장으로 교체                     |
| `src/features/tickets/store.ts` | 티켓 localStorage. API 연동 시 서버 발급/조회/취소로 교체             |

---

## 6. 요약 체크리스트

- [ ] `.env`에 `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_USE_MOCKS` 설정
- [ ] `src/shared/api/http.ts`에서 `getAccessToken()` 구현 및 401 처리 정책 결정
- [ ] `src/entities/**/type.ts`를 백엔드 스펙에 맞게 수정
- [ ] `src/features/*/api.ts`, `src/shared/api/*.ts`에서 실제 API 호출로 교체
- [ ] 목 사용처(`USE_MOCKS`, `shared/mocks`) 제거 또는 비활성화
- [ ] 인증(로그인/회원가입/토큰 갱신)을 `auth` API + store에 연동

이 구조를 유지하면 **데이터/API 변경은 주로 `shared/api`, `features/*/api`, `entities`** 에만 집중하면 됩니다.
