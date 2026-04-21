"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getApiBase } from "@/shared/api/client";
import { getRankings } from "@/shared/api/info";
import type { TeamRankingResponse } from "@/shared/api/types";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/shared/utils/cn";
import {
  RECORD_EXTERNAL_LABEL,
  RECORD_EXTERNAL_URL,
} from "@/shared/constants/externalLinks";
import { getTeamTheme } from "@/shared/config/teamThemes";
import {
  TEAM_SHORT_TO_ID,
  getTeamLogoUrl as getTeamLogoPath,
} from "@/shared/constants/teams";

function getTeamLogoUrl(team: string): string | undefined {
  const teamId = TEAM_SHORT_TO_ID[team] ?? team;
  return teamId ? getTeamLogoPath(teamId) : undefined;
}

type TeamRow = {
  rank: number;
  team: string;
  w: number;
  l: number;
  d: number;
  pct: number;
  gb: number;
  streak: string;
  recent: string[];
};

type TeamRecordRow = {
  team: string;
  gp: number;
  r: number;
  ra: number;
  rd: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  era: number;
  whip: number;
};

const YEAR = 2026 as const;

function f1(n: number) {
  return n.toFixed(1);
}
function f2(n: number) {
  return n.toFixed(2);
}
function f3(n: number) {
  return n.toFixed(3);
}

