"use client";

/**
 * RUM OTLP 메트릭 전송 (추가만, 기존 로그/트레이스 변경 없음).
 * - Pageviews counter, UI errors counter, Web Vitals (FCP, TTFB) 전송.
 * - 라벨: app_name, app_environment, app_version, page_url, browser_name, browser_os (session_id 없음).
 */
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { RUM_CONFIG } from "./config";

const APP_VERSION = "1.0.0";

let meterProvider: MeterProvider | null = null;
let pageviewCounter: {
  add: (n: number, attrs?: Record<string, string>) => void;
} | null = null;
let uiErrorCounter: {
  add: (n: number, attrs?: Record<string, string>) => void;
} | null = null;
let fcpHistogram: {
  record: (v: number, attrs?: Record<string, string>) => void;
} | null = null;
let ttfbHistogram: {
  record: (v: number, attrs?: Record<string, string>) => void;
} | null = null;

function getBrowserInfo(): { browser_name: string; browser_os: string } {
  if (typeof navigator === "undefined")
    return { browser_name: "unknown", browser_os: "unknown" };
  const ua = navigator.userAgent;
  const uaData = (
    navigator as Navigator & {
      userAgentData?: {
        brands?: { brand: string }[];
        getHighEntropyValues?: (h: string[]) => Promise<{ platform?: string }>;
      };
    }
  ).userAgentData;
  let browser_name = "unknown";
  let browser_os =
    (navigator as Navigator & { platform?: string }).platform || "unknown";
  if (uaData?.brands?.length) {
    browser_name = uaData.brands.map((b) => b.brand).join(" ");
  } else if (ua.includes("Chrome")) browser_name = "Chrome";
  else if (ua.includes("Firefox")) browser_name = "Firefox";
  else if (ua.includes("Safari")) browser_name = "Safari";
  else if (ua.includes("Edg")) browser_name = "Edge";
  if (uaData?.getHighEntropyValues) {
    uaData
      .getHighEntropyValues(["platform"])
      .then((v) => {
        if (v.platform) browser_os = v.platform;
      })
      .catch(() => {});
  }
  return { browser_name, browser_os };
}

declare global {
  interface Window {
    __RUM_METRICS_INCREMENT_ERROR__?: () => void;
  }
}

function getDefaultAttributes(): Record<string, string> {
  const { browser_name, browser_os } = getBrowserInfo();
  return {
    app_name: RUM_CONFIG.appName,
    app_environment: RUM_CONFIG.env,
    app_version: APP_VERSION,
    browser_name,
    browser_os,
  };
}

/**
 * OTLP 메트릭 전송 초기화 (RUM_ENABLED + RUM_OTLP_METRICS_ENDPOINT 설정 시에만).
 * 기존 Faro 초기화보다 먼저 호출해야 beforeSend에서 ui.error 시 increment 가능.
 */
export function initRumMetrics(): void {
  if (typeof window === "undefined") return;
  if (!RUM_CONFIG.enabled) return;
  const endpoint = RUM_CONFIG.otlpMetricsEndpoint?.trim();
  if (!endpoint) return;

  try {
    const url = endpoint.endsWith("/v1/metrics")
      ? endpoint
      : endpoint.replace(/\/?$/, "") + "/v1/metrics";
    const exporter = new OTLPMetricExporter({
      url,
      // headers: 인증 필요 시 K8s Secret에서 주입한 값을 여기 연결 가능
    });

    const resource = resourceFromAttributes({
      "service.name": RUM_CONFIG.appName,
      "deployment.environment": RUM_CONFIG.env,
      "service.version": APP_VERSION,
    });

    const reader = new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 10_000,
      exportTimeoutMillis: 5_000,
    });

    meterProvider = new MeterProvider({
      resource,
      readers: [reader],
    });

    const meter = meterProvider.getMeter("homeplate-rum", APP_VERSION);
    const base = getDefaultAttributes();

    pageviewCounter = meter.createCounter("rum_pageviews_total", {
      description: "Page view count",
    });
    uiErrorCounter = meter.createCounter("rum_ui_errors_total", {
      description: "UI error count (ui.error events)",
    });
    fcpHistogram = meter.createHistogram("rum_web_vitals_fcp_ms", {
      description: "First Contentful Paint (ms)",
      unit: "ms",
    });
    ttfbHistogram = meter.createHistogram("rum_web_vitals_ttfb_ms", {
      description: "Time to First Byte (ms)",
      unit: "ms",
    });

    window.__RUM_METRICS_INCREMENT_ERROR__ = () => {
      if (!uiErrorCounter) return;
      const path =
        typeof window !== "undefined" && window.location?.pathname
          ? window.location.pathname
          : "/";
      uiErrorCounter.add(1, { ...base, page_url: path });
    };

    // Web Vitals: FCP, TTFB (web-vitals v5: onFCP, onTTFB)
    import("web-vitals")
      .then(({ onFCP, onTTFB }) => {
        const path =
          typeof window !== "undefined" && window.location?.pathname
            ? window.location.pathname
            : "/";
        const attrs = { ...base, page_url: path };
        onFCP((m) => {
          fcpHistogram?.record(m.value, attrs);
        });
        onTTFB((m) => {
          ttfbHistogram?.record(m.value, attrs);
        });
      })
      .catch(() => {});
  } catch {
    // 메트릭 초기화 실패 시 앱 동작에 영향 없음
  }
}

/** 페이지뷰 1회 기록 (page_url 등 라벨 포함, session_id 제외) */
export function incrementPageview(pageUrl: string): void {
  if (!pageviewCounter) return;
  const path =
    pageUrl ||
    (typeof window !== "undefined" ? (window.location?.pathname ?? "/") : "/");
  pageviewCounter.add(1, { ...getDefaultAttributes(), page_url: path });
}
