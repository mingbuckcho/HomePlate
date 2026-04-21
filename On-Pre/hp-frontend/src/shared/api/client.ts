/**
 * 백엔드 API 베이스 URL 및 인증 토큰 getter.
 * - API_BASE_URL: 런타임에 서버가 window.__API_BASE_URL__ 로 주입 (쿠버네티스 Secret 등).
 * - getAccessToken: 앱 초기화 시 setAccessTokenGetter(() => useAuthStore.getState().accessToken) 로 주입.
 */

declare global {
  interface Window {
    __API_BASE_URL__?: string;
  }
}

let _getAccessToken: () => string | null = () => null;

const API_BASE_FALLBACK = "https://homeplate.site/api";

export function getApiBase(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const url = window.__API_BASE_URL__ ?? API_BASE_FALLBACK;
  return url || undefined;
}

export function getAccessToken(): string | null {
  return _getAccessToken();
}

export function setAccessTokenGetter(fn: () => string | null): void {
  _getAccessToken = fn;
}
