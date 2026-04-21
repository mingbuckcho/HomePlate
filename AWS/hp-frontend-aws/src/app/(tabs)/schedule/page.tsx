"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { useGameStore } from "@/features/games/store";
import { getTeamTheme, getTeamThemeKey } from "@/shared/config/teamThemes";
import {
  formatMMDDHHmm,
  fromKstIso,
  getMonthCalendar,
  isGameStartPast,
} from "@/shared/utils/datetime";
import { getApiBase } from "@/shared/api/client";
import { getUpcomingGames, getGamesByTeam } from "@/shared/api/info";
import { mapGameResponseToGame } from "@/shared/api/mappers";
import { TEAMS_LIST, toTeamId } from "@/shared/constants/teams";

const YEAR = 2026 as const;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const TEAMS = TEAMS_LIST.map((t) => ({
  id: t.shortName,
  shortName: t.shortName,
  logoUrl: t.logoUrl,
}));

function getTeamLogoUrl(teamNameOrCode: string): string | undefined {
  if (!teamNameOrCode) return undefined;
  const team = TEAMS.find(
    (t) =>
      teamNameOrCode === t.id ||
      teamNameOrCode.startsWith(t.id + " ") ||
      teamNameOrCode.startsWith(t.id),
  );
  return team?.logoUrl;
}

