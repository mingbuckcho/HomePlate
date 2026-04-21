/**
 * RUM config: window.__RUM_* (서버가 런타임 env로 주입) 우선, 없으면 fallback.
 * NEXT_PUBLIC_ 제거 → 쿠버네티스 Secret 변경만으로 재배포 가능.
 */
declare global {
  interface Window {
    /** boolean true 또는 문자열 "true" (주입 시 JSON.stringify 사용) */
    __RUM_ENABLED__?: boolean | string;
    __RUM_ENDPOINT__?: string;
    __RUM_APP_NAME__?: string;
    __RUM_ENV__?: string;
    __RUM_CLUSTER__?: string;
    __RUM_SAMPLE_RATE__?: number;
    /** OTLP 메트릭 전송 URL (설정 시에만 메트릭 전송). 예: https://example.com/v1/metrics */
    __RUM_OTLP_METRICS_ENDPOINT__?: string;
  }
}

function getRumString(value: string | undefined, fallback: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  return fallback;
}

function getRumNumber(value: number | undefined, fallback: number): number {
  const n =
    typeof value === "number" && !Number.isNaN(value) ? value : fallback;
  return Math.min(1, Math.max(0, n));
}

export const RUM_CONFIG = {
  get enabled(): boolean {
    if (typeof window === "undefined") return false;
    const v = window.__RUM_ENABLED__;
    return v === true || v === "true";
  },
  get appName(): string {
    if (typeof window === "undefined") return "homeplate-web";
    return getRumString(window.__RUM_APP_NAME__, "homeplate-web");
  },
  get env(): string {
    if (typeof window === "undefined") return "prod";
    return getRumString(window.__RUM_ENV__, "prod");
  },
  get cluster(): string {
    if (typeof window === "undefined") return "hp-onprem";
    return getRumString(window.__RUM_CLUSTER__, "hp-onprem");
  },
  get endpointUrl(): string {
    if (typeof window === "undefined") return "https://homeplate.site/collect";
    return getRumString(
      window.__RUM_ENDPOINT__,
      "https://homeplate.site/collect",
    );
  },
  get sampleRate(): number {
    if (typeof window === "undefined") return 1;
    return getRumNumber(window.__RUM_SAMPLE_RATE__, 1);
  },
  /** OTLP 메트릭 전송 endpoint. 비어 있으면 메트릭 전송 비활성화 */
  get otlpMetricsEndpoint(): string {
    if (typeof window === "undefined") return "";
    return getRumString(window.__RUM_OTLP_METRICS_ENDPOINT__, "");
  },
  allowedOrigins: [
    "http://localhost:8080",
    "https://homeplate.site",
    "https://api.homeplate.site",
  ] as const,
} as const;