export default function RanksPage() {
  const [tab, setTab] = useState<"rank" | "record">("rank");
  const [teamFilter, setTeamFilter] = useState<string>("전체 팀");
  const [filterOpen, setFilterOpen] = useState(false);
  const [rankingsFromApi, setRankingsFromApi] = useState<
    TeamRankingResponse[] | null
  >(null);

  useEffect(() => {
    if (!getApiBase()) return;
    getRankings()
      .then(setRankingsFromApi)
      .catch(() => setRankingsFromApi(null));
  }, []);

  const teams = useMemo(
    () => [
      "전체 팀",
      "LG",
      "KT",
      "SSG",
      "NC",
      "두산",
      "KIA",
      "롯데",
      "삼성",
      "한화",
      "키움",
    ],
    [],
  );

  const standings: TeamRow[] = useMemo(() => {
    if (getApiBase() && rankingsFromApi?.length) {
      return rankingsFromApi.map((r) => ({
        rank: r.rankNo,
        team: r.teamName,
        w: r.win,
        l: r.loss,
        d: r.draw,
        pct: Number(r.winRate) || 0,
        gb: Number(r.gameBehind) || 0,
        streak: "",
        recent: [] as string[],
      }));
    }
    return [
      {
        rank: 1,
        team: "LG",
        w: 8,
        l: 4,
        d: 0,
        pct: 0.667,
        gb: 0.0,
        streak: "2W",
        recent: ["W", "W", "L", "W", "W"],
      },
      {
        rank: 2,
        team: "KT",
        w: 7,
        l: 5,
        d: 0,
        pct: 0.583,
        gb: 1.0,
        streak: "1L",
        recent: ["W", "L", "W", "L", "W"],
      },
      {
        rank: 3,
        team: "SSG",
        w: 7,
        l: 5,
        d: 0,
        pct: 0.583,
        gb: 1.0,
        streak: "3W",
        recent: ["L", "W", "L", "W", "L"],
      },
      {
        rank: 4,
        team: "NC",
        w: 6,
        l: 5,
        d: 1,
        pct: 0.545,
        gb: 1.5,
        streak: "1W",
        recent: ["W", "W", "W", "L", "L"],
      },
      {
        rank: 5,
        team: "두산",
        w: 6,
        l: 6,
        d: 0,
        pct: 0.5,
        gb: 2.0,
        streak: "2L",
        recent: ["L", "L", "W", "W", "W"],
      },
      {
        rank: 6,
        team: "KIA",
        w: 5,
        l: 6,
        d: 1,
        pct: 0.455,
        gb: 2.5,
        streak: "1W",
        recent: ["W", "L", "L", "W", "L"],
      },
      {
        rank: 7,
        team: "롯데",
        w: 5,
        l: 7,
        d: 0,
        pct: 0.417,
        gb: 3.0,
        streak: "1L",
        recent: ["L", "W", "W", "L", "W"],
      },
      {
        rank: 8,
        team: "삼성",
        w: 4,
        l: 7,
        d: 1,
        pct: 0.364,
        gb: 3.5,
        streak: "2W",
        recent: ["W", "L", "L", "L", "W"],
      },
      {
        rank: 9,
        team: "한화",
        w: 4,
        l: 8,
        d: 0,
        pct: 0.333,
        gb: 4.0,
        streak: "3L",
        recent: ["L", "L", "W", "W", "L"],
      },
      {
        rank: 10,
        team: "키움",
        w: 3,
        l: 8,
        d: 1,
        pct: 0.273,
        gb: 4.5,
        streak: "1W",
        recent: ["W", "W", "L", "L", "L"],
      },
    ];
  }, [rankingsFromApi]);

  const chartData = useMemo(
    () =>
      [...standings]
        .sort((a, b) => b.pct - a.pct)
        .map((team) => ({
          name: team.team,
          winRate: team.pct,
          color: getTeamTheme(team.team).primary,
        })),
    [standings],
  );

  const teamRecords: TeamRecordRow[] = useMemo(
    () => [
      {
        team: "LG",
        gp: 12,
        r: 62,
        ra: 45,
        rd: 17,
        avg: 0.278,
        obp: 0.351,
        slg: 0.428,
        ops: 0.779,
        era: 3.21,
        whip: 1.19,
      },
      {
        team: "KT",
        gp: 12,
        r: 55,
        ra: 49,
        rd: 6,
        avg: 0.265,
        obp: 0.338,
        slg: 0.401,
        ops: 0.739,
        era: 3.58,
        whip: 1.25,
      },
      {
        team: "SSG",
        gp: 12,
        r: 58,
        ra: 51,
        rd: 7,
        avg: 0.271,
        obp: 0.343,
        slg: 0.412,
        ops: 0.755,
        era: 3.66,
        whip: 1.28,
      },
      {
        team: "NC",
        gp: 12,
        r: 52,
        ra: 50,
        rd: 2,
        avg: 0.262,
        obp: 0.337,
        slg: 0.396,
        ops: 0.733,
        era: 3.74,
        whip: 1.27,
      },
      {
        team: "두산",
        gp: 12,
        r: 49,
        ra: 48,
        rd: 1,
        avg: 0.257,
        obp: 0.331,
        slg: 0.389,
        ops: 0.72,
        era: 3.88,
        whip: 1.3,
      },
      {
        team: "KIA",
        gp: 12,
        r: 46,
        ra: 47,
        rd: -1,
        avg: 0.251,
        obp: 0.325,
        slg: 0.381,
        ops: 0.706,
        era: 3.95,
        whip: 1.33,
      },
      {
        team: "롯데",
        gp: 12,
        r: 44,
        ra: 52,
        rd: -8,
        avg: 0.248,
        obp: 0.322,
        slg: 0.372,
        ops: 0.694,
        era: 4.22,
        whip: 1.38,
      },
      {
        team: "삼성",
        gp: 12,
        r: 41,
        ra: 53,
        rd: -12,
        avg: 0.242,
        obp: 0.316,
        slg: 0.366,
        ops: 0.682,
        era: 4.35,
        whip: 1.4,
      },
      {
        team: "한화",
        gp: 12,
        r: 39,
        ra: 57,
        rd: -18,
        avg: 0.236,
        obp: 0.309,
        slg: 0.354,
        ops: 0.663,
        era: 4.58,
        whip: 1.45,
      },
      {
        team: "키움",
        gp: 12,
        r: 36,
        ra: 59,
        rd: -23,
        avg: 0.228,
        obp: 0.301,
        slg: 0.341,
        ops: 0.642,
        era: 4.86,
        whip: 1.51,
      },
    ],
    [],
  );

  const filteredStandings = useMemo(() => {
    if (teamFilter === "전체 팀") return standings;
    return standings.filter((r) => r.team === teamFilter);
  }, [standings, teamFilter]);

  const filteredRecords = useMemo(() => {
    if (teamFilter === "전체 팀") return teamRecords;
    return teamRecords.filter((r) => r.team === teamFilter);
  }, [teamRecords, teamFilter]);

  /** 팀 기록 탭용: 팀별 득실차 막대 그래프 (팀 순위 승률 그래프와 같은 위치/스타일) */
  const recordChartData = useMemo(
    () =>
      (teamFilter === "전체 팀"
        ? teamRecords
        : teamRecords.filter((r) => r.team === teamFilter)
      )
        .sort((a, b) => b.rd - a.rd)
        .map((r) => ({
          name: r.team,
          rd: r.rd,
          color: getTeamTheme(r.team).primary,
        })),
    [teamRecords, teamFilter],
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="mb-10">
        <h1 className="text-4xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
          Team Standings
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          {YEAR} KBO 정규리그 순위표 (더미 데이터)
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("rank")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              tab === "rank"
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]",
            )}
          >
            팀 순위
          </button>
          <button
            type="button"
            onClick={() => setTab("record")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              tab === "record"
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]",
            )}
          >
            팀 기록
          </button>
        </div>
        <div className="relative flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-muted)]">
            필터
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className="input-base flex h-10 min-w-[120px] items-center justify-between rounded-xl px-3 text-left text-sm"
            >
              <span>{teamFilter}</span>
              <span className="text-[var(--text-muted)]" aria-hidden>
                {filterOpen ? "▲" : "▼"}
              </span>
            </button>
            {filterOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setFilterOpen(false)}
                />
                <ul
                  className="absolute top-full left-0 z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[var(--border-subtle)] bg-white py-1 shadow-lg dark:bg-gray-900 dark:border-gray-700"
                  role="listbox"
                >
                  {teams.map((t) => (
                    <li key={t} role="option" aria-selected={teamFilter === t}>
                      <button
                        type="button"
                        onClick={() => {
                          setTeamFilter(t);
                          setFilterOpen(false);
                        }}
                        className={cn(
                          "flex w-full px-3 py-2 text-left text-sm font-medium transition",
                          teamFilter === t
                            ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                            : "text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800",
                        )}
                      >
                        {t}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-3">
        {tab === "rank" ? (
          <>
            <div className="xl:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-sm">
                <table className="w-full text-left text-sm text-[var(--text-primary)]">
                  <thead className="bg-slate-900 text-xs font-bold uppercase text-white">
                    <tr>
                      <th className="px-6 py-5">순위</th>
                      <th className="px-6 py-5">팀</th>
                      <th className="px-6 py-5">경기</th>
                      <th className="px-6 py-5">승</th>
                      <th className="px-6 py-5">패</th>
                      <th className="px-6 py-5">무</th>
                      <th className="px-6 py-5">승률</th>
                      <th className="px-6 py-5">최근 5경기</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {filteredStandings.map((r) => (
                      <tr
                        key={r.team}
                        className="transition hover:bg-[var(--page-bg)]"
                      >
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg font-black",
                              r.rank <= 3
                                ? "bg-blue-900 text-white dark:bg-[var(--accent)]"
                                : "bg-[var(--page-bg)] text-[var(--text-muted)]",
                            )}
                          >
                            {r.rank}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg">
                              {getTeamLogoUrl(r.team) ? (
                                <Image
                                  src={getTeamLogoUrl(r.team)!}
                                  alt=""
                                  fill
                                  sizes="48px"
                                  className="object-contain p-1"
                                />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-sm">
                                  ⚾
                                </span>
                              )}
                            </div>
                            <span className="font-bold">{r.team}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-[var(--text-muted)]">
                          {r.w + r.l + r.d}
                        </td>
                        <td className="px-6 py-4 font-bold text-blue-600">
                          {r.w}
                        </td>
                        <td className="px-6 py-4 font-bold text-red-600">
                          {r.l}
                        </td>
                        <td className="px-6 py-4 font-medium text-[var(--text-muted)]">
                          {r.d}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold">
                          {(r.pct * 100).toFixed(1)}%
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            {r.recent.map((res, i) => (
                              <span
                                key={i}
                                className={cn(
                                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                                  res === "W"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                                )}
                              >
                                {res}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="space-y-6">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-sm">
                <h3 className="mb-6 flex items-center gap-2 text-lg font-bold uppercase text-[var(--text-primary)]">
                  <span className="text-[var(--accent)]">▣</span> Win Rate
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ left: 0, right: 20 }}
                    >
                      <XAxis type="number" domain={[0, 1]} hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={36}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fontWeight: "bold" }}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--page-bg)" }}
                        formatter={(value: number) => [
                          typeof value === "number"
                            ? (value * 100).toFixed(1) + "%"
                            : value,
                          "승률",
                        ]}
                      />
                      <Bar dataKey="winRate" radius={[0, 4, 4, 0]} barSize={18}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
                  상위권 팀들의 승률 경쟁이 치열합니다.
                </p>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-6 text-white">
                <div className="relative z-10">
                  <h3 className="mb-2 text-lg font-bold">
                    기록의 스포츠, 야구
                  </h3>
                  <p className="mb-6 text-sm leading-relaxed text-slate-400">
                    상세 타율·방어율 등은 KBO 기록실에서 확인하세요.
                  </p>
                  <a
                    href={RECORD_EXTERNAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
                  >
                    상세 데이터 분석
                  </a>
                </div>
                <span
                  className="absolute -bottom-6 -right-6 text-8xl opacity-10"
                  aria-hidden
                >
                  ⚾
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="xl:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-sm md:p-6">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm text-[var(--text-primary)]">
                    <thead className="text-xs text-[var(--text-muted)]">
                      <tr className="border-b border-[var(--border-subtle)]">
                        <th className="py-3 pr-4">팀</th>
                        <th className="py-3 pr-4">경기</th>
                        <th className="py-3 pr-4">득점</th>
                        <th className="py-3 pr-4">실점</th>
                        <th className="py-3 pr-4">득실차</th>
                        <th className="py-3 pr-4">타율</th>
                        <th className="py-3 pr-4">출루율</th>
                        <th className="py-3 pr-4">장타율</th>
                        <th className="py-3 pr-4">OPS</th>
                        <th className="py-3 pr-4">ERA</th>
                        <th className="py-3">WHIP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((r) => (
                        <tr
                          key={r.team}
                          className="border-b border-[var(--border-subtle)] last:border-b-0"
                        >
                          <td className="py-4 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md">
                                {getTeamLogoUrl(r.team) ? (
                                  <Image
                                    src={getTeamLogoUrl(r.team)!}
                                    alt=""
                                    fill
                                    sizes="28px"
                                    className="object-contain p-0.5"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-xs">
                                    ⚾
                                  </span>
                                )}
                              </div>
                              <span className="text-sm font-semibold">
                                {r.team}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 pr-4">{r.gp}</td>
                          <td className="py-4 pr-4">{r.r}</td>
                          <td className="py-4 pr-4">{r.ra}</td>
                          <td
                            className={cn(
                              "py-4 pr-4 font-semibold",
                              r.rd >= 0
                                ? "text-[var(--text-primary)]"
                                : "text-[var(--text-muted)]",
                            )}
                          >
                            {r.rd >= 0 ? `+${r.rd}` : r.rd}
                          </td>
                          <td className="py-4 pr-4">{f3(r.avg)}</td>
                          <td className="py-4 pr-4">{f3(r.obp)}</td>
                          <td className="py-4 pr-4">{f3(r.slg)}</td>
                          <td className="py-4 pr-4 font-semibold">
                            {f3(r.ops)}
                          </td>
                          <td className="py-4 pr-4">{f1(r.era)}</td>
                          <td className="py-4">{f2(r.whip)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-sm">
                <h3 className="mb-6 flex items-center gap-2 text-lg font-bold uppercase text-[var(--text-primary)]">
                  <span className="text-[var(--accent)]">▣</span> 득실차
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={recordChartData}
                      layout="vertical"
                      margin={{ left: 0, right: 20 }}
                    >
                      <XAxis
                        type="number"
                        domain={["auto", "auto"]}
                        tickFormatter={(v) => (v >= 0 ? `+${v}` : String(v))}
                        hide
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={36}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fontWeight: "bold" }}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--page-bg)" }}
                        formatter={(value: number) => [
                          typeof value === "number"
                            ? value >= 0
                              ? `+${value}`
                              : String(value)
                            : value,
                          "득실차",
                        ]}
                      />
                      <Bar dataKey="rd" radius={[0, 4, 4, 0]} barSize={18}>
                        {recordChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
                  팀별 득점-실점 차이입니다.
                </p>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-6 text-white">
                <div className="relative z-10">
                  <h3 className="mb-2 text-lg font-bold">
                    기록의 스포츠, 야구
                  </h3>
                  <p className="mb-6 text-sm leading-relaxed text-slate-400">
                    상세 타율·방어율 등은 KBO 기록실에서 확인하세요.
                  </p>
                  <a
                    href={RECORD_EXTERNAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
                  >
                    상세 데이터 분석
                  </a>
                </div>
                <span
                  className="absolute -bottom-6 -right-6 text-8xl opacity-10"
                  aria-hidden
                >
                  ⚾
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <a
          href={RECORD_EXTERNAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition"
        >
          상세 데이터 분석
          <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
            → {RECORD_EXTERNAL_LABEL}
          </span>
        </a>
        <span className="text-xs text-[var(--text-muted)]">
          * 백엔드 연동 시 팀 순위/팀 기록 API 응답으로 대체하면 됩니다.
        </span>
      </div>
    </div>
  );
}
