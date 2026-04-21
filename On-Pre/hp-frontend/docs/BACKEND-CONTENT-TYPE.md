# 백엔드 응답 Content-Type 확인 결과

## 확인한 내용

### 1. 컨트롤러 (ResponseEntity)

- **AuthController, InfoController, BookController, AdminController, MypgController, QueueController** 모두 `ResponseEntity.ok(body)` 형태로만 반환.
- **별도 Content-Type/MediaType 지정 없음** → Spring Boot 기본 **MappingJackson2HttpMessageConverter**가 JSON 직렬화.
- Spring 기본 동작: `Content-Type: application/json` 까지만 설정하고, **charset은 버전/설정에 따라 안 붙을 수 있음** (한글 깨짐 원인 가능).

### 2. QueueInterceptor (에러 응답)

- `sendErrorResponse()` 에서 직접 설정:
  - `response.setContentType("application/json");`
  - `response.setCharacterEncoding("UTF-8");`
- `setCharacterEncoding("UTF-8")` 덕분에 이 경로는 **application/json; charset=UTF-8** 로 나갈 가능성 높음.

### 3. application.yml

- `spring.servlet.encoding.charset: UTF-8` → **요청** 인코딩용. 응답 Content-Type 헤더와는 별개.

## 결론

- **일반 API (경기 목록, 로그인, 좌석 조회 등)** 는 **Content-Type에 charset=UTF-8이 없을 수 있음**.
- 브라우저가 charset 없이 `application/json` 만 보면 기본 인코딩으로 해석해 한글이 깨질 수 있음.

## 조치 (백엔드 수정 없음)

- 백엔드는 수정하지 않음. Content-Type 확인/변경이 필요하면 **백엔드 담당**에서 처리.
- JSON 응답에 charset을 붙이려면 WebMvcConfig에서 `extendMessageConverters` 로 MappingJackson2HttpMessageConverter에 `setDefaultCharset(StandardCharsets.UTF_8)` 설정하거나, Spring Boot/application 설정으로 처리하면 됨.

실제 응답 헤더 확인: 브라우저 개발자 도구 → Network → 해당 API → Response Headers 의 **Content-Type** 확인.
