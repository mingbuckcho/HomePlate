/** API response types aligned with ops-portal (snake_case). */

export interface CaseBrief {
  id: number;
  case_key: string;
  status: string;
  severity: string | null;
  layer: string | null;
  cluster: string | null;
  environment: string | null;
  namespace: string | null;
  service: string | null;
  started_at: string;
  last_seen_at: string;
}

export interface CaseListItem extends CaseBrief {}

export interface AlertEventOut {
  received_at: string;
  am_status: string;
  alertname: string | null;
  labels: Record<string, unknown>;
  annotations: Record<string, unknown>;
}

export interface SnapshotOut {
  id: number;
  created_at: string;
  window_from: string;
  window_to: string;
  prom_status: string;
  prom_error: string | null;
  prom: Record<string, unknown> | null;
  loki_status: string;
  loki_error: string | null;
  loki: Record<string, unknown> | null;
  tempo_status: string;
  tempo_error: string | null;
  tempo: Record<string, unknown> | null;
}

export interface AISummaryOut {
  summary: string;
  evidence: Record<string, unknown> | null;
  checks: Record<string, unknown> | null;
  advice: Record<string, unknown> | null;
}

export interface CaseDetailResponse {
  case: CaseBrief;
  alert_events: AlertEventOut[];
  snapshot: SnapshotOut | null;
  ai_summary: AISummaryOut | null;
}

export type SnapshotStatus = "ok" | "empty" | "error";

/** POST /reports/weekly/ai 응답 */
export interface WeeklyReportAIResponse {
  highlights: { title: string; text: string }[];
  summary: string;
}
