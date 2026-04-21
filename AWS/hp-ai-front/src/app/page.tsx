"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getSummaryHome,
  postSummaryHomeLayersAi,
  getHomeSnapshotLatest,
  postHomeSnapshot,
  getHomeLayersSnapshotLatest,
  postHomeLayersSnapshot,
  type SummaryHomeResponse,
  type HomeSnapshot,
  type HomeLayerSnapshot,
} from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { StatCard } from "@/components/StatCard";
import {
  AlertCircle,
  CheckCircle2,
  FileWarning,
  RefreshCw,
  Sparkles,
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
import {
  cn,
  formatBytes,
  formatCpuCores,
  formatLocalDateTime,
  formatTimeHHmm,
} from "@/lib/utils";

export default function HomePage() {
  const [summary, setSummary] = useState<SummaryHomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [homeSnapshot, setHomeSnapshot] = useState<HomeSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [layerSnapshots, setLayerSnapshots] = useState<HomeLayerSnapshot[]>([]);
  const [layerSnapshotLoading, setLayerSnapshotLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSummaryHome("open")
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getHomeSnapshotLatest()
      .then((data) => {
        if (!cancelled) setHomeSnapshot(data ?? null);
      })
      .catch(() => {
        if (!cancelled) setHomeSnapshot(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getHomeLayersSnapshotLatest()
      .then((data) => {
        if (!cancelled) {
          const list = Array.isArray(data?.snapshots) ? data.snapshots : [];
          const normalized = normalizeLayerSnapshots(list);
          console.log("layerSnapshots raw", data);
          console.log("layerSnapshots normalized", normalized);
          console.log(
            "layerSnapshots summary",
            normalized.map((x) => ({
              layer: x.layer,
              promStatus: x.prom_status,
              statsLen: x.prom?.stats?.length ?? 0,
              seriesLen: x.prom?.series?.length ?? 0,
            })),
          );
          setLayerSnapshots(normalized);
        }
      })
      .catch(() => {
        if (!cancelled) setLayerSnapshots([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasLayerSnapshots = layerSnapshots.length > 0;

  const handleAiSummary = () => {
    if (!hasLayerSnapshots) return;
    setAiLoading(true);
    setAiSummary(null);
    postSummaryHomeLayersAi()
      .then((res) => setAiSummary(res.summary))
      .catch(() => setAiSummary("요약 생성에 실패했습니다."))
      .finally(() => setAiLoading(false));
  };

  const handleLayerSnapshotRefresh = () => {
    setLayerSnapshotLoading(true);
    postHomeLayersSnapshot()
      .then((data) => {
        const list = Array.isArray(data?.snapshots) ? data.snapshots : [];
        setLayerSnapshots(normalizeLayerSnapshots(list));
      })
      .catch(() => setLayerSnapshots([]))
      .finally(() => setLayerSnapshotLoading(false));
  };

  const handleSnapshotRefresh = () => {
    setSnapshotLoading(true);
    postHomeSnapshot()
      .then((s) => setHomeSnapshot(s))
      .catch(() => setHomeSnapshot(null))
      .finally(() => setSnapshotLoading(false));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl space-y-8">
          <LoadingSkeleton lines={2} className="max-w-md" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <LoadingSkeleton key={i} lines={2} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalOpen = summary?.total_open ?? 0;
  const byLayer = summary?.by_layer ?? [];
  const bySeverity = summary?.by_severity ?? [];
  const topServices = summary?.top_services ?? [];
  const recentlyUpdated = summary?.recently_updated ?? [];
  const hasData = totalOpen > 0 || byLayer.length > 0;

  return (
    <div className="min-h-screen bg-[#f9fafb] p-4 font-sans text-gray-900 dark:bg-gray-950 dark:text-gray-100 md:p-8 lg:p-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              운영 상태 한눈에 보기
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              클러스터·애플리케이션·UX까지 한 화면에서 확인하는 AIOps 대시보드
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 text-sm text-gray-500 dark:text-gray-400 md:items-end">
            <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
              실시간 스냅샷 + 최근 케이스 기준
            </span>
            <span>
              {homeSnapshot
                ? `Snapshot 기준 시각 · ${formatLocalDateTime(homeSnapshot.created_at)}`
                : "Snapshot 수집 전 · 버튼을 눌러 최신 상태를 가져올 수 있습니다."}
            </span>
          </div>
        </header>

        {/* AI 요약 섹션 */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              <div className="flex flex-col">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  AI 한 줄 요약
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  최근 스냅샷과 레이어 메트릭을 기반으로, 오늘 인프라의 핵심만
                  정리해 드려요.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSnapshotRefresh}
                disabled={snapshotLoading}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800",
                )}
              >
                <RefreshCw
                  className={cn("h-4 w-4", snapshotLoading && "animate-spin")}
                />
                {snapshotLoading ? "Snapshot 수집 중…" : "Snapshot 새로고침"}
              </button>
              <button
                type="button"
                onClick={handleAiSummary}
                disabled={aiLoading || !hasLayerSnapshots}
                title={
                  !hasLayerSnapshots
                    ? "먼저 Layer Snapshot을 한 번 수집해 주세요."
                    : undefined
                }
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-white shadow-sm transition",
                  aiLoading || !hasLayerSnapshots
                    ? "cursor-not-allowed bg-blue-400 dark:bg-blue-600"
                    : "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700",
                )}
              >
                <Sparkles
                  className={cn("h-4 w-4", aiLoading && "animate-spin")}
                />
                {aiLoading ? "AI 요약 생성 중…" : "AI 요약 보기"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-linear-to-br from-blue-600 via-indigo-600 to-sky-500 p-6 text-white shadow-md dark:from-blue-700 dark:via-indigo-700 dark:to-sky-600">
            <div className="text-sm leading-relaxed text-blue-50 dark:text-blue-100">
              {aiSummary ? (
                (() => {
                  const lines = aiSummary
                    .split(/\n/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const hasLineBullets = lines.some((l) => l.startsWith("- "));
                  if (hasLineBullets) {
                    return (
                      <ul className="list-none space-y-2 pl-0">
                        {lines.map((line, i) =>
                          line.startsWith("- ") ? (
                            <li key={i} className="flex gap-2">
                              <span className="shrink-0 text-blue-200 dark:text-blue-300">
                                -
                              </span>
                              <span>{line.slice(2).trim()}</span>
                            </li>
                          ) : (
                            <li key={i}>{line}</li>
                          ),
                        )}
                      </ul>
                    );
                  }
                  // 한 줄로 오는 경우: " - " 구분자로 항목 나누기
                  const segments = aiSummary
                    .split(/\s-\s+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  if (segments.length > 1) {
                    return (
                      <ul className="list-none space-y-2 pl-0">
                        {segments.map((seg, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="shrink-0 text-blue-200 dark:text-blue-300">
                              -
                            </span>
                            <span>
                              {seg.startsWith("-") ? seg.slice(1).trim() : seg}
                            </span>
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  return <p className="whitespace-pre-wrap">{aiSummary}</p>;
                })()
              ) : hasData ? (
                <p>
                  상단 버튼을 눌러 오늘 인프라·애플리케이션 상태를 한 번에
                  요약해 보세요.
                </p>
              ) : (
                <p>
                  아직 열려 있는 케이스가 없습니다. Alertmanager에서 첫 알림이
                  들어오면 이 영역에 요약이 표시됩니다.
                </p>
              )}
            </div>
          </div>
        </section>

        {!hasData ? (
          <EmptyState
            title="현재 열려 있는 케이스가 없습니다"
            description="Alertmanager 웹훅을 수신하면 layer가 있는 케이스 기준으로 요약이 채워집니다."
          />
        ) : (
          <>
            {/* 상단 요약 카드 */}
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="열려 있는 케이스"
                value={totalOpen}
                icon={<AlertCircle className="h-5 w-5" />}
              />
              <StatCard
                title="레이어별 분포"
                value={
                  byLayer.length
                    ? byLayer
                        .slice(0, 3)
                        .map((x) => `${x.layer}: ${x.count}`)
                        .join(", ")
                    : "-"
                }
                description="상위 3개 레이어 기준"
              />
              <StatCard
                title="심각도 분포"
                value={
                  bySeverity.length
                    ? bySeverity
                        .slice(0, 3)
                        .map((x) => `${x.severity}: ${x.count}`)
                        .join(", ")
                    : "-"
                }
                icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              />
              <StatCard
                title="최근 갱신 케이스"
                value={recentlyUpdated.length}
                description="마지막 5건 기준"
                icon={<FileWarning className="h-5 w-5" />}
              />
            </section>

            {(topServices.length > 0 || recentlyUpdated.length > 0) && (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {topServices.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      서비스별 오픈 건수 (상위 5)
                    </h3>
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-600 dark:bg-gray-700/80">
                            <th className="px-6 py-3 font-semibold text-gray-500 dark:text-gray-300">
                              Namespace / Service
                            </th>
                            <th className="px-6 py-3 font-semibold text-gray-500 text-right dark:text-gray-300">
                              건수
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-600">
                          {topServices.map((s, i) => (
                            <tr
                              key={i}
                              className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50"
                            >
                              <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                                {s.namespace || "-"} / {s.service || "-"}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-gray-600 dark:text-gray-400">
                                {s.count}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {recentlyUpdated.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        최근 갱신 (상위 5건)
                      </h3>
                      <Link
                        href="/cases"
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        전체 보기
                      </Link>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-600 dark:bg-gray-700/80">
                            <th className="px-6 py-3 font-semibold text-gray-500 dark:text-gray-300">
                              Case Key
                            </th>
                            <th className="px-6 py-3 font-semibold text-gray-500 text-right dark:text-gray-300">
                              Last seen
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-600">
                          {recentlyUpdated.map((c) => (
                            <tr
                              key={c.id}
                              className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50"
                            >
                              <td className="px-6 py-4">
                                <Link
                                  href={`/cases/${c.id}`}
                                  className="font-mono text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                  {c.case_key}
                                </Link>
                              </td>
                              <td className="px-6 py-4 text-right text-gray-500 text-xs dark:text-gray-400">
                                {formatLocalDateTime(c.last_seen_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Snapshot: 알림 없어도 동작. !hasData일 때만 여기서 버튼 표시 */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Snapshot
            </h3>
            {!hasData && (
              <button
                type="button"
                onClick={handleSnapshotRefresh}
                disabled={snapshotLoading}
                className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <RefreshCw
                  className={cn("h-4 w-4", snapshotLoading && "animate-spin")}
                />
                {snapshotLoading ? "수집 중…" : "Snapshot 새로고침"}
              </button>
            )}
          </div>
          {!homeSnapshot ? (
            <EmptyState
              title="Snapshot 없음"
              description="Snapshot 새로고침을 눌러 클러스터/레이어 상태를 수집하세요."
            />
          ) : (
            <HomeSnapshotView snapshot={homeSnapshot} />
          )}
        </section>

        {/* Layer Snapshots: infra / observability / application */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Layer Snapshots
            </h3>
            <button
              type="button"
              onClick={handleLayerSnapshotRefresh}
              disabled={layerSnapshotLoading}
              className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  layerSnapshotLoading && "animate-spin",
                )}
              />
              {layerSnapshotLoading ? "수집 중…" : "Layer Snapshot 새로고침"}
            </button>
          </div>
          <div className="flex flex-col gap-8 overflow-x-auto">
            {(
              [
                "infrastructure",
                "platform",
                "delivery",
                "observability",
                "data",
                "application",
                "ux",
              ] as const
            ).map((layer) => {
              const snap = layerSnapshots.find((s) => s.layer === layer);
              return (
                <LayerSection
                  key={layer}
                  layer={layer}
                  snapshot={snap ?? null}
                />
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function getStat(snapshot: HomeSnapshot, name: string): number | undefined {
  const v = snapshot.prom?.stats?.find((s) => s.name === name);
  return v?.value;
}

function HomeSnapshotView({ snapshot }: { snapshot: HomeSnapshot }) {
  const nodeNotReady = getStat(snapshot, "node_not_ready") ?? 0;
  const podNotReady = getStat(snapshot, "pod_not_ready") ?? 0;
  const totalPods = getStat(snapshot, "total_pods") ?? 0;
  const downTargets =
    getStat(snapshot, "down_targets") ?? getStat(snapshot, "target_down") ?? 0;
  const totalTargets = getStat(snapshot, "total_targets") ?? 0;
  const upTargets = Math.max(0, totalTargets - downTargets);
  const podRatio =
    totalPods === 0 || totalPods == null
      ? 0
      : podNotReady / Math.max(totalPods, 1);
  const targetDownRatio =
    totalTargets === 0 || totalTargets == null
      ? 0
      : downTargets / Math.max(totalTargets, 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Node Not Ready"
          value={nodeNotReady}
          icon={<AlertCircle className="h-5 w-5 text-amber-500" />}
        />
        <StatCard
          title="Pod Not Ready"
          value={podNotReady}
          description="NotReady pod 수"
          icon={<AlertCircle className="h-5 w-5 text-amber-500" />}
        />
        <StatCard
          title="Scrape Target Down"
          value={`${downTargets}/${totalTargets}`}
          description="down_targets / total_targets (up==0 타깃)"
          icon={<AlertCircle className="h-5 w-5 text-red-500" />}
        />
        <StatCard
          title="Scrape Targets Up"
          value={`${upTargets}/${totalTargets}`}
          description="up_targets / total_targets"
          icon={<AlertCircle className="h-5 w-5 text-emerald-500" />}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Pod Not Ready ratio = NotReady pod / total pod · Target down ratio =
          down_targets / total_targets
        </p>
        <div className="flex gap-4 items-center">
          <div className="flex-1 flex flex-col gap-1">
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${Math.min(100, podRatio * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Pod Not Ready: {podNotReady}/{totalPods} (
              {(podRatio * 100).toFixed(0)}%)
            </span>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-red-500 transition-all"
                style={{ width: `${Math.min(100, targetDownRatio * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Target down ratio:{" "}
              {totalTargets === 0
                ? "N/A"
                : `${downTargets}/${totalTargets} (${(targetDownRatio * 100).toFixed(0)}%)`}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Observability:
        </span>
        <HealthBadge label="Prom" status={snapshot.prom_status} />
        <HealthBadge label="Loki" status={snapshot.loki_status} />
        <HealthBadge label="Tempo" status={snapshot.tempo_status} />
      </div>
    </div>
  );
}

function HealthBadge({ label, status }: { label: string; status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        status === "ok"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
          : status === "empty"
            ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
      )}
    >
      {label}: {status === "ok" ? "ok" : status === "empty" ? "empty" : "error"}
    </span>
  );
}

/** API 응답을 안전한 형태로 정규화. prom이 null/{}이면 stats=[], series=[] */
function normalizeLayerSnapshots(
  list: HomeLayerSnapshot[],
): HomeLayerSnapshot[] {
  return list.map((s) => {
    const prom = s.prom != null && typeof s.prom === "object" ? s.prom : {};
    const stats = Array.isArray(prom.stats) ? prom.stats : [];
    const series = Array.isArray(prom.series) ? prom.series : [];
    return {
      ...s,
      layer: s.layer ?? "",
      prom_status: s.prom_status ?? "empty",
      loki_status: s.loki_status ?? "empty",
      tempo_status: s.tempo_status ?? "empty",
      prom: { ...prom, stats, series },
    };
  });
}

function getLayerStat(
  snapshot: HomeLayerSnapshot | null,
  name: string,
): number | undefined {
  const stats = snapshot?.prom?.stats;
  if (!Array.isArray(stats)) return undefined;
  const v = stats.find((s) => s.name === name);
  return v?.value;
}

function seriesToChartData(
  series: { values?: [number, string][] }[] | undefined,
): { timeLabel: string; value: number; time: string }[] {
  const first = series?.find((s) => s.values?.length);
  if (!first?.values) return [];
  return first.values.map(([ts, v]) => ({
    timeLabel: formatTimeHHmm(ts * 1000),
    value: Number(v),
    time: formatLocalDateTime(ts * 1000),
  }));
}

function seriesByName(
  series: { _metric_name?: string; values?: [number, string][] }[],
  name: string,
): { timeLabel: string; value: number; time: string }[] {
  const s = series.find((x) => x._metric_name === name);
  if (!s?.values?.length) return [];
  return s.values.map(([ts, v]) => ({
    timeLabel: formatTimeHHmm(ts * 1000),
    value: Number(v),
    time: formatLocalDateTime(ts * 1000),
  }));
}

/** down==0 green/blue, down>=1 red; ready==total green, 0<ready<total amber, ready==0 red */
function readyTotalColor(ready: number, total: number): string {
  if (total === 0) return "text-gray-500";
  if (ready === total) return "text-emerald-600 dark:text-emerald-400";
  if (ready === 0) return "text-red-600 dark:text-red-400";
  return "text-amber-600 dark:text-amber-400";
}

const LAYER_LABELS: Record<string, string> = {
  infrastructure: "Infrastructure",
  platform: "Platform",
  delivery: "Delivery",
  observability: "Observability",
  data: "Data",
  application: "Application",
  ux: "UX",
};

function LayerSection({
  layer,
  snapshot,
}: {
  layer: string;
  snapshot: HomeLayerSnapshot | null;
}) {
  const label = LAYER_LABELS[layer] ?? layer;
  const prom = snapshot?.prom != null ? snapshot.prom : {};
  const stats = Array.isArray(prom.stats) ? prom.stats : [];
  const series = (Array.isArray(prom.series) ? prom.series : []) as {
    _metric_name?: string;
    values?: [number, string][];
  }[];
  const chartData = seriesToChartData(series);
  const hasAnyData = stats.length > 0 || chartData.length > 0;
  const podRatio = (() => {
    const total = getLayerStat(snapshot, "total_pods") ?? 0;
    const notready = getLayerStat(snapshot, "notready_pods") ?? 0;
    return total === 0 ? 0 : notready / Math.max(total, 1);
  })();
  const targetRatio = (() => {
    const total = getLayerStat(snapshot, "total_targets") ?? 0;
    const down = getLayerStat(snapshot, "scrape_target_down") ?? 0;
    return total === 0 ? 0 : down / Math.max(total, 1);
  })();
  const crashloopPods = getLayerStat(snapshot, "crashloop_pods") ?? 0;

  if (snapshot == null) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h4 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
          {label}
        </h4>
        <EmptyState
          title="데이터 없음"
          description="Layer Snapshot 새로고침을 실행하세요."
        />
      </div>
    );
  }

  if (layer === "infrastructure") {
    const readyNodes = getLayerStat(snapshot, "ready_nodes") ?? 0;
    const totalNodes = getLayerStat(snapshot, "total_nodes") ?? 0;
    const readyPods = getLayerStat(snapshot, "ready_pods") ?? 0;
    const totalPods = getLayerStat(snapshot, "total_pods") ?? 0;
    const downTargets = getLayerStat(snapshot, "scrape_target_down") ?? 0;
    const totalTargets = getLayerStat(snapshot, "total_targets") ?? 0;
    const upTargets = Math.max(0, totalTargets - downTargets);
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h4 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
          {label}
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-2">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Nodes
                </p>
                <p
                  className={cn(
                    "mt-1 text-lg font-semibold",
                    readyTotalColor(readyNodes, totalNodes),
                  )}
                >
                  {readyNodes}/{totalNodes}
                </p>
                <p className="text-xs text-gray-400">
                  NotReady: {totalNodes - readyNodes}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  CrashLoop Pods
                </p>
                <p
                  className={cn(
                    "mt-1 text-lg font-semibold",
                    crashloopPods > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {crashloopPods}
                </p>
                <p className="text-xs text-gray-400">
                  waiting_reason=CrashLoopBackOff
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pods</p>
                <p
                  className={cn(
                    "mt-1 text-lg font-semibold",
                    readyTotalColor(readyPods, totalPods),
                  )}
                >
                  {readyPods}/{totalPods}
                </p>
                <p className="text-xs text-gray-400">
                  NotReady: {totalPods - readyPods}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Scrape Targets
                </p>
                <p
                  className={cn(
                    "mt-1 text-lg font-semibold",
                    upTargets === totalTargets && totalTargets > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : upTargets > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-gray-500",
                  )}
                >
                  {upTargets}/{totalTargets}
                </p>
                <p className="text-xs text-gray-400">
                  up / total (down: {downTargets})
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Pod NotReady ratio = NotReady pod / total pod
              </p>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${Math.min(100, podRatio * 100)}%` }}
                />
              </div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Target down ratio = down_targets / total_targets
              </p>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-red-500 transition-all"
                  style={{ width: `${Math.min(100, targetRatio * 100)}%` }}
                />
              </div>
            </div>
          </div>
          {chartData.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                시계열: NotReady pods (30m)
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="infraNotReadyGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.7} />
                      <stop
                        offset="100%"
                        stopColor="#bfdbfe"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-600"
                  />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fontSize: 10 }}
                    interval={Math.max(
                      0,
                      Math.floor((chartData.length - 1) / 5),
                    )}
                  />
                  <YAxis tick={{ fontSize: 10 }} width={36} />
                  <Tooltip
                    formatter={(v: number) => [
                      Number(v).toFixed(0),
                      "notready_pods",
                    ]}
                    labelFormatter={(_, p) =>
                      (p?.[0]?.payload?.time as string) ?? ""
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    fill="url(#infraNotReadyGradient)"
                    stroke="#2563eb"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (layer === "observability") {
    const grafanaUp = getLayerStat(snapshot, "grafana_up") ?? 0;
    const alertmanagerUp = getLayerStat(snapshot, "alertmanager_up") ?? 0;
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h4 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
          {label}
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <HealthBadge label="Prom" status={snapshot.prom_status} />
              <HealthBadge label="Loki" status={snapshot.loki_status} />
              <HealthBadge label="Tempo" status={snapshot.tempo_status} />
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  grafanaUp >= 1
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                    : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
                )}
              >
                Grafana: {grafanaUp >= 1 ? "ok" : "error"}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  alertmanagerUp >= 1
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                    : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
                )}
              >
                Alertmanager: {alertmanagerUp >= 1 ? "ok" : "error"}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Prom/Loki/Tempo: /ready 기반. Grafana/Alertmanager: up(job) ≥ 1
              이면 ok
            </p>
          </div>
          {chartData.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Prometheus Scrape Target Down (30m)
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                (= up==0 타깃 개수)
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="obsScrapeDownGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.7} />
                      <stop
                        offset="100%"
                        stopColor="#bfdbfe"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-600"
                  />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fontSize: 10 }}
                    interval={Math.max(
                      0,
                      Math.floor((chartData.length - 1) / 5),
                    )}
                  />
                  <YAxis tick={{ fontSize: 10 }} width={36} />
                  <Tooltip
                    formatter={(v: number) => [
                      `${Number(v).toFixed(
                        0,
                      )} (Prometheus scrape target down, up==0)`,
                      "down",
                    ]}
                    labelFormatter={(_, p) =>
                      (p?.[0]?.payload?.time as string) ?? ""
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    fill="url(#obsScrapeDownGradient)"
                    stroke="#2563eb"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (layer === "application") {
    const readyPods = getLayerStat(snapshot, "ready_pods_hp_core") ?? 0;
    const totalPods = getLayerStat(snapshot, "total_pods_hp_core") ?? 0;
    const cpuData = seriesByName(series, "cpu_cores");
    const memData = seriesByName(series, "memory_bytes");
    const APP_SERVICES = [
      "hp-frontend",
      "hp-backend-core",
      "hp-backend-booking",
      "hp-backend-queue",
      "hp-backend-worker",
    ];
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h4 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
          {label} (hp-core)
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {APP_SERVICES.map((svc) => {
                const total = getLayerStat(snapshot, `total_${svc}`) ?? 0;
                const ready = getLayerStat(snapshot, `ready_${svc}`) ?? 0;
                return (
                  <div key={svc} className="p-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {svc}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-lg font-semibold",
                        readyTotalColor(ready, total),
                      )}
                    >
                      {ready}/{total}
                    </p>
                    <p className="text-xs text-gray-400">ready / total</p>
                  </div>
                );
              })}
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pods (hp-core)
              </p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold",
                  readyTotalColor(readyPods, totalPods),
                )}
              >
                {readyPods}/{totalPods}
              </p>
              <div className="mt-3 space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Readiness ratio = ready / total
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${
                        totalPods > 0
                          ? Math.min(
                              100,
                              (readyPods / Math.max(totalPods, 1)) * 100,
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {cpuData.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  CPU (cores) = 해당 범위의 CPU 코어 사용량 합
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={cpuData}
                    margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="appCpuGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#2563eb"
                          stopOpacity={0.7}
                        />
                        <stop
                          offset="100%"
                          stopColor="#bfdbfe"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-gray-200 dark:stroke-gray-600"
                    />
                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fontSize: 10 }}
                      interval={Math.max(
                        0,
                        Math.floor((cpuData.length - 1) / 5),
                      )}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      width={42}
                      tickFormatter={(v) => Number(v).toFixed(2)}
                    />
                    <Tooltip
                      formatter={(v: number) => [formatCpuCores(v), "CPU"]}
                      labelFormatter={(_, p) =>
                        (p?.[0]?.payload?.time as string) ?? ""
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      fill="url(#appCpuGradient)"
                      stroke="#2563eb"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {memData.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  Memory = working set bytes (MiB/GiB)
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={memData}
                    margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="appMemGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#7c3aed"
                          stopOpacity={0.7}
                        />
                        <stop
                          offset="100%"
                          stopColor="#ddd6fe"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-gray-200 dark:stroke-gray-600"
                    />
                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fontSize: 10 }}
                      interval={Math.max(
                        0,
                        Math.floor((memData.length - 1) / 5),
                      )}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      width={48}
                      tickFormatter={(v) => formatBytes(Number(v))}
                    />
                    <Tooltip
                      formatter={(v: number) => [formatBytes(v), "Memory"]}
                      labelFormatter={(_, p) =>
                        (p?.[0]?.payload?.time as string) ?? ""
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      fill="url(#appMemGradient)"
                      stroke="#7c3aed"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (layer === "platform") {
    const lbcUp = getLayerStat(snapshot, "lbc_up") ?? 0;
    const istioIngressUp = getLayerStat(snapshot, "istio_ingress_up") ?? 0;
    const istiodUp = getLayerStat(snapshot, "istiod_up") ?? 0;
    const yaceUp = getLayerStat(snapshot, "yace_up") ?? 0;
    const albRequestRate = getLayerStat(snapshot, "alb_request_rate") ?? 0;
    const istio5xxRate = getLayerStat(snapshot, "istio_5xx_rate") ?? 0;
    const albSeries = seriesByName(series, "alb_5xx_rate");
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h4 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
          {label}
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { name: "AWS LBC", value: lbcUp },
                { name: "Istio Ingress", value: istioIngressUp },
                { name: "Istiod", value: istiodUp },
                { name: "YACE", value: yaceUp },
                { name: "ALB req/s", value: albRequestRate },
              ].map(({ name, value }) => (
                <div
                  key={name}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/40"
                >
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {name}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-xl font-semibold",
                      value >= 1
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {name === "ALB req/s"
                      ? value.toFixed(2)
                      : value >= 1
                        ? "ok"
                        : "down"}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ALB, Istio, YACE 상태를 한눈에 확인합니다.
            </p>
          </div>
          {albSeries.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                ALB 5xx rate (30m)
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={albSeries}
                  margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="platformAlbGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.7} />
                      <stop
                        offset="100%"
                        stopColor="#fed7aa"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-600"
                  />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fontSize: 10 }}
                    interval={Math.max(
                      0,
                      Math.floor((albSeries.length - 1) / 5),
                    )}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    width={42}
                    tickFormatter={(v) => Number(v).toFixed(3)}
                  />
                  <Tooltip
                    formatter={(v: number) => [
                      Number(v).toFixed(4),
                      "5xx rate",
                    ]}
                    labelFormatter={(_, p) =>
                      (p?.[0]?.payload?.time as string) ?? ""
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    fill="url(#platformAlbGradient)"
                    stroke="#f97316"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (layer === "delivery") {
    const argoServer = getLayerStat(snapshot, "argocd_server_up") ?? 0;
    const argoRepo = getLayerStat(snapshot, "argocd_repo_up") ?? 0;
    const argoAppCtrl = getLayerStat(snapshot, "argocd_app_ctrl_up") ?? 0;
    const jenkinsUp = getLayerStat(snapshot, "jenkins_up") ?? 0;
    const sonarUp = getLayerStat(snapshot, "sonarqube_up") ?? 0;
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h4 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
          {label}
        </h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { name: "ArgoCD Server", value: argoServer },
            { name: "ArgoCD Repo", value: argoRepo },
            { name: "ArgoCD AppCtrl", value: argoAppCtrl },
            { name: "Jenkins", value: jenkinsUp },
            { name: "SonarQube", value: sonarUp },
          ].map(({ name, value }) => (
            <div
              key={name}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/50"
            >
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {name}
              </p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold",
                  value >= 1
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {value >= 1 ? "ok" : "down"}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (layer === "data") {
    const kafkaUp = getLayerStat(snapshot, "kafka_up") ?? 0;
    const mongoUp = getLayerStat(snapshot, "mongodb_up") ?? 0;
    const mysqlUp = getLayerStat(snapshot, "mysql_up") ?? 0;
    const redisUp = getLayerStat(snapshot, "redis_up") ?? 0;
    const rdsCpuMax = getLayerStat(snapshot, "rds_cpu_max") ?? 0;
    const redisMemBytes = getLayerStat(snapshot, "redis_memory_used") ?? 0;
    const redisMemMiB = redisMemBytes / (1024 * 1024);
    const lagSeries = seriesByName(series, "kafka_consumer_lag");
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h4 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
          {label}
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { name: "Kafka", value: kafkaUp },
                { name: "MongoDB", value: mongoUp },
                { name: "MySQL", value: mysqlUp },
                { name: "Redis", value: redisUp },
                { name: "RDS CPU max", value: rdsCpuMax },
                { name: "Redis Mem (MiB)", value: redisMemMiB },
              ].map(({ name, value }) => (
                <div
                  key={name}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/40"
                >
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {name}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-xl font-semibold",
                      name === "RDS CPU max"
                        ? value >= 80
                          ? "text-red-600 dark:text-red-400"
                          : value >= 60
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        : name === "Redis Mem (MiB)"
                          ? "text-blue-600 dark:text-blue-300"
                          : value >= 1
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {name === "RDS CPU max"
                      ? `${value.toFixed(1)}%`
                      : name === "Redis Mem (MiB)"
                        ? value.toFixed(1)
                        : value >= 1
                          ? "ok"
                          : "down"}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              주요 데이터 스토어와 CPU·메모리 상태를 요약합니다.
            </p>
          </div>
          {lagSeries.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Kafka Consumer Lag (30m)
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={lagSeries}
                  margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="dataLagGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.7} />
                      <stop
                        offset="100%"
                        stopColor="#ddd6fe"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-600"
                  />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fontSize: 10 }}
                    interval={Math.max(
                      0,
                      Math.floor((lagSeries.length - 1) / 5),
                    )}
                  />
                  <YAxis tick={{ fontSize: 10 }} width={42} />
                  <Tooltip
                    formatter={(v: number) => [Number(v).toFixed(0), "lag"]}
                    labelFormatter={(_, p) =>
                      (p?.[0]?.payload?.time as string) ?? ""
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    fill="url(#dataLagGradient)"
                    stroke="#7c3aed"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (layer === "ux") {
    const eventsRate = getLayerStat(snapshot, "faro_events_rate") ?? 0;
    const exceptionRate = getLayerStat(snapshot, "faro_exception_rate") ?? 0;
    const exceptionRatio = getLayerStat(snapshot, "faro_exception_ratio") ?? 0;
    const eventsSeries = seriesByName(series, "faro_events");
    const excSeries = seriesByName(series, "faro_exceptions");
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h4 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
          {label}
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/40">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Events rate
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {eventsRate.toFixed(3)}/s
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/40">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Exception rate
                </p>
                <p
                  className={cn(
                    "mt-1 text-lg font-semibold",
                    exceptionRate > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {exceptionRate.toFixed(3)}/s
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/40">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Exception ratio
                </p>
                <p
                  className={cn(
                    "mt-1 text-lg font-semibold",
                    exceptionRatio > 0.05
                      ? "text-red-600 dark:text-red-400"
                      : exceptionRatio > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {(exceptionRatio * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              프론트엔드 RUM 이벤트와 예외 비율을 요약합니다.
            </p>
          </div>
          <div className="space-y-4">
            {eventsSeries.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  Faro Events rate (30m)
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart
                    data={eventsSeries}
                    margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="uxEventsGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#2563eb"
                          stopOpacity={0.7}
                        />
                        <stop
                          offset="100%"
                          stopColor="#bfdbfe"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-gray-200 dark:stroke-gray-600"
                    />
                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fontSize: 10 }}
                      interval={Math.max(
                        0,
                        Math.floor((eventsSeries.length - 1) / 5),
                      )}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      width={42}
                      tickFormatter={(v) => Number(v).toFixed(3)}
                    />
                    <Tooltip
                      formatter={(v: number) => [
                        Number(v).toFixed(4),
                        "events/s",
                      ]}
                      labelFormatter={(_, p) =>
                        (p?.[0]?.payload?.time as string) ?? ""
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      fill="url(#uxEventsGradient)"
                      stroke="#2563eb"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {excSeries.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  Faro Exceptions rate (30m)
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart
                    data={excSeries}
                    margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="uxExceptionsGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#dc2626"
                          stopOpacity={0.7}
                        />
                        <stop
                          offset="100%"
                          stopColor="#fecaca"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-gray-200 dark:stroke-gray-600"
                    />
                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fontSize: 10 }}
                      interval={Math.max(
                        0,
                        Math.floor((excSeries.length - 1) / 5),
                      )}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      width={42}
                      tickFormatter={(v) => Number(v).toFixed(3)}
                    />
                    <Tooltip
                      formatter={(v: number) => [
                        Number(v).toFixed(4),
                        "exceptions/s",
                      ]}
                      labelFormatter={(_, p) =>
                        (p?.[0]?.payload?.time as string) ?? ""
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      fill="url(#uxExceptionsGradient)"
                      stroke="#dc2626"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // fallback: generic stats + chart
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-200">
        {label}
      </h4>
      {!hasAnyData ? (
        <EmptyState
          title="데이터 없음"
          description="stats/series가 없습니다."
        />
      ) : (
        <>
          {stats.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.slice(0, 8).map((s) => (
                <StatCard
                  key={s.name}
                  title={String(s.name).replace(/_/g, " ")}
                  value={s.value}
                  icon={<AlertCircle className="h-5 w-5 text-gray-400" />}
                />
              ))}
            </div>
          )}
          {chartData.length > 0 && (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-600"
                  />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fontSize: 10 }}
                    interval={Math.max(
                      0,
                      Math.floor((chartData.length - 1) / 5),
                    )}
                  />
                  <YAxis tick={{ fontSize: 10 }} width={36} />
                  <Tooltip
                    formatter={(v: number) => [Number(v).toFixed(2), "value"]}
                    labelFormatter={(_, p) =>
                      (p?.[0]?.payload?.time as string) ?? ""
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    stroke="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
