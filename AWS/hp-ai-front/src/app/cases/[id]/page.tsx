"use client";

import Link from "next/link";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { getCaseDetail, refreshCase, createAiSummary } from "@/lib/api";
import type { CaseDetailResponse, SnapshotOut } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ScrollSpyTabs } from "@/components/ScrollSpyTabs";
import { useTheme } from "@/contexts/ThemeContext";
import {
  cn,
  formatBytes,
  formatCpuCores,
  formatLocalDateTime,
  formatTimeHHmm,
  getSnapshotErrorMessage,
} from "@/lib/utils";
import {
  ChevronLeft,
  RefreshCw,
  Sparkles,
  Activity,
  Terminal,
  Layers,
  Calendar,
  Info,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "metrics", label: "Metrics" },
  { id: "logs", label: "Logs" },
  { id: "traces", label: "Traces" },
  { id: "events", label: "Events" },
];

const LOG_COLUMNS = [
  "@timestamp",
  "level",
  "logger",
  "method",
  "path",
  "status",
  "duration_ms",
  "trace_id",
] as const;
const TRACE_COLUMNS = [
  "traceId",
  "durationMs",
  "rootServiceName",
  "rootSpanName",
  "startTime",
] as const;

type AnnotationsLike = Record<string, unknown> | null | undefined;

