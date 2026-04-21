import axios, { AxiosError, AxiosInstance } from "axios";
import { getAccessToken, getApiBase } from "./client";
import { useAuthStore } from "@/features/auth/store";

/**
 * 백엔드 연동: NEXT_PUBLIC_API_BASE_URL 이 설정되면 해당 서버로 요청.
 * getAccessToken() 은 client.setAccessTokenGetter 로 앱에서 주입 (auth store 연동).
 * 응답을 항상 UTF-8로 해석 (한글 깨짐 방지, Content-Type charset 무관).
 * 401 시 1회 /auth/refresh 로 AccessToken 갱신 후 재시도, 실패 시 로그아웃.
 */
export const http: AxiosInstance = axios.create({
  baseURL: "", // 클라이언트에서 요청 시 인터셉터에서 설정 (SSR 시 getApiBase()가 undefined)
  withCredentials: true,
  responseType: "arraybuffer",
  transformResponse: [
    (data: unknown, headers?: unknown) => {
      if (!(data instanceof ArrayBuffer) || data.byteLength === 0) return data;
      const utf8 = new TextDecoder("utf-8").decode(data);
      const h = headers as
        | { get?(name: string): string }
        | Record<string, string>
        | undefined;
      const ct =
        (typeof h?.get === "function"
          ? h.get("content-type")
          : h &&
              typeof h === "object" &&
              ("content-type" in h || "Content-Type" in h)
            ? ((h as Record<string, string>)["content-type"] ??
              (h as Record<string, string>)["Content-Type"])
            : "") ?? "";
      if (ct.includes("application/json")) {
        try {
          return JSON.parse(utf8);
        } catch {
          return utf8;
        }
      }
      return utf8;
    },
  ],
});

/** 401 시 한 번만 refresh 시도, 동시 401은 이 promise 대기 후 재시도 */
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const base = getApiBase();
  if (!base || typeof window === "undefined") return null;
  refreshPromise = (async () => {
    try {
      const res = await axios.post<string>(
        `${base.replace(/\/$/, "")}/auth/refresh`,
        {},
        { withCredentials: true, timeout: 10000 },
      );
      const token =
        typeof res.data === "string"
          ? res.data
          : ((res.data as { accessToken?: string })?.accessToken ?? null);
      if (token) useAuthStore.getState().setAccessToken(token);
      return token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// Request interceptor: baseURL(클라이언트에서만 설정), 토큰 추가(공개 API 제외)
http.interceptors.request.use((config) => {
  const base = getApiBase();
  if (base) config.baseURL = base;
  const path = config.url ?? "";
  const isPublicInfo = path.startsWith("/info");
  const token = getAccessToken();
  if (token && !isPublicInfo) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: 401 시 1회 refresh 시도 → 성공 시 재요청, 실패 시 로그아웃
http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const config = error.config;
    const isRefreshRequest = config?.url?.includes("/auth/refresh") ?? false;

    if (typeof window === "undefined" || status !== 401) {
      return Promise.reject(error);
    }

    if (isRefreshRequest) {
      useAuthStore.getState().logout();
      window.location.href = "/auth/login?expired=1";
      return Promise.reject(error);
    }

    const newToken = await tryRefreshAccessToken();
    if (newToken && config && !(config as { _retry?: boolean })._retry) {
      (config as { _retry?: boolean })._retry = true;
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${newToken}`;
      return http.request(config);
    }

    useAuthStore.getState().logout();
    window.location.href = "/auth/login?expired=1";
    return Promise.reject(error);
  },
);
