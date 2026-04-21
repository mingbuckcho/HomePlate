# HomePlate Frontend Observability Policy (Final)

## 0) 목적

- RUM(프론트) 이벤트/에러/성능을 수집해 장애/성능 문제를 재현 없이 추적한다.
- PII 원문 0, 토큰/쿠키 0, 카디널리티 폭발 0
- 온프레 → EKS 전환 시 수집 URL 변경만으로 동작하도록 한다.

## 1) 고정 규칙(변경 금지)

- service.name = homeplate-web
- deployment.environment = prod
- k8s.cluster.name = hp-onprem
- RUM_INGEST_URL = https://rum.homeplate.site/collect
- route는 “템플릿(route template)”만 전송 (예: /tickets/[gameId]) — query 포함 URL 금지

## 2) PII/보안 정책

### 2.1 절대 전송 금지(원문)

- email/phone/name/address
- Authorization/AccessToken/RefreshToken/Cookie/Session 값
- 주문/좌석/결제 식별자 원문
- URL 전체(쿼리 포함), 폼 입력값, 응답 body 원문

### 2.2 사용자 식별

- 기본: anon_session_id(UUID v4)만 사용
- 로그인 시: 백엔드가 내려준 enduser.id_hash만 사용 (프론트에서 userId 해시 금지)

## 3) 카디널리티 제한(강제)

- 이벤트 이름: 최대 30개 (사전 등록된 목록만)
- 이벤트 속성 키: 이벤트당 최대 12개
- 문자열 값: enum/짧은 값만 (200자 이상 금지)
- 금지: 동적 ID/전체 URL/에러 메시지 전문/stacktrace 전문을 attribute로 전송

## 4) 이벤트 표준(고정)

### 4.1 비즈니스 이벤트

- seat_select
  - route, seat_count, result(success|fail), error_code?(fail)
- payment_start
  - route, pay_method(enum), amount_bucket(enum), result
- payment_result
  - route, result, error_code?(fail), latency_ms_bucket(enum)
- api_error
  - api_name(enum), http.status_code, error_code

### 4.2 성능/에러

- webvitals(LCP/INP/CLS) 자동 수집(가능하면)
- unhandled error / promise rejection 수집(단, 메시지 sanitize)

## 5) 구현 규칙

- beforeSend 단계에서 payload를 sanitize(PII 제거, 긴 문자열 제거/절단)
- route는 template로 정규화
- anon_session_id는 localStorage에 저장

## 6) 검증

- 브라우저 DevTools > Network
  - POST https://rum.homeplate.site/collect 가 200/204 응답
  - Request Payload에 PII/토큰/쿠키/전체 URL/stacktrace 전문이 없는지 확인
