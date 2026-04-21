"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { useGameStore } from "@/features/games/store";
import { getApiBase } from "@/shared/api/client";
import { getUpcomingGames, getNewsList } from "@/shared/api/info";
import { mapGameResponseToGame } from "@/shared/api/mappers";
import type { NewsResponse } from "@/shared/api/types";
import { formatMMDDHHmm, isGameStartPast } from "@/shared/utils/datetime";
import { toPublicImageUrl } from "@/shared/utils/imageUrl";
import { getTeamTheme, getTeamThemeKey } from "@/shared/config/teamThemes";
import { hexToRgb } from "@/shared/utils/color";
import { TEAMS_LIST, TEAM_SHORT_TO_ID } from "@/shared/constants/teams";

const YEAR = 2026;

const TEAMS = TEAMS_LIST.map((t) => ({
  code: t.id,
  label: t.shortName,
  fullName: t.fullName,
  logoUrl: t.logoUrl,
}));

/** 구단 코드 또는 표기명(예: "LG 트윈스", "삼성 라이온즈") → 로고 경로 */
function teamLogo(teamNameOrCode: string) {
  const themeKey = getTeamThemeKey(teamNameOrCode) || teamNameOrCode;
  const teamId = TEAM_SHORT_TO_ID[themeKey] ?? themeKey;
  return TEAMS.find((t) => t.code === teamId)?.logoUrl;
}

