# Auth.js (Keycloak) 적용 요약

## 수정·추가된 파일

- `package.json` — `next-auth@beta` 추가
- `src/auth.ts` — Keycloak provider, JWT session, authorized 콜백
- `src/app/api/auth/[...nextauth]/route.ts` — GET/POST 핸들러
- `src/middleware.ts` — 페이지 보호, `/api`·정적·favicon 제외
- `src/components/AuthProvider.tsx` — SessionProvider 래퍼
- `src/components/AppHeader.tsx` — 로그인/로그아웃·사용자 표시
- `src/app/layout.tsx` — AuthProvider 적용
- `.env.example` — env 예시

## .env 예시

`.env.example` 참고. 최소 설정:

- `AUTH_SECRET` — `npx auth secret` 또는 32자 이상 랜덤
- `AUTH_TRUST_HOST=true` — 운영(리버스 프록시)에서 권장
- `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`
- `NEXTAUTH_URL` — 로컬: `http://localhost:3000`, 운영: `https://aiops.homeplate.site`

## 검증

- **로컬**: `.env.local`에 Keycloak·NEXTAUTH_URL 설정 후 `npm run dev` → 미로그인 시 로그인 페이지로 리다이렉트 → Keycloak 로그인 후 홈 접근 가능. 헤더에 사용자·로그아웃 표시 확인.
- **운영**: `https://aiops.homeplate.site` 접속 시 동일하게 Keycloak 로그인 유도. 로그인 후 `/api` 호출은 기존과 동일(같은 오리진).
