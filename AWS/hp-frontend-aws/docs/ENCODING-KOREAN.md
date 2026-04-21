# 한글 깨짐 (홈·경기상세·지도 탭)

홈, 경기상세, 지도 탭에서 팀명·구장명이 깨져 보이면(**ìž ì‹¤ì•¼** 등) **API 응답 인코딩** 문제일 수 있습니다.

## 원인

- 프론트는 UTF-8로 해석하는데, 응답이 다른 인코딩으로 내려오거나 `Content-Type`에 `charset`이 없어 브라우저가 잘못 해석하는 경우입니다.

## 조치 (백엔드)

1. **HTTP 응답에 charset 명시**  
   JSON 응답 시 `Content-Type: application/json; charset=utf-8` 로 보내주세요.  
   (Spring Boot에서는 `spring.servlet.encoding.charset=UTF-8` 설정이 있어도, JSON 메시지 컨버터에서 charset을 붙여주는지 확인이 필요합니다.)

2. **DB/연결 인코딩**
   - MySQL: `characterEncoding=UTF-8` (이미 url에 있으면 유지)
   - DB/테이블 컬럼도 utf8mb4 권장

## 프론트에서 한 것

- `layout.tsx`에 `<meta charSet="utf-8" />` 추가해 HTML 문서는 UTF-8로 해석되도록 했습니다.
- API로 받은 한글은 **백엔드에서 UTF-8로 보내는 것**이 필요합니다.
