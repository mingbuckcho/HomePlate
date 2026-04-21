# RUM (Grafana Faro) 연동

## 구성

| 파일          | 역할                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `config.ts`   | enabled, appName, env, endpointUrl, sampleRate, allowedOrigins (env / `window.__RUM_*` 우선)      |
| `session.ts`  | localStorage 익명 UUID (`enduser.session_id`)                                                     |
| `events.ts`   | 이벤트·속성 allowlist                                                                             |
| `errors.ts`   | 에러 정규화 (message 120자, PII 마스킹, stack_hash만)                                             |
| `sanitize.ts` | allowlist·PII·pathname·길이 제한                                                                  |
| `route.ts`    | usePathname → `ui.page_view`                                                                      |
| `client.ts`   | initRum, rumEvent, TracingInstrumentation (trace header 전파)                                     |
| `metrics.ts`  | OTLP 메트릭 전송 (Pageviews, UI errors, FCP/TTFB). `RUM_OTLP_METRICS_ENDPOINT` 설정 시에만 활성화 |

- **Tracing**: API 요청 대상 URL이 `propagateTraceHeaderCorsUrls` 패턴과 일치할 때만 traceparent/tracestate 전파. fetch/XHR 모두 적용. 패턴: localhost:8080, homeplate.site, api.homeplate.site, 및 런타임 `window.__API_BASE_URL__`.
- 실패 시 앱 동작에는 영향 없음.

## env (런타임, 서버 전용)

- `RUM_ENABLED` (true/false)
- `RUM_ENDPOINT` (기본: https://homeplate.site/collect)
- `RUM_APP_NAME`, `RUM_ENV`, `RUM_CLUSTER`, `RUM_SAMPLE_RATE`
- `RUM_OTLP_METRICS_ENDPOINT` (선택) — 설정 시에만 OTLP 메트릭 전송. 예: `https://<collector>/v1/metrics`

수집 서버 CORS 허용 필요.

## OTLP 메트릭 (추가 전송)

기존 로그/트레이스와 별도로, **메트릭만** OTLP HTTP로 전송합니다. `RUM_OTLP_METRICS_ENDPOINT`가 비어 있으면 메트릭 전송 비활성화.

**공유용 — OTLP exporter 설정 블록 (endpoint 포함, URL/토큰 마스킹 가능):**

```ts
// src/lib/rum/metrics.ts 내 초기화 일부
const url = endpoint.endsWith("/v1/metrics")
  ? endpoint
  : endpoint.replace(/\/?$/, "") + "/v1/metrics";
const exporter = new OTLPMetricExporter({
  url,
  // headers: 인증 필요 시 K8s Secret에서 주입한 값을 여기 연결 가능
});
const reader = new PeriodicExportingMetricReader({
  exporter,
  exportIntervalMillis: 10_000,
  exportTimeoutMillis: 5_000,
});
meterProvider = new MeterProvider({ resource, readers: [reader] });
```

**메트릭 키:** `rum_pageviews_total`, `rum_ui_errors_total`, `rum_web_vitals_fcp_ms`, `rum_web_vitals_ttfb_ms`.  
**라벨:** app_name, app_environment, app_version, page_url, browser_name, browser_os (session_id는 미포함).

## Trace header (traceparent) 검증

1. **RUM_ENABLED=true** 인지 확인 (false면 전파 안 함).
2. DevTools → **Network** → API 요청 선택 → **Request Headers**에 `traceparent` 있는지 확인.
3. **서버에 안 보일 때**: 백엔드 CORS `Access-Control-Allow-Headers`에 **traceparent**, **tracestate**, **baggage** 포함 필수. 없으면 preflight 후 실제 요청에서 헤더가 빠질 수 있음.