function renderAnnotationsPretty(annotations: AnnotationsLike) {
  if (!annotations || typeof annotations !== "object") return null;
  const { summary, description, runbook_url, dashboard_url, ...rest } =
    annotations as Record<string, unknown>;

  const restKeys = Object.keys(rest);
  const hasRest = restKeys.length > 0;

  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-200">
      {!!summary && (
        <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-50">
          {String(summary)}
        </p>
      )}
      {!!description && (
        <p className="mb-2 whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-200">
          {String(description)}
        </p>
      )}
      {!!runbook_url || !!dashboard_url ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {!!runbook_url && (
            <a
              href={String(runbook_url)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60"
            >
              Runbook
            </a>
          )}
          {!!dashboard_url && (
            <a
              href={String(dashboard_url)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
            >
              Dashboard
            </a>
          )}
        </div>
      ) : null}
      {hasRest && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[11px] font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            기타 annotations
          </summary>
          <pre className="mt-1 max-h-40 overflow-auto rounded bg-gray-900/90 p-2 font-mono text-[11px] text-gray-100 dark:bg-black/80">
            {JSON.stringify(rest, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

type StatColor = "red" | "amber" | "blue" | "neutral";
function getStatCardColor(
  name: string,
  value: number | null | undefined,
): StatColor {
  if (value == null || Number.isNaN(value)) return "neutral";
  const v = Number(value);
  switch (name) {
    case "up":
    case "ready_pods":
      return v === 0 ? "red" : "blue";
    case "not_ready":
      return v >= 1 ? "red" : "blue";
    case "restarts_30m":
      if (v >= 5) return "red";
      if (v >= 1) return "amber";
      return "blue";
    default:
      return "neutral";
  }
}

const STAT_CARD_COLORS: Record<
  StatColor,
  { bg: string; border: string; label: string; value: string }
> = {
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    label: "text-red-700",
    value: "text-red-900",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    label: "text-amber-700",
    value: "text-amber-900",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    label: "text-blue-700",
    value: "text-blue-900",
  },
  neutral: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    label: "text-gray-500",
    value: "text-gray-700",
  },
};

function parseLokiLine(line: unknown): Record<string, string> | null {
  if (typeof line !== "string") return null;
  try {
    const outer = JSON.parse(line) as Record<string, unknown> & {
      time?: string;
      message?: string;
    };
    const time = (outer?.time ?? "") as string;
    const msg = outer?.message;

    if (typeof msg === "string") {
      try {
        const inner = JSON.parse(msg) as Record<string, unknown>;
        return {
          "@timestamp": String(inner["@timestamp"] ?? time),
          level: String(inner["level"] ?? ""),
          logger: String(inner["logger"] ?? ""),
          method: String(inner["method"] ?? ""),
          path: String(inner["path"] ?? ""),
          status: String(inner["status"] ?? ""),
          duration_ms: String(inner["duration_ms"] ?? ""),
          trace_id: String(inner["trace_id"] ?? ""),
        };
      } catch {
        return { "@timestamp": time, raw: msg };
      }
    }

    // Flat JSON (no message field): use outer directly as log record
    if (outer != null && typeof outer === "object") {
      const ts = String(outer["@timestamp"] ?? outer["time"] ?? time);
      const level = String(outer["level"] ?? "");
      const logger = String(outer["logger"] ?? "");
      const method = String(outer["method"] ?? "");
      const path = String(outer["path"] ?? "");
      const status = String(outer["status"] ?? "");
      const duration_ms = String(outer["duration_ms"] ?? "");
      const trace_id = String(outer["trace_id"] ?? "");
      if (
        level !== "" ||
        logger !== "" ||
        method !== "" ||
        path !== "" ||
        status !== "" ||
        duration_ms !== "" ||
        trace_id !== ""
      ) {
        return {
          "@timestamp": ts,
          level,
          logger,
          method,
          path,
          status,
          duration_ms,
          trace_id,
        };
      }
    }

    return { "@timestamp": time, raw: line };
  } catch {
    return { raw: line };
  }
}

function formatStartTime(raw: string): string {
  if (!raw) return "";
  const n = Number(raw);
  if (Number.isNaN(n)) return raw;
  const ms = n > 1e15 ? n / 1e6 : n > 1e12 ? n : n * 1000;
  return formatLocalDateTime(ms);
}

function formatDurationMs(raw: string): string {
  const n = Number(raw);
  if (Number.isNaN(n) || raw === "") return raw;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
  return `${n}ms`;
}

function normalizeTempoTrace(
  t: Record<string, unknown>,
): Record<string, string> {
  const traceId = String(t["traceID"] ?? t["traceId"] ?? "");
  const durationMs = String(t["durationMs"] ?? t["duration"] ?? "");
  const startRaw = String(t["startTimeUnixNano"] ?? t["startTime"] ?? "");
  return {
    traceId,
    durationMs: formatDurationMs(durationMs),
    durationRaw: durationMs,
    rootServiceName: String(t["rootServiceName"] ?? ""),
    rootSpanName: String(t["rootSpanName"] ?? t["rootTraceName"] ?? ""),
    startTime: formatStartTime(startRaw),
  };
}

function renderByStatus(
  status: string,
  snapshot: SnapshotOut | null,
  dataKey: "prom" | "loki" | "tempo",
  emptyTitle: string,
  emptyDesc: string,
  renderData: (data: Record<string, unknown> | null) => React.ReactNode,
  onRetry?: () => void,
) {
  if (!snapshot) {
    return (
      <EmptyState
        title="아직 수집 전"
        description="스냅샷이 없습니다. Refresh Snapshot을 실행해 주세요."
      />
    );
  }
  const st = status?.toLowerCase();
  if (st === "error") {
    return (
      <ErrorState message={getSnapshotErrorMessage(snapshot)} retry={onRetry} />
    );
  }
  if (st === "empty") {
    return <EmptyState title={emptyTitle} description={emptyDesc} />;
  }
  const data = snapshot[dataKey];
  const isEmpty =
    data == null ||
    (typeof data === "object" && Object.keys(data).length === 0);
  if (isEmpty) {
    return (
      <EmptyState
        title="현재 신호 없음"
        description="해당 구간에 데이터가 없습니다."
      />
    );
  }
  return <>{renderData(data)}</>;
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const traceIdFilter = searchParams.get("traceId");
  const id = Number(params?.id);
  const [data, setData] = useState<CaseDetailResponse | null>(null);
  const isDark = theme === "dark";
  const chartGrid = isDark ? "#4b5563" : "#f3f4f6";
  const chartTick = isDark ? "#d1d5db" : "#9ca3af";
  const chartAxis = isDark ? "#6b7280" : "#e5e7eb";
  const chartTooltipBorder = isDark ? "#4b5563" : "#e5e7eb";
  const chartCursor = isDark ? "#4b5563" : "#e5e7eb";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [logsVisible, setLogsVisible] = useState(10);
  const [tracesVisible, setTracesVisible] = useState(10);

  const scrollToTracesAndSetTraceId = (traceId: string) => {
    router.replace(`${pathname}?traceId=${encodeURIComponent(traceId)}`);
    setTimeout(
      () =>
        document
          .getElementById("traces")
          ?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  };
  const clearTraceIdFilter = () => router.replace(pathname ?? "");

  const fetchDetail = useCallback(() => {
    if (!id || Number.isNaN(id)) return;
    setLoading(true);
    setError(null);
    getCaseDetail(id)
      .then(setData)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    setLogsVisible(10);
    setTracesVisible(10);
  }, [id]);

  const handleRefresh = () => {
    if (!id || Number.isNaN(id)) return;
    setIsRefreshing(true);
    refreshCase(id)
      .then(() => fetchDetail())
      .catch(() => {})
      .finally(() => setIsRefreshing(false));
  };

  const handleAiSummary = () => {
    const snapshotId = data?.snapshot?.id;
    if (snapshotId == null) return;
    setAiError(null);
    setIsAiLoading(true);
    createAiSummary(snapshotId)
      .then(() => fetchDetail())
      .catch((err: Error) => {
        const msg = err?.message ?? "AI Summary 생성 실패";
        try {
          const parsed = JSON.parse(msg);
          setAiError(parsed.detail ?? msg);
        } catch {
          setAiError(msg);
        }
      })
      .finally(() => setIsAiLoading(false));
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <LoadingSkeleton lines={6} className="max-w-3xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl">
          <ErrorState
            message={error ?? "Case not found"}
            retry={() => fetchDetail()}
          />
          <Link
            href="/cases"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            ← Case 목록으로
          </Link>
        </div>
      </div>
    );
  }

  const { case: c, alert_events, snapshot, ai_summary } = data;
  const hasSnapshot = snapshot != null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 dark:bg-gray-950">
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-col gap-4">
            <Link
              href="/cases"
              className="flex w-fit items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to list
            </Link>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {c.case_key}
                  </h1>
                  {c.severity && (
                    <span className="rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                      {c.severity}
                    </span>
                  )}
                  <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                    {c.status}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {c.namespace ?? "-"} / {c.service ?? "-"}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <RefreshCw
                    className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                  />
                  Refresh Snapshot
                </button>
                {!ai_summary && (
                  <button
                    type="button"
                    onClick={handleAiSummary}
                    disabled={isAiLoading || !hasSnapshot}
                    className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-600 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
                  >
                    <Sparkles
                      className={cn("h-4 w-4", isAiLoading && "animate-pulse")}
                    />
                    AI 요약
                  </button>
                )}
                {hasSnapshot && (
                  <button
                    type="button"
                    onClick={handleAiSummary}
                    disabled={isAiLoading}
                    className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-blue-900/30"
                  >
                    <Sparkles
                      className={cn("h-4 w-4", isAiLoading && "animate-spin")}
                    />
                    AI 요약 갱신
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <ScrollSpyTabs tabs={TABS} />
      </div>

      <div
        id="detail-content"
        className="mx-auto max-w-7xl flex flex-col gap-12 px-6 pt-8"
      >
        {ai_summary && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                AI 요약
              </h2>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                스냅샷 기반 인시던트 설명
              </span>
            </div>
            <div className="rounded-3xl bg-linear-to-br from-blue-600 via-indigo-600 to-sky-500 p-5 text-sm leading-relaxed text-blue-50 shadow-md dark:from-blue-700 dark:via-indigo-700 dark:to-sky-600">
              <p className="whitespace-pre-wrap">{ai_summary.summary}</p>
            </div>
          </section>
        )}

        {!ai_summary && hasSnapshot && !aiError && (
          <EmptyState
            title="AI 요약 없음"
            description="AI 요약 버튼을 눌러 스냅샷 기반 요약을 생성할 수 있습니다."
          />
        )}
        {aiError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
            <strong>AI 요약 생성 실패</strong>: {aiError}
            <button
              type="button"
              onClick={() => {
                setAiError(null);
                handleAiSummary();
              }}
              className="ml-3 mt-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50"
            >
              재시도
            </button>
          </div>
        )}

        <section id="overview" className="flex flex-col gap-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            <Info className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            Overview
          </h2>
          {!snapshot ? (
            <EmptyState
              title="아직 수집 전"
              description="스냅샷이 없습니다. Refresh Snapshot을 실행해 주세요."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Window
                </p>
                <p className="mt-2 text-sm leading-snug text-gray-900 dark:text-gray-100">
                  {formatLocalDateTime(snapshot.window_from)} ~{" "}
                  {formatLocalDateTime(snapshot.window_to)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Started
                </p>
                <p className="mt-2 text-sm leading-snug text-gray-900 dark:text-gray-100">
                  {formatLocalDateTime(c.started_at)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Last seen
                </p>
                <p className="mt-2 text-sm leading-snug text-gray-900 dark:text-gray-100">
                  {formatLocalDateTime(c.last_seen_at)}
                </p>
              </div>
              {(() => {
                const stats = (
                  Array.isArray(snapshot.prom?.stats) ? snapshot.prom.stats : []
                ) as { name?: string; value?: number }[];
                const available = stats.find(
                  (s) => s.name === "deployment_available",
                )?.value;
                const desired = stats.find(
                  (s) => s.name === "deployment_desired",
                )?.value;
                const hasDeployment = available != null || desired != null;
                if (!hasDeployment) return null;
                return (
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Deployment replicas
                    </p>
                    <p className="mt-2 text-sm leading-snug text-gray-900 dark:text-gray-100">
                      {available ?? "-"}/{desired ?? "-"}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </section>

        <section id="metrics" className="flex flex-col gap-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            <Activity className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            Metrics
          </h2>
          {renderByStatus(
            snapshot?.prom_status ?? "empty",
            snapshot,
            "prom",
            "메트릭 없음",
            "해당 구간에 Prometheus 데이터가 없습니다.",
            (prom) => {
              const data = prom as {
                stats?: { name?: string; value?: number }[];
                series?: {
                  _metric_name?: string;
                  values?: [number, string][];
                }[];
              };
              const stats = Array.isArray(data?.stats) ? data.stats : [];
              const series = Array.isArray(data?.series) ? data.series : [];
              const statLabels: Record<string, string> = {
                up: "UP",
                ready_pods: "Ready Pods",
                not_ready: "NotReady",
                restarts_30m: "Restarts (30m)",
              };
              const cpuSeries = series.find((s) => s._metric_name === "cpu");
              const memSeries = series.find((s) => s._metric_name === "memory");
              const cpuData =
                cpuSeries?.values?.map(([ts, v]) => ({
                  time: formatLocalDateTime(ts * 1000),
                  timeLabel: formatTimeHHmm(ts * 1000),
                  value: Number(v),
                })) ?? [];
              const memData =
                memSeries?.values?.map(([ts, v]) => ({
                  time: formatLocalDateTime(ts * 1000),
                  timeLabel: formatTimeHHmm(ts * 1000),
                  value: Number(v),
                })) ?? [];
              const cpuMax = Math.max(...cpuData.map((d) => d.value), 0.01);
              const memMax = Math.max(...memData.map((d) => d.value), 1);
              const cpuDomain: [number, number] = [
                0,
                Math.max(cpuMax * 1.2, 0.1),
              ];
              const memDomain: [number, number] = [
                0,
                Math.max(memMax * 1.2, 1),
              ];
              return (
                <div className="flex flex-col gap-8">
                  {stats.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {stats.map((s, i) => {
                        const color = getStatCardColor(s.name ?? "", s.value);
                        const styles = STAT_CARD_COLORS[color];
                        const displayValue =
                          s.value != null && !Number.isNaN(s.value)
                            ? String(s.value)
                            : "-";
                        return (
                          <div
                            key={i}
                            className={cn(
                              "rounded-xl border p-5 shadow-sm",
                              styles.bg,
                              styles.border,
                            )}
                          >
                            <p
                              className={cn(
                                "text-xs font-medium uppercase tracking-wide",
                                styles.label,
                              )}
                            >
                              {statLabels[s.name ?? ""] ?? s.name ?? "-"}
                            </p>
                            <p
                              className={cn(
                                "mt-2 text-2xl font-semibold tabular-nums",
                                styles.value,
                              )}
                            >
                              {displayValue}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {(cpuData.length > 0 || memData.length > 0) && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {cpuData.length > 0 && (
                        <div className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-gray-800">
                          <p className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-200">
                            CPU (vCPU, rate 5m)
                          </p>
                          <ResponsiveContainer width="100%" height={280}>
                            <AreaChart
                              data={cpuData}
                              margin={{
                                top: 20,
                                right: 12,
                                left: 4,
                                bottom: 4,
                              }}
                            >
                              <defs>
                                <linearGradient
                                  id="cpuGradient"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="0%"
                                    stopColor="#2563eb"
                                    stopOpacity={0.9}
                                  />
                                  <stop
                                    offset="100%"
                                    stopColor="#bfdbfe"
                                    stopOpacity={0.4}
                                  />
                                </linearGradient>
                              </defs>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={chartGrid}
                                vertical={false}
                              />
                              <XAxis
                                dataKey="timeLabel"
                                interval={Math.max(
                                  0,
                                  Math.floor((cpuData.length - 1) / 6),
                                )}
                                tick={{
                                  fontSize: 10,
                                  fill: chartTick,
                                }}
                                tickLine={false}
                                axisLine={{ stroke: chartAxis }}
                              />
                              <YAxis
                                domain={cpuDomain}
                                tick={{
                                  fontSize: 10,
                                  fill: chartTick,
                                }}
                                tickLine={false}
                                axisLine={false}
                                width={42}
                                tickFormatter={(v) => Number(v).toFixed(2)}
                              />
                              <Tooltip
                                formatter={(v: number) => [
                                  formatCpuCores(v),
                                  "CPU",
                                ]}
                                labelFormatter={(_, payload) =>
                                  payload?.[0]?.payload?.time ?? ""
                                }
                                contentStyle={{
                                  borderRadius: 8,
                                  border: `1px solid ${chartTooltipBorder}`,
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                                }}
                                cursor={{ stroke: chartCursor }}
                              />
                              <Area
                                type="monotone"
                                dataKey="value"
                                fill="url(#cpuGradient)"
                                stroke="#2563eb"
                                strokeWidth={2.5}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {memData.length > 0 && (
                        <div className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-600 dark:bg-gray-800">
                          <p className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-200">
                            Memory (MiB/GiB)
                          </p>
                          <ResponsiveContainer width="100%" height={280}>
                            <AreaChart
                              data={memData}
                              margin={{
                                top: 20,
                                right: 12,
                                left: 4,
                                bottom: 4,
                              }}
                            >
                              <defs>
                                <linearGradient
                                  id="memGradient"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="0%"
                                    stopColor="#059669"
                                    stopOpacity={0.9}
                                  />
                                  <stop
                                    offset="100%"
                                    stopColor="#6ee7b7"
                                    stopOpacity={0.4}
                                  />
                                </linearGradient>
                              </defs>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={chartGrid}
                                vertical={false}
                              />
                              <XAxis
                                dataKey="timeLabel"
                                interval={Math.max(
                                  0,
                                  Math.floor((memData.length - 1) / 6),
                                )}
                                tick={{
                                  fontSize: 10,
                                  fill: chartTick,
                                }}
                                tickLine={false}
                                axisLine={{ stroke: chartAxis }}
                              />
                              <YAxis
                                domain={memDomain}
                                tick={{
                                  fontSize: 10,
                                  fill: chartTick,
                                }}
                                tickLine={false}
                                axisLine={false}
                                width={52}
                                tickFormatter={(v) => formatBytes(Number(v))}
                              />
                              <Tooltip
                                formatter={(v: number) => [
                                  formatBytes(v),
                                  "Memory",
                                ]}
                                labelFormatter={(_, payload) =>
                                  payload?.[0]?.payload?.time ?? ""
                                }
                                contentStyle={{
                                  borderRadius: 8,
                                  border: `1px solid ${chartTooltipBorder}`,
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                                }}
                                cursor={{ stroke: chartCursor }}
                              />
                              <Area
                                type="monotone"
                                dataKey="value"
                                fill="url(#memGradient)"
                                stroke="#059669"
                                strokeWidth={2.5}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                  {stats.length === 0 &&
                    cpuData.length === 0 &&
                    memData.length === 0 && (
                      <EmptyState
                        title="현재 신호 없음"
                        description="해당 구간에 데이터가 없습니다."
                      />
                    )}
                </div>
              );
            },
            handleRefresh,
          )}
        </section>

        <section id="logs" className="flex flex-col gap-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            <Terminal className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            Logs
          </h2>
          {renderByStatus(
            snapshot?.loki_status ?? "empty",
            snapshot,
            "loki",
            "로그 없음",
            "해당 구간에 Loki 로그가 없습니다.",
            (loki) => {
              const data = loki as {
                recent_logs?: { ts?: string; line?: string }[];
              };
              const logs = Array.isArray(data?.recent_logs)
                ? data.recent_logs
                : [];
              const allRows = logs.map((entry) => {
                const parsed = parseLokiLine(entry?.line ?? entry?.ts ?? "");
                if (
                  parsed &&
                  !("raw" in parsed && Object.keys(parsed).length === 1)
                )
                  return parsed;
                return { raw: String(entry?.line ?? entry?.ts ?? "") };
              });
              const rows = allRows.filter((r) => {
                const raw = (r.raw ?? "").toString().trim();
                if (raw !== "") return true;
                return (
                  (r.level ?? "").trim() !== "" ||
                  (r.logger ?? "").trim() !== "" ||
                  (r.method ?? "").trim() !== "" ||
                  (r.path ?? "").trim() !== ""
                );
              });
              const visibleRows = rows.slice(0, logsVisible);
              const hasTraceId = rows.some(
                (r) => (r.trace_id ?? "").trim() !== "",
              );
              type LogCol = (typeof LOG_COLUMNS)[number] | "raw";
              const cols: LogCol[] = [...LOG_COLUMNS].filter(
                (c) => c !== "trace_id" || hasTraceId,
              ) as LogCol[];
              if (cols.length === 0) cols.push("raw");
              if (rows.length === 0) {
                return (
                  <EmptyState
                    title="로그 없음"
                    description="파싱된 로그가 없습니다."
                  />
                );
              }
              return (
                <div className="flex flex-col gap-3">
                  <div className="overflow-auto rounded-xl border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
                          {cols.map((c) => (
                            <th
                              key={c}
                              className="px-3 py-2 font-medium text-gray-600 dark:text-gray-200"
                            >
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((r, i) => (
                          <tr
                            key={i}
                            className="border-b border-gray-100 dark:border-gray-600"
                          >
                            {cols.map((col) => (
                              <td
                                key={col}
                                className="max-w-[200px] truncate px-3 py-2 text-gray-700 dark:text-gray-300"
                              >
                                {col === "trace_id" && (r.trace_id ?? "") ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      scrollToTracesAndSetTraceId(
                                        r.trace_id ?? "",
                                      )
                                    }
                                    className="text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                                  >
                                    {r.trace_id}
                                  </button>
                                ) : col === "@timestamp" ? (
                                  formatLocalDateTime(r["@timestamp"] ?? r.raw)
                                ) : col === "raw" ? (
                                  (r.raw ?? "")
                                ) : (
                                  (r[col] ?? "")
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > logsVisible && logsVisible < 50 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLogsVisible((n) => Math.min(n + 10, 50))
                      }
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                      더보기 (+10, 최대 50)
                    </button>
                  )}
                </div>
              );
            },
            handleRefresh,
          )}
        </section>

        <section id="traces" className="flex flex-col gap-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            <Layers className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            Traces
          </h2>
          {renderByStatus(
            snapshot?.tempo_status ?? "empty",
            snapshot,
            "tempo",
            "현재 트레이스 없음",
            "trace 없는 서비스일 수 있습니다.",
            (tempo) => {
              const data = tempo as { traces?: Record<string, unknown>[] };
              const traces = Array.isArray(data?.traces) ? data.traces : [];
              const rows = traces.map(normalizeTempoTrace);
              const visibleRows = rows.slice(0, tracesVisible);
              return (
                <div className="flex flex-col gap-3">
                  {traceIdFilter && (
                    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm dark:border-amber-700 dark:bg-amber-900/30">
                      <span className="text-amber-800 dark:text-amber-200">
                        traceId 필터:{" "}
                        <code className="font-mono">{traceIdFilter}</code>
                      </span>
                      <button
                        type="button"
                        onClick={clearTraceIdFilter}
                        className="rounded px-2 py-1 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-800/50"
                      >
                        해제
                      </button>
                    </div>
                  )}
                  <div className="overflow-auto rounded-xl border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
                          {TRACE_COLUMNS.map((c) => (
                            <th
                              key={c}
                              className="px-3 py-2 font-medium text-gray-600 dark:text-gray-200"
                            >
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((r, i) => (
                          <tr
                            key={i}
                            className={cn(
                              "border-b border-gray-100 dark:border-gray-600",
                              r.traceId === traceIdFilter &&
                                "bg-amber-100 dark:bg-amber-900/40",
                            )}
                          >
                            {TRACE_COLUMNS.map((col) => (
                              <td
                                key={col}
                                className="max-w-[180px] truncate px-3 py-2 font-mono text-gray-700 dark:text-gray-300"
                              >
                                {r[col] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > tracesVisible && tracesVisible < 20 && (
                    <button
                      type="button"
                      onClick={() =>
                        setTracesVisible((n) => Math.min(n + 10, 20))
                      }
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                      더보기 (+10, 최대 20)
                    </button>
                  )}
                </div>
              );
            },
            handleRefresh,
          )}
        </section>

        <section id="events" className="flex flex-col gap-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            <Calendar className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            Events
          </h2>
          {!alert_events || alert_events.length === 0 ? (
            <EmptyState
              title="현재 신호 없음"
              description="아직 수집된 알림 이벤트가 없습니다."
            />
          ) : (
            <div className="space-y-4 border-l-2 border-gray-200 pl-6 dark:border-gray-600">
              {alert_events.map((e, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                    {formatLocalDateTime(e.received_at)}
                  </span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {e.alertname ?? "(no name)"} — {e.am_status}
                  </p>
                  {e.annotations &&
                    Object.keys(e.annotations).length > 0 &&
                    renderAnnotationsPretty(
                      e.annotations as Record<string, unknown>,
                    )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
