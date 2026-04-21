import type {
  CaseDetailResponse,
  CaseListItem,
  WeeklyReportAIResponse,
} from "./types";

function getApiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  return "/api";
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBase();
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<{ status: string }> {
  return fetchApi<{ status: string }>("/health");
}

export interface ListCasesParams {
  status?: string;
  severity?: string;
  layer?: string;
  namespace?: string;
  service?: string;
  time_from?: string;
  time_to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getCases(params?: ListCasesParams): Promise<{
  items: CaseListItem[];
}> {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") sp.set(k, String(v));
    });
  }
  const qs = sp.toString();
  return fetchApi<{ items: CaseListItem[] }>(`/cases${qs ? `?${qs}` : ""}`);
}

export async function getCaseDetail(
  id: number,
  alert_events_limit?: number,
): Promise<CaseDetailResponse> {
  const sp = new URLSearchParams();
  if (alert_events_limit != null)
    sp.set("alert_events_limit", String(alert_events_limit));
  const qs = sp.toString();
  return fetchApi<CaseDetailResponse>(`/cases/${id}${qs ? `?${qs}` : ""}`);
}

export async function refreshCase(id: number): Promise<{
  ok: boolean;
  snapshot_id: number;
  window_from: string;
  window_to: string;
  expires_at: string;
}> {
  return fetchApi(`/cases/${id}/refresh`, { method: "POST" });
}

export async function createAiSummary(snapshotId: number): Promise<{
  snapshot_id: number;
  ai_summary_id: number;
  summary: string;
  evidence: unknown;
  checks: unknown;
  advice: unknown;
}> {
  return fetchApi(`/snapshots/${snapshotId}/ai-summary`, { method: "POST" });
}

// ----- Summary (1단계) -----

export interface SummaryHomeResponse {
  total_open: number;
  by_layer: { layer: string; count: number }[];
  by_severity: { severity: string; count: number }[];
  top_services: { namespace: string; service: string; count: number }[];
  recently_updated: { id: number; case_key: string; last_seen_at: string }[];
}

export interface SummaryLayerResponse {
  layer: string;
  total_open: number;
  by_severity: { severity: string; count: number }[];
  top_services: { namespace: string; service: string; count: number }[];
  recently_updated: { id: number; case_key: string; last_seen_at: string }[];
}

export async function getSummaryHome(
  status: string = "open",
): Promise<SummaryHomeResponse> {
  return fetchApi<SummaryHomeResponse>(
    `/summary/home?status=${encodeURIComponent(status)}`,
  );
}

export async function getSummaryLayer(
  layer: string,
  status: string = "open",
): Promise<SummaryLayerResponse> {
  return fetchApi<SummaryLayerResponse>(
    `/summary/layer/${encodeURIComponent(layer)}?status=${encodeURIComponent(status)}`,
  );
}

export async function postSummaryHomeAi(): Promise<{ summary: string }> {
  return fetchApi<{ summary: string }>("/summary/home/ai", { method: "POST" });
}

/** Snapshot 기반 Home AI 요약. snapshot 없으면 404 → fallback으로 postSummaryHomeAi 사용 */
export async function postSummaryHomeSnapshotLatestAi(): Promise<{
  summary: string;
}> {
  return fetchApi<{ summary: string }>("/summary/home/snapshot/latest/ai", {
    method: "POST",
  });
}

export async function postSummaryLayerAi(
  layer: string,
): Promise<{ summary: string }> {
  return fetchApi<{ summary: string }>(
    `/summary/layer/${encodeURIComponent(layer)}/ai`,
    { method: "POST" },
  );
}

// ----- Home Snapshot -----

export interface HomeSnapshot {
  id: number;
  created_at: string;
  window_from: string;
  window_to: string;
  expires_at: string;
  prom_status: string;
  prom_error: string | null;
  prom: {
    stats?: { name: string; value: number }[];
    series?: unknown[];
  } | null;
  loki_status: string;
  loki_error: string | null;
  loki: { health?: string } | null;
  tempo_status: string;
  tempo_error: string | null;
  tempo: { health?: string } | null;
}

export async function postHomeSnapshot(): Promise<HomeSnapshot> {
  return fetchApi<HomeSnapshot>("/summary/home/snapshot", { method: "POST" });
}

export async function getHomeSnapshotLatest(): Promise<HomeSnapshot | null> {
  return fetchApi<HomeSnapshot | null>("/summary/home/snapshot/latest");
}

// ----- Home Layer Snapshots -----

export interface HomeLayerSnapshot {
  id: number;
  created_at: string;
  layer: string;
  window_from: string;
  window_to: string;
  expires_at: string;
  prom_status: string;
  prom_error: string | null;
  prom: {
    stats?: { name: string; value: number }[];
    series?: { metric?: Record<string, string>; values?: [number, string][] }[];
  } | null;
  loki_status: string;
  loki_error: string | null;
  loki: Record<string, unknown> | null;
  tempo_status: string;
  tempo_error: string | null;
  tempo: Record<string, unknown> | null;
}

export async function postHomeLayersSnapshot(): Promise<{
  snapshots: HomeLayerSnapshot[];
}> {
  return fetchApi<{ snapshots: HomeLayerSnapshot[] }>(
    "/summary/home/layers/snapshot",
    { method: "POST" },
  );
}

export async function getHomeLayersSnapshotLatest(): Promise<{
  snapshots: HomeLayerSnapshot[];
}> {
  return fetchApi<{ snapshots: HomeLayerSnapshot[] }>(
    "/summary/home/layers/snapshot/latest",
  );
}

/** 6줄 요약. layer snapshot 없으면 400 → 버튼 비활성화 */
export async function postSummaryHomeLayersAi(): Promise<{ summary: string }> {
  return fetchApi<{ summary: string }>("/summary/home/layers/ai", {
    method: "POST",
  });
}

// ----- Weekly report (Phase1) -----

export interface WeeklyReportResponse {
  period: {
    start: string;
    end: string;
    days: number;
  };
  totals: {
    total_cases: number;
    resolved_cases: number;
    resolution_rate: number;
  };
  trend_daily: { date: string; opened: number; resolved: number }[];
  by_layer: { layer: string; count: number }[];
  by_severity: { severity: string; count: number }[];
  top_services: { namespace: string; service: string; count: number }[];
  top_alertnames: { alertname: string; count: number }[];
  latest_cases: {
    case_id: number;
    case_key: string;
    namespace: string;
    service: string;
    layer: string;
    severity: string;
    status: string;
    last_seen_at: string;
  }[];
  ai_highlights_seed: {
    snapshot_id: number;
    case_key: string;
    summary_preview: string;
    created_at: string; // UTC ISO8601
  }[];
}

export async function getWeeklyReport(params?: {
  end?: string;
  days?: number;
}): Promise<WeeklyReportResponse> {
  const sp = new URLSearchParams();
  if (params?.end) sp.set("end", params.end);
  if (params?.days != null) sp.set("days", String(params.days));
  const qs = sp.toString();
  return fetchApi<WeeklyReportResponse>(
    `/reports/weekly${qs ? `?${qs}` : ""}`,
    { cache: "no-store" as RequestCache },
  );
}

export async function postWeeklyReportAI(params?: {
  days?: number;
  end?: string;
}): Promise<WeeklyReportAIResponse> {
  return fetchApi<WeeklyReportAIResponse>("/reports/weekly/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      days: params?.days ?? 7,
      ...(params?.end ? { end: params.end } : {}),
    }),
  });
}
