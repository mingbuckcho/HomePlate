"use client";

/**
 * Faro RUM client: init once in browser, rumEvent() for allowlisted events only. Failures never throw.
 * Trace headers (traceparent etc.) are propagated to API requests when URL matches propagateTraceHeaderCorsUrls.
 */
import { getWebInstrumentations, initializeFaro } from "@grafana/faro-web-sdk";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";
import { getApiBase } from "@/shared/api/client";
import { RUM_CONFIG } from "./config";
import { getOrCreateSessionId } from "./session";

/**
 * URL patterns for traceparent/tracestate propagation (Fetch/XHR).
 * 요청 URL이 이 패턴 중 하나와 매칭될 때만 헤더가 붙음.
 * - init 시점에 window.__API_BASE_URL__ 미설정 시를 대비해 프로덕션 도메인 fallback 포함.
 * - 백엔드 CORS: Access-Control-Allow-Headers 에 traceparent, tracestate, baggage 포함 필요.
 */
function getTracePropagationUrlPatterns(): (string | RegExp)[] {
  const patterns: (string | RegExp)[] = [
    /^http:\/\/localhost:8080/,
    /^https:\/\/homeplate\.site(\/|$)/,
    /^https:\/\/api\.homeplate\.site(\/|$)/,
  ];
  const apiBase = getApiBase() ?? "";
  const base = apiBase.trim().replace(/\/+$/, "");
  if (base) {
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    patterns.push(new RegExp(`^${escaped}`));
  }
  return patterns;
}
import { isAllowedEventName } from "./events";
import { normalizeError } from "./errors";
import { sanitizeAttributes } from "./sanitize";
import type { RumEventName } from "./events";
import type {
  TransportItem,
  EventEvent,
  ExceptionEvent,
  MeasurementEvent,
} from "@grafana/faro-web-sdk";

let initialized = false;

function attrsToRecord(
  attrs: Record<string, string | number | boolean>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    out[k] = typeof v === "string" ? v : String(v);
  }
  return out;
}

function buildBeforeSend() {
  return (item: TransportItem): TransportItem | null => {
    try {
      const { type, payload, meta } = item;
      // Drop logs
      if (type === "log") return null;

      // Events: only allowlisted names
      if (type === "event") {
        const ev = payload as EventEvent;
        if (!ev?.name || !isAllowedEventName(ev.name)) return null;
        const safeAttrs = sanitizeAttributes(
          (ev.attributes as Record<string, unknown>) ?? {},
        );
        return {
          ...item,
          payload: {
            ...ev,
            attributes: attrsToRecord(safeAttrs),
          },
          meta: sanitizeMeta(meta as Record<string, unknown>),
        } as TransportItem;
      }

      // Exceptions → convert to ui.error event (allowlist/sanitize safe, no raw stack)
      if (type === "exception") {
        const ex = payload as ExceptionEvent & { originalError?: Error };
        const err = ex?.originalError ?? new Error(ex?.value ?? "Unknown");
        const { message, type: errorType, stack_hash } = normalizeError(err);
        const pathname =
          meta?.page &&
          typeof meta.page === "object" &&
          "url" in meta.page &&
          typeof (meta.page as { url?: string }).url === "string"
            ? (() => {
                try {
                  return (
                    new URL(
                      (meta.page as { url: string }).url,
                      "http://localhost",
                    ).pathname || "/"
                  );
                } catch {
                  return "/";
                }
              })()
            : "/";
        const sessionId = getOrCreateSessionId();
        const attrs: Record<string, string> = {
          "error.type": errorType,
          "error.message": message,
          "page.path": pathname,
          "enduser.session_id": sessionId,
        };
        if (stack_hash) attrs["error.stack_hash"] = stack_hash;
        const eventPayload: EventEvent = {
          name: "ui.error",
          timestamp:
            (ex as { timestamp?: string }).timestamp ??
            new Date().toISOString(),
          attributes: attrs,
        };
        window.__RUM_METRICS_INCREMENT_ERROR__?.();
        return {
          type: "event",
          payload: eventPayload,
          meta: sanitizeMeta(meta as Record<string, unknown>),
        } as TransportItem;
      }

      // Measurements (web vitals): keep, sanitize context
      if (type === "measurement") {
        const m = payload as MeasurementEvent;
        const context = sanitizeAttributes(m?.context ?? {});
        return {
          ...item,
          payload: { ...m, context: attrsToRecord(context) },
          meta: sanitizeMeta(meta as Record<string, unknown>),
        } as TransportItem;
      }

      // Trace: keep for OTEL
      if (type === "trace")
        return {
          ...item,
          meta: sanitizeMeta(meta as Record<string, unknown>),
        } as TransportItem;
      return item;
    } catch {
      return null;
    }
  };
}

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return meta;
  const out = { ...meta };
  if (out.page && typeof out.page === "object" && out.page !== null) {
    const p = out.page as Record<string, unknown>;
    if (typeof p.url === "string") {
      try {
        const u = new URL(p.url, "http://localhost");
        (out.page as Record<string, unknown>).url = u.pathname || "/";
      } catch {
        (out.page as Record<string, unknown>).url = "/";
      }
    }
  }
  return out;
}

export function initRum(): void {
  if (typeof window === "undefined") return;
  if (!RUM_CONFIG.enabled) return;
  if (initialized) return;
  try {
    const sessionId = getOrCreateSessionId();
    const instrumentations = [
      ...getWebInstrumentations({ captureConsole: false }),
      new TracingInstrumentation({
        instrumentationOptions: {
          propagateTraceHeaderCorsUrls: getTracePropagationUrlPatterns(),
        },
      }),
    ];

    const faro = initializeFaro({
      url: RUM_CONFIG.endpointUrl,
      app: {
        name: RUM_CONFIG.appName,
        version: "1.0.0",
        environment: RUM_CONFIG.env,
      },
      instrumentations,
      sessionTracking: {
        enabled: true,
        persistent: true,
        generateSessionId: () => sessionId,
        session: {
          id: sessionId,
          attributes: {
            "enduser.session_id": sessionId,
            "deployment.environment": RUM_CONFIG.env,
            "k8s.cluster.name": RUM_CONFIG.cluster,
          },
        },
      },
      beforeSend: buildBeforeSend(),
      ignoreUrls: [/.*\/collect.*/],
      preserveOriginalError: true,
    });
    faroApi = faro?.api ?? null;
    initialized = true;
  } catch {
    // RUM init failure must not affect app
  }
}

let faroApi: {
  pushEvent: (name: string, attributes?: Record<string, string>) => void;
} | null = null;

export function rumEvent(
  name: RumEventName,
  attrs?: Record<string, unknown>,
): void {
  try {
    if (!RUM_CONFIG.enabled || typeof window === "undefined") return;
    if (!isAllowedEventName(name)) return;
    if (!faroApi) return;
    const safe = sanitizeAttributes(attrs ?? {});
    faroApi.pushEvent(name, attrsToRecord(safe));
  } catch {
    // never throw
  }
}