export default function HomePage() {
  const router = useRouter();
  const hydrate = useGameStore((s) => s.hydrate);
  const setItems = useGameStore((s) => s.setItems);
  const games = useGameStore((s) => s.listWithStatus);
  const [mounted, setMounted] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [heroBg, setHeroBg] = useState("/hero/stadium-home.jpg");
  const [beyondImg, setBeyondImg] = useState("/hero/beyond-outfield.png");
  const [news, setNews] = useState<NewsResponse[]>([]);
  const [newsExpanded, setNewsExpanded] = useState(false);

  useEffect(() => {
    if (!getApiBase()) hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (getApiBase()) {
      getUpcomingGames()
        .then((list) =>
          setItems(
            list
              .map(mapGameResponseToGame)
              .filter((g) => !isGameStartPast(g.gameAtISO)),
          ),
        )
        .catch(() => {});
    }
  }, [setItems]);

  useEffect(() => {
    if (getApiBase()) {
      getNewsList()
        .then(setNews)
        .catch(() => setNews([]));
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const list = useMemo(() => {
    const items = games();
    return [...items].sort(
      (a, b) =>
        new Date(a.gameAtISO).getTime() - new Date(b.gameAtISO).getTime(),
    );
  }, [games]);

  /** 상단 히어로 캐러셀용 5경기 (백엔드에서만) */
  const heroListToRender = useMemo(
    () => (mounted && list.length > 0 ? list.slice(0, 5) : []),
    [mounted, list],
  );
  const recentFive = useMemo(
    () => (mounted ? list.slice(0, 5) : []),
    [mounted, list],
  );

  const featuredMatch =
    heroListToRender[heroIndex] ?? heroListToRender[0] ?? null;
  const heroCount = heroListToRender.length;

  const goPrev = () => setHeroIndex((i) => (i <= 0 ? heroCount - 1 : i - 1));
  const goNext = () => setHeroIndex((i) => (i >= heroCount - 1 ? 0 : i + 1));

  // 5초마다 자동으로 다음 경기로
  useEffect(() => {
    if (heroCount <= 1) return;
    const id = setInterval(() => {
      setHeroIndex((i) => (i >= heroCount - 1 ? 0 : i + 1));
    }, 5000);
    return () => clearInterval(id);
  }, [heroCount]);

  return (
    <div className="w-full overflow-x-hidden">
      {/* ─── Hero: 5경기 캐러셀 (백엔드 데이터만) ─── */}
      <section className="relative min-h-[90vh] w-full overflow-hidden bg-black">
        {heroCount === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-white/90">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60">
              Upcoming
            </span>
            <p className="text-center text-lg font-semibold md:text-xl">
              다가오는 경기가 없습니다.
            </p>
          </div>
        )}
        {/* 배경: 현재 슬라이드 팀 컬러 */}
        {featuredMatch && (
          <>
            <div
              className="absolute inset-y-0 left-0 w-1/2 opacity-15 blur-[100px] transition-colors duration-300"
              style={{
                backgroundColor: hexToRgb(
                  getTeamTheme(featuredMatch.homeTeam).primary,
                ),
              }}
            />
            <div
              className="absolute inset-y-0 right-0 w-1/2 opacity-15 blur-[100px] transition-colors duration-300"
              style={{
                backgroundColor: hexToRgb(
                  getTeamTheme(featuredMatch.awayTeam).primary,
                ),
              }}
            />
          </>
        )}
        <Image
          src={heroBg}
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover opacity-35 mix-blend-screen"
          onError={() => setHeroBg("/hero/hero-1.png")}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--page-bg)] via-[var(--page-bg)]/20 to-transparent" />

        {/* 좌우 네비 버튼 */}
        {heroCount > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white shadow-lg backdrop-blur-sm transition hover:scale-110 hover:bg-[var(--accent)] hover:border-[var(--accent)] md:left-4 md:h-14 md:w-14"
              aria-label="이전 경기"
            >
              <ChevronLeft className="h-6 w-6 md:h-7 md:w-7" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white shadow-lg backdrop-blur-sm transition hover:scale-110 hover:bg-[var(--accent)] hover:border-[var(--accent)] md:right-4 md:h-14 md:w-14"
              aria-label="다음 경기"
            >
              <ChevronRight className="h-6 w-6 md:h-7 md:w-7" />
            </button>
          </>
        )}

        {/* 캐러셀 트랙: 5경기 슬라이드, 빠른 전환 + 터치 스와이프 */}
        <div
          className="absolute inset-0 z-20 overflow-hidden touch-pan-y"
          onTouchStart={(e) =>
            setTouchStartX(e.changedTouches[0]?.pageX ?? null)
          }
          onTouchEnd={(e) => {
            const endX = e.changedTouches[0]?.pageX;
            if (touchStartX == null || endX == null) return;
            const diff = touchStartX - endX;
            if (Math.abs(diff) > 50) {
              if (diff > 0) goNext();
              else goPrev();
            }
            setTouchStartX(null);
          }}
        >
          <div
            className="flex h-full will-change-transform transition-[transform] duration-500 ease-in-out"
            style={{
              width: `${heroCount * 100}%`,
              transform: `translateX(${-(heroIndex * (100 / heroCount))}%)`,
            }}
          >
            {heroListToRender.map((match) => (
              <div
                key={match.id}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-center px-6"
              >
                <div className="mb-10 flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-2 backdrop-blur-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/80">
                    Upcoming
                  </span>
                </div>

                <div className="flex w-full max-w-6xl flex-col items-center justify-center gap-8 md:flex-row md:gap-20">
                  <Link
                    href={`/schedule?team=${encodeURIComponent(match.homeTeam)}`}
                    className="group flex flex-col items-center"
                  >
                    <div className="relative mb-6">
                      <div
                        className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.5)] transition duration-300 group-hover:scale-105 group-hover:shadow-[0_0_30px_var(--accent)] md:h-52 md:w-52"
                        style={{
                          backgroundColor: getTeamTheme(match.homeTeam).primary,
                        }}
                      >
                        {teamLogo(match.homeTeam) ? (
                          <div className="relative h-20 w-20 md:h-28 md:w-28">
                            <Image
                              src={teamLogo(match.homeTeam)!}
                              alt=""
                              fill
                              sizes="112px"
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <span className="text-5xl md:text-7xl">⚾</span>
                        )}
                      </div>
                    </div>
                    <h2 className="text-4xl font-black italic uppercase leading-none text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-colors group-hover:text-[var(--accent)] md:text-7xl">
                      {match.homeTeam}
                    </h2>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
                      Home
                    </p>
                  </Link>

                  <div className="flex flex-col items-center">
                    <span className="text-6xl font-black italic text-[var(--accent)] drop-shadow-[0_0_40px_rgba(227,27,35,0.6)] md:text-8xl">
                      VS
                    </span>
                    <p className="mt-4 text-center text-lg font-black text-white md:text-xl">
                      {match.stadium}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-widest text-white/60">
                      {formatMMDDHHmm(match.gameAtISO)}
                    </p>
                    <span
                      className={cn(
                        "mt-3 rounded-full px-4 py-1.5 text-[10px] font-bold",
                        match.status === "예매오픈"
                          ? "bg-[var(--accent)] text-white shadow-[0_0_16px_var(--accent)]"
                          : "bg-white/20 text-white",
                      )}
                    >
                      {match.status}
                    </span>
                  </div>

                  <Link
                    href={`/schedule?team=${encodeURIComponent(match.awayTeam)}`}
                    className="group flex flex-col items-center"
                  >
                    <div className="relative mb-6">
                      <div
                        className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.5)] transition duration-300 group-hover:scale-105 group-hover:shadow-[0_0_30px_var(--accent)] md:h-52 md:w-52"
                        style={{
                          backgroundColor: getTeamTheme(match.awayTeam).primary,
                        }}
                      >
                        {teamLogo(match.awayTeam) ? (
                          <div className="relative h-20 w-20 md:h-28 md:w-28">
                            <Image
                              src={teamLogo(match.awayTeam)!}
                              alt=""
                              fill
                              sizes="112px"
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <span className="text-5xl md:text-7xl">⚾</span>
                        )}
                      </div>
                    </div>
                    <h2 className="text-4xl font-black italic uppercase leading-none text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-colors group-hover:text-[var(--accent)] md:text-7xl">
                      {match.awayTeam}
                    </h2>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
                      Away
                    </p>
                  </Link>
                </div>

                <Link
                  href={`/games/${match.id}`}
                  className="mt-14 inline-flex items-center gap-3 rounded-full bg-[var(--accent)] px-10 py-5 text-lg font-black uppercase tracking-tight text-white shadow-[0_0_30px_rgba(227,27,35,0.5)] transition hover:bg-[var(--accent-hover)] hover:shadow-[0_0_40px_rgba(227,27,35,0.6)]"
                >
                  GET TICKETS NOW
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* 하단 도트 인디케이터 */}
        {heroCount > 1 && (
          <div className="absolute bottom-8 left-0 right-0 z-30 flex justify-center gap-2">
            {heroListToRender.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setHeroIndex(i)}
                className={cn(
                  "h-2 rounded-full transition-all duration-200",
                  i === heroIndex
                    ? "w-8 bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]"
                    : "w-2 bg-white/40 hover:bg-white/60",
                )}
                aria-label={`경기 ${i + 1}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── The Teams (벤토 그리드) ─── */}
      <section className="border-y border-[var(--border-subtle)] bg-[var(--page-bg)] py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between md:gap-6">
            <div className="max-w-xl">
              <h2 className="text-4xl font-black uppercase leading-tight text-[var(--text-primary)] md:text-5xl">
                The Teams
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[var(--text-muted)] md:text-lg">
                구단을 선택하여 팀 컬러가 가득한 독점 콘텐츠와 티켓 일정을
                만나보세요.
              </p>
            </div>
            <span className="mt-4 text-[10px] font-black uppercase tracking-widest text-[var(--accent)] md:mt-0">
              Explore the KBO Universe
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {TEAMS.map((t) => (
              <button
                key={t.code}
                type="button"
                onClick={() =>
                  router.push(`/schedule?team=${encodeURIComponent(t.code)}`)
                }
                className="group flex h-56 flex-col rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 text-left transition hover:-rotate-1 hover:scale-[1.02] hover:border-[var(--accent)]/20 hover:shadow-lg"
              >
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition group-hover:rotate-6"
                  style={{ backgroundColor: getTeamTheme(t.code).primary }}
                >
                  <div className="relative h-8 w-8">
                    <Image
                      src={t.logoUrl}
                      alt=""
                      fill
                      sizes="32px"
                      className="object-contain"
                    />
                  </div>
                </div>
                <span className="block font-black text-lg tracking-tight text-[var(--text-primary)]">
                  {t.fullName}
                </span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Season {YEAR}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Beyond the Outfield (프리미엄 + LIVE UPDATES) ─── */}
      <section className="relative border-y border-[var(--border-subtle)] bg-[var(--page-bg)] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
            <div className="space-y-8">
              <div className="inline-block rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">
                Premium Experience
              </div>
              <h2 className="text-4xl font-black uppercase leading-[0.95] text-[var(--text-primary)] md:text-5xl lg:text-6xl">
                BEYOND THE{" "}
                <span className="hero-outline-text font-black">OUTFIELD</span>
              </h2>
              <p className="max-w-lg text-lg leading-relaxed text-[var(--text-muted)]">
                홈플레이트의 프리미엄 예매 시스템으로 가장 가까운 곳에서
                선수들의 숨결을 느끼세요. 스마트 큐잉 서비스와 리얼타임 시트맵이
                완벽한 관람의 시작을 보장합니다.
              </p>
              <a
                href="https://www.tving.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--accent)]/50 bg-[var(--accent-muted)] px-5 py-3 text-sm font-bold text-[var(--accent)] transition hover:border-[var(--accent)] hover:shadow-[0_0_20px_rgba(227,27,35,0.2)]"
              >
                KBO 생중계 보러 가기
                <ChevronRight className="h-4 w-4" />
              </a>
              <div className="flex items-center gap-8">
                <div className="flex flex-col">
                  <span className="text-3xl font-black text-[var(--text-primary)]">
                    2.4M
                  </span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Active Fans
                  </span>
                </div>
                <div className="h-12 w-px bg-[var(--border-subtle)]" />
                <div className="flex flex-col">
                  <span className="text-3xl font-black text-[var(--text-primary)]">
                    100%
                  </span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Verified Tickets
                  </span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="overflow-hidden rounded-[3rem] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xl">
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={beyondImg}
                    alt="Stadium"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    onError={() => setBeyondImg("/hero/hero-1.png")}
                  />
                </div>
                <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]/95 p-4 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                      <span className="text-sm">✓</span>
                    </div>
                    <div>
                      <div className="font-black text-[var(--text-primary)]">
                        LIVE UPDATES
                      </div>
                      <div className="text-xs font-medium text-[var(--text-muted)]">
                        Tickets selling out in S1 Zone
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 최근 경기 일정 (왼쪽 문구 + 오른쪽 가로 막대 5개) ─── */}
      <section className="border-y border-[var(--border-subtle)] bg-[var(--surface)] py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-5 lg:gap-12">
            <div className="lg:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">
                Upcoming
              </span>
              <h2 className="mt-3 text-3xl font-black uppercase leading-tight text-[var(--text-primary)] md:text-4xl">
                다가오는 경기
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[var(--text-muted)]">
                이번 주 열리는 KBO 경기를 한눈에 확인하고, 원하는 매치업의
                티켓을 예매하세요.
              </p>
              <Link
                href="/schedule"
                className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)] hover:underline"
              >
                전체 일정 보기
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-3">
              {recentFive.length > 0 ? (
                recentFive.map((g) => (
                  <Link
                    key={g.id}
                    href={`/games/${g.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] px-5 py-4 transition hover:border-[var(--accent)]/30 hover:shadow-md"
                  >
                    <span className="w-16 shrink-0 text-left text-xl font-black italic text-[var(--text-primary)]">
                      {formatMMDDHHmm(g.gameAtISO).split(" ")[1] ?? ""}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-[var(--text-muted)]">
                      {g.stadium}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-center text-base font-bold text-[var(--text-primary)]">
                      {g.awayTeam} vs {g.homeTeam}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                        g.status === "예매오픈" &&
                          "bg-[var(--accent)] text-white",
                        g.status !== "예매오픈" &&
                          "bg-[var(--surface)] text-[var(--text-muted)]",
                      )}
                    >
                      {g.status}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--page-bg)] py-12 text-center text-[var(--text-muted)]">
                  등록된 경기가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 야구 소식 (맨 아래, 홈 스타일) ─── */}
      <section className="py-16 pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">
                News
              </span>
              <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-[var(--text-primary)] md:text-3xl">
                야구 소식
              </h2>
            </div>
            {news.length > 6 && (
              <button
                type="button"
                onClick={() => setNewsExpanded((e) => !e)}
                className="text-sm font-bold text-[var(--text-muted)] hover:text-[var(--accent)] hover:underline"
              >
                {newsExpanded ? "접기 ↑" : "더보기 →"}
              </button>
            )}
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {news.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-[var(--text-muted)]">
                등록된 야구 소식이 없습니다.
              </p>
            ) : (
              (newsExpanded ? news : news.slice(0, 6)).map((n) => (
                <a
                  key={n.newsId}
                  href={n.newsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] transition hover:border-[var(--accent)]/20 hover:shadow-lg"
                >
                  <div className="aspect-[5/3] overflow-hidden bg-[var(--page-bg)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        toPublicImageUrl(n.newsThumbnail) ??
                        "/placeholder/news.png"
                      }
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      <span className="text-[var(--text-secondary)]">
                        {n.newsPress ?? ""}
                      </span>
                      <span>{n.publishedAt}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-base font-semibold leading-snug text-[var(--text-primary)]">
                      {n.newsTitle}
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
