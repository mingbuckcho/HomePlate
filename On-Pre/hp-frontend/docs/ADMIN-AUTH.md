# 관리자 API 인증 (POST /admin 403 해결)

## 백엔드 요구 사항

- **`/admin/**`** 는 **ROLE_ADMIN** 필요 (`SecurityConfig`: `.requestMatchers("/admin/\*\*").hasRole("ADMIN")`).
- 인증 방식: **JWT**. 요청 헤더에 `Authorization: Bearer <accessToken>` 이 있어야 함.
- 토큰은 **로그인 응답 Body** 에서 받음 (Refresh Token만 쿠키로 설정됨).

## 로그인 응답 (백엔드)

- **POST /auth/login** 응답 Body (`LoginResponse`):
  - `accessToken`: string (이걸 저장해서 API 요청 시 헤더에 붙임)
  - `userName`: string
  - `refreshToken`: Body에는 없음 (쿠키로만 전달)

## 관리자 계정 (백엔드 AdminInitializer)

- 백엔드 기동 시 없으면 자동 생성됨.
- **이메일**: `admin`
- **비밀번호**: `1234`
- **역할**: ROLE_ADMIN

## 프론트엔드 동작

1. **로그인** (`/auth/login`): 응답의 `accessToken`을 auth store에 저장.
2. **layout** 에서 `setAccessTokenGetter(() => useAuthStore.getState().accessToken)` 로 주입.
3. **http** (axios) 요청 인터셉터에서 `getAccessToken()` 이 있으면 `Authorization: Bearer <token>` 추가.
4. **관리자 페이지** 에서 경기 생성/수정 시 토큰이 없으면 "관리자(admin / 1234)로 로그인하세요" 안내.

## 403이 나는 경우

- **Authorization 헤더가 없음** → 로그인을 안 했거나, 세션(저장된 accessToken)이 없는 상태. **admin / 1234** 로 로그인 후 다시 시도.
- **Authorization은 있는데 403** → 해당 토큰이 일반 사용자(ROLE_USER)일 수 있음. **admin** 계정으로 로그인해야 함.