function ScheduleContent() {
  const searchParams = useSearchParams();
  const hydrate = useGameStore((s) => s.hydrate);
  const setItems = useGameStore((s) => s.setItems);
  const listWithStatus = useGameStore((s) => s.listWithStatus);

  useEffect(() => {
    if (!getApiBase()) hydrate();
  }, [hydrate]);

  const [selectedTeam, setSelectedTeam] = useState(
    searchParams.get("team") ?? "all",
  );
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    if (!getApiBase()) return;
    const filterPast = (list: ReturnType<typeof mapGameResponseToGame>[]) =>
      list.filter((g) => !isGameStartPast(g.gameAtISO));
    if (selectedTeam === "all") {
      getUpcomingGames()
        .then((list) => setItems(filterPast(list.map(mapGameResponseToGame))))
        .catch(() => {});
    } else {
      const teamId = toTeamId(selectedTeam);
      getGamesByTeam(teamId, selectedDate || undefined)
        .then((list) => setItems(filterPast(list.map(mapGameResponseToGame))))
        .catch(() => {});
    }
  }, [selectedTeam, selectedDate, setItems]);

  const items = useMemo(() => {
    const g = listWithStatus();
    return [...g].sort(
      (a, b) =>
        new Date(a.gameAtISO).getTime() - new Date(b.gameAtISO).getTime(),
    );
  }, [listWithStatus]);

  const initialTeam = searchParams.get("team") ?? "all";
  const [view, setView] = useState<"list" | "calendar">("list");
  const [mounted, setMounted] = useState(false);
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => ({
    year: YEAR,
    month: 3,
  }));
  useEffect(() => {
    setMounted(true);
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }, []);

  useEffect(() => {
    const t = searchParams.get("team");
    if (t) setSelectedTeam(t);
  }, [searchParams]);

  const teamFiltered = useMemo(() => {
    return items.filter((g) => {
      if (selectedTeam === "all") return true;
      const homeCode = getTeamThemeKey(g.homeTeam);
      const awayCode = getTeamThemeKey(g.awayTeam);
      return homeCode === selectedTeam || awayCode === selectedTeam;
    });
  }, [items, selectedTeam]);

  const filtered = useMemo(() => {
    return teamFiltered.filter((g) => {
      const { date } = fromKstIso(g.gameAtISO);
      return date === selectedDate;
    });
  }, [teamFiltered, selectedDate]);

  const groupedByMonth = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const g of items) {
      const { date } = fromKstIso(g.gameAtISO);
      const monthKey = date.slice(0, 7);
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey)!.push(g);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.gameAtISO).getTime() - new Date(b.gameAtISO).getTime(),
      );
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const groupedByMonthFiltered = useMemo(() => {
    const map = new Map<string, typeof teamFiltered>();
    for (const g of teamFiltered) {
      const { date } = fromKstIso(g.gameAtISO);
      const monthKey = date.slice(0, 7);
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey)!.push(g);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.gameAtISO).getTime() - new Date(b.gameAtISO).getTime(),
      );
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [teamFiltered]);

  const listSections = useMemo((): Array<{
    monthKey: string;
    games: typeof items;
  }> => {
    if (selectedDate) {
      const onDate = teamFiltered.filter((g) => {
        const { date } = fromKstIso(g.gameAtISO);
        return date === selectedDate;
      });
      return onDate.length ? [{ monthKey: selectedDate, games: onDate }] : [];
    }
    return groupedByMonthFiltered.map(([monthKey, games]) => ({
      monthKey,
      games,
    }));
  }, [selectedDate, teamFiltered, groupedByMonthFiltered]);

  const gamesByDate = useMemo(() => {
    const map = new Map<string, typeof teamFiltered>();
    for (const g of teamFiltered) {
      const { date } = fromKstIso(g.gameAtISO);
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(g);
    }
    return map;
  }, [teamFiltered]);

  const calendarGrid = useMemo(
    () => getMonthCalendar(cursor.year, cursor.month),
    [cursor],
  );

  const goPrevMonth = () => {
    if (cursor.month === 1) setCursor({ year: cursor.year - 1, month: 12 });
    else setCursor({ year: cursor.year, month: cursor.month - 1 });
  };

  const goNextMonth = () => {
    if (cursor.month === 12) setCursor({ year: cursor.year + 1, month: 1 });
    else setCursor({ year: cursor.year, month: cursor.month + 1 });
  };

  const dateKey = (day: number) =>
    `${cursor.year}-${String(cursor.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const handleCalendarDayClick = (key: string) => {
    setSelectedDate(key);
    setView("list");
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="mb-10">
        <h1 className="text-4xl font-black uppercase tracking-tighter text-[var(--text-primary)] md:text-5xl">
          Match Center
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          원하는 팀과 날짜를 선택하여 경기를 확인하세요.
        </p>
      </div>

      {/* 팀 + 날짜 필터 (Google 스타일) */}
      <div className="mb-10 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-xl shadow-slate-200/50 md:p-8">
        <div className="mb-6">
          <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Select Team
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11">
            <button
              type="button"
              onClick={() => setSelectedTeam("all")}
              className={cn(
                "rounded-xl px-3 py-2.5 text-xs font-bold transition",
                selectedTeam === "all"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--page-bg)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]",
              )}
            >
              전체
            </button>
            {TEAMS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTeam(t.id)}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-xs font-bold transition whitespace-nowrap",
                  selectedTeam === t.id
                    ? "bg-slate-900 text-white shadow-lg dark:bg-[var(--accent)]"
                    : "bg-[var(--page-bg)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]",
                )}
              >
                {t.shortName}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[160px]">
            <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-base w-full rounded-2xl px-4 py-3.5 font-bold focus:ring-4 focus:ring-[var(--accent-muted)]"
            />
          </div>
          {view === "list" && selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate("")}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] px-4 py-3.5 text-sm font-bold text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            >
              전체 월별 보기
            </button>
          )}
          <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--page-bg)] p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-bold transition",
                view === "list"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              )}
            >
              리스트
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-bold transition",
                view === "calendar"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              )}
            >
              달력
            </button>
          </div>
        </div>
      </div>

      {view === "calendar" && (
        <div className="mt-8">
          <div className="flex items-center justify-between rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-4 shadow-sm">
            <button
              type="button"
              onClick={goPrevMonth}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--page-bg)] transition hover:bg-[var(--surface-hover)]"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {cursor.year}년 {cursor.month}월
            </span>
            <button
              type="button"
              onClick={goNextMonth}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--page-bg)] transition hover:bg-[var(--surface-hover)]"
              aria-label="다음 달"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-sm">
            <div className="grid grid-cols-7 border-b border-[var(--border-subtle)] bg-[var(--page-bg)] py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {WEEKDAYS.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-[var(--border-subtle)] p-px">
              {calendarGrid.flat().map((day, i) => {
                if (day === null)
                  return (
                    <div
                      key={i}
                      className="aspect-square min-w-0 bg-[var(--surface)]"
                    />
                  );
                const key = dateKey(day);
                const dayGames = (gamesByDate.get(key) ?? []).slice(0, 5);
                const hasGames = dayGames.length > 0;
                const isSelected = key === selectedDate;
                return (
                  <div
                    key={`${key}-${i}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleCalendarDayClick(key)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleCalendarDayClick(key)
                    }
                    className={cn(
                      "flex aspect-square min-w-0 cursor-pointer flex-col rounded-lg bg-[var(--surface)] p-2 text-sm transition hover:bg-[var(--surface-hover)]",
                      isSelected && "ring-2 ring-[var(--accent)] ring-inset",
                      !hasGames &&
                        "items-center justify-center text-[var(--text-muted)]",
                    )}
                  >
                    <span
                      className={cn(
                        "text-center font-bold",
                        isSelected && "text-[var(--accent)]",
                      )}
                    >
                      {day}
                    </span>
                    {hasGames && (
                      <div className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                        {dayGames.map((gm) => (
                          <Link
                            key={gm.id}
                            href={`/games/${gm.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="truncate rounded bg-[var(--page-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-primary)] hover:bg-[var(--accent-muted)]"
                          >
                            {gm.awayTeam} vs {gm.homeTeam}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
            날짜를 클릭하면 해당 일자 경기로 이동합니다.
          </p>
        </div>
      )}

      {view === "list" && (
        <div className="space-y-10">
          <p className="text-center text-xs text-[var(--text-muted)]">
            특정 날짜만 보려면 상단 Select Date에서 날짜를 선택하세요.
          </p>
          {!mounted ? (
            <section className="space-y-4">
              <h2 className="sticky top-0 z-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-3 text-lg font-black uppercase tracking-tight text-[var(--text-primary)] shadow-sm">
                2026년 3월
              </h2>
              <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-[var(--border-subtle)] bg-[var(--surface)] py-20">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--page-bg)]">
                  <span className="text-3xl text-[var(--text-muted)]">🔍</span>
                </div>
                <h3 className="text-xl font-black uppercase text-[var(--text-primary)]">
                  로딩 중
                </h3>
              </div>
            </section>
          ) : listSections.length > 0 ? (
            listSections.map(({ monthKey, games }) => {
              const sectionTitle =
                monthKey.length === 7
                  ? `${monthKey.slice(0, 4)}년 ${Number(monthKey.slice(5, 7))}월`
                  : `선택한 날짜 ${monthKey.slice(0, 4)}.${monthKey.slice(5, 7)}.${monthKey.slice(8, 10)}`;
              return (
                <section key={monthKey} className="space-y-4">
                  <h2 className="sticky top-0 z-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-3 text-lg font-black uppercase tracking-tight text-[var(--text-primary)] shadow-sm">
                    {sectionTitle}
                  </h2>
                  <div className="space-y-6">
                    {games.map((g) => (
                      <div
                        key={g.id}
                        className="flex flex-col overflow-hidden rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-sm transition hover:shadow-xl md:flex-row"
                      >
                        <div className="flex w-full items-center justify-center gap-6 border-b border-[var(--border-subtle)] bg-[var(--page-bg)] py-8 md:w-56 md:flex-col md:border-b-0 md:border-r">
                          <span className="text-3xl font-black italic tracking-tighter text-[var(--text-primary)] md:text-4xl">
                            {formatMMDDHHmm(g.gameAtISO).split(" ")[1] ?? ""}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                            {g.stadium}
                          </span>
                        </div>
                        <div className="flex flex-1 flex-wrap items-center justify-around gap-6 p-8">
                          <div className="flex flex-col items-center gap-3">
                            <div
                              className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.25rem] shadow-inner"
                              style={{
                                backgroundColor: getTeamTheme(g.homeTeam)
                                  .primary,
                              }}
                            >
                              {getTeamLogoUrl(g.homeTeam) ? (
                                <Image
                                  src={getTeamLogoUrl(g.homeTeam)!}
                                  alt=""
                                  fill
                                  sizes="80px"
                                  className="object-contain p-2"
                                />
                              ) : (
                                <span className="text-2xl font-black text-[var(--text-muted)]">
                                  {g.homeTeam.slice(0, 1)}
                                </span>
                              )}
                            </div>
                            <span className="text-lg font-black tracking-tight text-[var(--text-primary)]">
                              {g.homeTeam}
                            </span>
                            <span className="rounded-full bg-[var(--accent-muted)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
                              Home
                            </span>
                          </div>
                          <span className="text-4xl font-black italic text-[var(--text-muted)]">
                            VS
                          </span>
                          <div className="flex flex-col items-center gap-3">
                            <div
                              className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.25rem] shadow-inner"
                              style={{
                                backgroundColor: getTeamTheme(g.awayTeam)
                                  .primary,
                              }}
                            >
                              {getTeamLogoUrl(g.awayTeam) ? (
                                <Image
                                  src={getTeamLogoUrl(g.awayTeam)!}
                                  alt=""
                                  fill
                                  sizes="80px"
                                  className="object-contain p-2"
                                />
                              ) : (
                                <span className="text-2xl font-black text-[var(--text-muted)]">
                                  {g.awayTeam.slice(0, 1)}
                                </span>
                              )}
                            </div>
                            <span className="text-lg font-black tracking-tight text-[var(--text-primary)]">
                              {g.awayTeam}
                            </span>
                            <span className="rounded-full bg-[var(--page-bg)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                              Away
                            </span>
                          </div>
                        </div>
                        <div className="flex w-full flex-col justify-center gap-4 bg-slate-900 px-8 py-8 md:w-72">
                          <div className="text-center">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                              General Ticket
                            </span>
                            <p className="mt-1 text-xl font-black text-white">
                              예매 오픈
                            </p>
                          </div>
                          <Link
                            href={`/games/${g.id}`}
                            className="rounded-2xl bg-[var(--accent)] py-4 text-center text-sm font-black uppercase tracking-widest text-white shadow-xl transition hover:opacity-90"
                          >
                            예매하기
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-[var(--border-subtle)] bg-[var(--surface)] py-20">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--page-bg)]">
                <span className="text-3xl text-[var(--text-muted)]">🔍</span>
              </div>
              <h3 className="text-xl font-black uppercase text-[var(--text-primary)]">
                해당 경기가 없습니다
              </h3>
              <p className="mt-2 text-[var(--text-muted)]">
                {selectedDate
                  ? "선택한 날짜에 경기가 없습니다. 날짜를 바꿔 보세요."
                  : "팀을 바꿔 보세요."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-[var(--text-muted)]">로딩 중…</div>
        </div>
      }
    >
      <ScheduleContent />
    </Suspense>
  );
}
