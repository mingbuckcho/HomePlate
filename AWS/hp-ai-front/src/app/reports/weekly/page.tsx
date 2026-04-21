"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getWeeklyReport,
  postWeeklyReportAI,
  type WeeklyReportResponse,
} from "@/lib/api";
import type { WeeklyReportAIResponse } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatLocalDateTime } from "@/lib/utils";

const LAYER_COLORS = [
  "#3182f6",
  "#00d084",
  "#ff6900",
  "#abb8c3",
  "#eb144c",
  "#7c3aed",
  "#64748b",
];
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#eb144c",
  warning: "#ff6900",
  info: "#3182f6",
  unknown: "#64748b",
};

export default function WeeklyReportPage() {
  const [data, setData] = useState<WeeklyReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aiData, setAiData] = useState<WeeklyReportAIResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWeeklyReport({ days: 7 })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load report",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAiSummary = () => {
    setAiLoading(true);
    setAiError(null);
    postWeeklyReportAI({ days: 7 })
      .then((res) => setAiData(res))
      .catch(() => {
        setAiError("AI 요약 생성에 실패했습니다. 다시 시도해 주세요.");
      })
      .finally(() => setAiLoading(false));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9fafb] p-4 dark:bg-gray-950 md:p-8 lg:p-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 py-24">
          <div className="h-12 w-12 animate-pulse rounded-full bg-blue-500" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            데이터를 불러오는 중…
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f9fafb] p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl">
          <EmptyState
            title="보고서를 불러올 수 없습니다"
            description={error ?? "데이터가 없습니다."}
          />
        </div>
      </div>
    );
  }

  const {
    period,
    totals,
    trend_daily,
    by_layer,
    by_severity,
    top_services,
    top_alertnames,
    latest_cases,
    ai_highlights_seed,
  } = data;

  const hasAnyData =
    totals.total_cases > 0 ||
    totals.resolved_cases > 0 ||
    trend_daily.some((d) => d.opened > 0 || d.resolved > 0) ||
    by_layer.some((x) => x.count > 0) ||
    by_severity.some((x) => x.count > 0) ||
    top_services.length > 0 ||
    top_alertnames.length > 0 ||
    latest_cases.length > 0 ||
    ai_highlights_seed.length > 0;

  const layerChartData = by_layer.filter((x) => x.count > 0);
  const severityChartData = by_severity
    .filter((x) => x.count > 0)
    .map((x) => ({ name: x.severity, value: x.count }));

  return (
    <div className="min-h-screen bg-[#f9fafb] p-4 font-sans text-gray-900 dark:bg-gray-950 dark:text-gray-100 md:p-8 lg:p-12">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              모니터링 주간 보고서
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              기간 내 알림·케이스 집계 (요청 시점 기준:
              alert_events.received_at)
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
            <Clock className="h-4 w-4" />
            <span>
              {formatLocalDateTime(period.start)} ~{" "}
              {formatLocalDateTime(period.end)} (총 {period.days}일)
            </span>
          </div>
        </header>

        {!hasAnyData && (
          <EmptyState
            title="집계 데이터 없음"
            description="선택한 기간에 알림 이벤트가 없습니다. 0건으로 표시됩니다."
          />
        )}

        {/* AI Highlights */}
        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                AI 요약 하이라이트
              </h2>
            </div>
            <button
              type="button"
              onClick={handleAiSummary}
              disabled={aiLoading}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm transition",
                aiLoading
                  ? "cursor-not-allowed bg-blue-400 dark:bg-blue-600"
                  : "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700",
              )}
            >
              {aiLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  생성 중…
                </>
              ) : (
                <>AI 요약 생성</>
              )}
            </button>
          </div>

          {aiError && (
            <div className="mb-4">
              <ErrorState message={aiError} retry={handleAiSummary} />
            </div>
          )}

          {!aiError && aiData != null && aiData.summary && (
            <div className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/30">
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                {aiData.summary}
              </p>
            </div>
          )}

          <div
            className={cn(
              "grid gap-6 md:grid-cols-3",
              (aiData?.highlights?.length ?? 0) > 0 &&
                "rounded-2xl bg-linear-to-br from-blue-600 to-indigo-700 p-6 text-white dark:from-blue-700 dark:to-indigo-800",
            )}
          >
            {aiData != null &&
            aiData.highlights &&
            aiData.highlights.length > 0 ? (
              aiData.highlights.map((h, i) => (
                <div
                  key={i}
                  className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur dark:border-white/10 dark:bg-white/10"
                >
                  <p className="text-sm leading-relaxed text-blue-50 dark:text-blue-100">
                    {h.text || "—"}
                  </p>
                  <div className="mt-4 text-xs font-bold uppercase tracking-wider text-blue-200 dark:text-blue-200">
                    {h.title || `Highlight ${i + 1}`}
                  </div>
                </div>
              ))
            ) : (
              <>
                {ai_highlights_seed.length === 0 ? (
                  <p className="col-span-full text-sm text-gray-500 dark:text-gray-400">
                    기간 내 AI 요약 시드 없음. AI 요약을 생성하면 하이라이트가
                    업데이트됩니다.
                  </p>
                ) : (
                  ai_highlights_seed.map((item, i) => (
                    <div
                      key={`${item.snapshot_id}-${i}`}
                      className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-gray-50/80 p-5 dark:border-gray-600 dark:bg-gray-700/20"
                    >
                      <p className="text-sm leading-relaxed text-gray-600 line-clamp-4 dark:text-gray-300">
                        {item.summary_preview || "—"}
                      </p>
                      <div className="mt-4 flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                        <span>
                          {item.case_key || `Snapshot #${item.snapshot_id}`}
                        </span>
                        {item.created_at && (
                          <span className="text-blue-600 dark:text-blue-400">
                            {formatLocalDateTime(item.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {aiData == null &&
                  (ai_highlights_seed.length > 0 || !aiError) && (
                    <p className="col-span-full mt-2 text-xs text-gray-500 dark:text-gray-400">
                      AI 요약을 생성하면 하이라이트가 업데이트됩니다.
                    </p>
                  )}
              </>
            )}
          </div>
        </section>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                총 케이스 수
              </p>
              <h3 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                {totals.total_cases}
              </h3>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-900/20">
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                해결률
              </p>
              <h3 className="text-4xl font-bold text-emerald-600">
                {(totals.resolution_rate * 100).toFixed(1)}%
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                해결된 케이스 {totals.resolved_cases}건
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-900/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Trend daily */}
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
            일별 추이 (Opened / Resolved)
          </h3>
          <div className="h-[300px] w-full">
            {trend_daily.length === 0 ? (
              <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
                데이터 없음
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend_daily}>
                  <defs>
                    <linearGradient
                      id="weeklyOpenedGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#3182f6" stopOpacity={0.9} />
                      <stop
                        offset="100%"
                        stopColor="#bfdbfe"
                        stopOpacity={0.4}
                      />
                    </linearGradient>
                    <linearGradient
                      id="weeklyResolvedGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#00d084" stopOpacity={0.9} />
                      <stop
                        offset="100%"
                        stopColor="#bbf7d0"
                        stopOpacity={0.4}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-600"
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "16px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="opened"
                    name="Opened"
                    fill="url(#weeklyOpenedGradient)"
                    stroke="#3182f6"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="resolved"
                    name="Resolved"
                    fill="url(#weeklyResolvedGradient)"
                    stroke="#00d084"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Distributions */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
              레이어별 분포
            </h3>
            <div className="h-[300px] w-full">
              {layerChartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
                  데이터 없음
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={layerChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="layer"
                    >
                      {layerChartData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={LAYER_COLORS[i % LAYER_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
              Severity별 분포
            </h3>
            <div className="h-[300px] w-full">
              {severityChartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
                  데이터 없음
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={severityChartData}
                    layout="vertical"
                    margin={{ left: 20, right: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      className="stroke-gray-100 dark:stroke-gray-600"
                    />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={80}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: "#f9fafb" }}
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                      {severityChartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            SEVERITY_COLORS[entry.name] ??
                            LAYER_COLORS[i % LAYER_COLORS.length]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Top 서비스 5 / 반복 알람 Top 5 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
              Top 서비스 5개
            </h3>
            <div className="space-y-4">
              {top_services.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  데이터 없음
                </p>
              ) : (
                top_services.map((s, i) => (
                  <div
                    key={`${s.namespace}-${s.service}-${i}`}
                    className="flex items-center justify-between transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-500 dark:bg-gray-600 dark:text-gray-300">
                        {i + 1}
                      </div>
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {s.namespace}/{s.service}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {s.count}건
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-500" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
              반복 알람 Top 5
            </h3>
            <div className="space-y-4">
              {top_alertnames.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  데이터 없음
                </p>
              ) : (
                top_alertnames.map((a, i) => (
                  <div
                    key={`${a.alertname}-${i}`}
                    className="flex items-center justify-between overflow-hidden transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-sm font-bold text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                        {i + 1}
                      </div>
                      <span className="truncate font-medium text-gray-700 dark:text-gray-200">
                        {a.alertname}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {a.count}회
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-500" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Latest cases table */}
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-100 p-6 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              최신 케이스 10건
            </h3>
          </div>
          {latest_cases.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              데이터 없음
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Case
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Service
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Severity
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Last seen
                    </th>
                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      링크
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {latest_cases.map((c) => (
                    <tr
                      key={c.case_id}
                      className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      <td className="px-4 py-4 font-mono text-gray-700 dark:text-gray-200">
                        {c.case_key}
                      </td>
                      <td className="px-4 py-4 text-gray-700 dark:text-gray-200">
                        {c.namespace} / {c.service}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "rounded-md px-2 py-1 text-xs font-medium",
                            c.severity === "critical" &&
                              "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
                            c.severity === "warning" &&
                              "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
                            !["critical", "warning"].includes(c.severity) &&
                              "bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300",
                          )}
                        >
                          {c.severity}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "rounded-md px-2 py-1 text-xs font-medium",
                            c.status === "resolved" &&
                              "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
                            c.status !== "resolved" &&
                              "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
                          )}
                        >
                          {c.status === "resolved" ? "Resolved" : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-400">
                        {formatLocalDateTime(c.last_seen_at)}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/cases/${c.case_id}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                        >
                          보기
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
