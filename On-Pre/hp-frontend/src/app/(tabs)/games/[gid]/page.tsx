"use client";

import { use as usePromise, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { cn } from "@/shared/utils/cn";
import { useGameStore } from "@/features/games/store";
import { useAuthStore } from "@/features/auth/store";
import { withComputedStatus } from "@/features/games/status";
import { formatMMDDHHmm } from "@/shared/utils/datetime";
import { TIER_META, type SeatTier } from "@/features/ticketing/maps/types";
import { EmptyState } from "@/shared/ui/EmptyState";
import { getNaverMapSearchUrl } from "@/shared/constants/externalLinks";
import { MapPin } from "lucide-react";

const ORDER: SeatTier[] = [
  "premium",
  "exciting",
  "blue",
  "orange",
  "red",
  "navy",
  "green",
  "purple",
];

/** 경기 상세 페이지 상단 배너 기본 이미지 (경기별 bannerUrl 없을 때 사용). public/game-banner/default.png */
const DEFAULT_GAME_DETAIL_BANNER = "/game-banner/default.png";

function won(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function Inner({ gid }: { gid: string }) {
  const router = useRouter();
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const hydrate = useGameStore((s) => s.hydrate);
  const items = useGameStore((s) => s.items);

  const openQueue = () => {
    if (!isAuthed) {
      router.push("/auth/login?next=" + encodeURIComponent(`/games/${gid}`));
      return;
    }
    const url = `/queue?gameId=${encodeURIComponent(gid)}&from=popup`;
    window.open(url, "queue", "width=520,height=600,scrollbars=yes");
  };

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const game = useMemo(() => {
    const found = items.find((g) => g.id === gid);
    return found ? withComputedStatus(found) : undefined;
  }, [items, gid]);

  if (!game) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-14">
        <EmptyState
          title="경기 정보를 찾을 수 없습니다"
          description="관리자(/admin)에서 경기를 생성한 뒤 다시 확인해 주세요."
          actionLabel="홈으로"
          actionHref="/"
        />
      </div>
    );
  }

  const status = game.status ?? "예매전";
  const banner = game.bannerUrl ?? DEFAULT_GAME_DETAIL_BANNER;

  return (
    <div className="w-full">
      {/* 경기 상세 전용 상단 (홈 VS 히어로와 다름: 컴팩트 배너) */}
      <section className="relative border-b border-[var(--border-subtle)] bg-[var(--page-bg)]">
        <div className="relative h-48 w-full overflow-hidden md:h-56">
          <Image
            src={banner}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--page-bg)] via-[var(--page-bg)]/80 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="mx-auto w-full max-w-7xl px-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                Game Detail
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--text-primary)] md:text-4xl">
                {game.awayTeam}{" "}
                <span className="font-black italic text-[var(--accent)]">
                  vs
                </span>{" "}
                {game.homeTeam}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold text-[var(--text-primary)]">
                  {formatMMDDHHmm(game.gameAtISO)} KST
                </span>
                <span className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)]">
                  {game.stadium}
                </span>
                <span
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-bold",
                    status === "예매오픈" && "bg-[var(--accent)] text-white",
                    status !== "예매오픈" &&
                      "bg-[var(--surface)] text-[var(--text-muted)]",
                  )}
                >
                  {status}
                </span>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={openQueue}
                  className="inline-flex h-11 items-center rounded-xl bg-[var(--accent)] px-6 text-sm font-bold text-white shadow-md hover:opacity-90"
                >
                  예매하기
                </button>
                <button
                  type="button"
                  onClick={() => alert("공유는 준비중입니다.")}
                  className="inline-flex h-11 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                >
                  공유
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* 2x2: 좌상 관전포인트 | 우상 예매안내 / 좌하 경기장오는길 | 우하 가격표 */}
        <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
          {/* 왼쪽 상단: 오늘의 관전 포인트 */}
          <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">
              Tip
            </span>
            <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">
              오늘의 관전 포인트
            </h2>
            <ul className="mt-4 space-y-3">
              <li className="flex items-start gap-3 rounded-xl bg-[var(--page-bg)] p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
                  1
                </span>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">
                    구역별 분위기
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                    내야는 타구 선구안, 외야는 홈런 캐치 포인트.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-[var(--page-bg)] p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
                  2
                </span>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">
                    입장 시간
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                    경기 시작 1시간 전부터 입장 가능합니다.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-[var(--page-bg)] p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
                  3
                </span>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">
                    편의 시설
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                    구장 내 매점·화장실 위치는 입장 시 안내책자를 확인하세요.
                  </p>
                </div>
              </li>
            </ul>
          </section>

          {/* 오른쪽 상단: 예매 안내 */}
          <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6">
            <h2 className="text-lg font-black text-[var(--text-primary)]">
              예매 안내
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-1">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] p-4">
                <dt className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  예매 흐름
                </dt>
                <dd className="mt-2 text-sm font-medium text-[var(--text-secondary)]">
                  경기 상세 → 구역 선택 → 좌석 선택 → 결제
                </dd>
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] p-4">
                <dt className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  로그인
                </dt>
                <dd className="mt-2 text-sm font-medium text-[var(--text-secondary)]">
                  구역 선택부터 로그인 후 진행할 수 있습니다.
                </dd>
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] p-4">
                <dt className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  취소
                </dt>
                <dd className="mt-2 text-sm font-medium text-[var(--text-secondary)]">
                  마이페이지에서 티켓별 예매취소 가능합니다.
                </dd>
              </div>
            </dl>
          </section>

          {/* 왼쪽 하단: 경기장 오는 길 */}
          <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6">
            <h2 className="text-lg font-black text-[var(--text-primary)]">
              경기장 오는 길
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {game.stadium} 위치를 확인하고 네이버 지도로 길찾기
            </p>
            <a
              href={getNaverMapSearchUrl(game.stadium)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] transition hover:border-[var(--accent)]/30"
            >
              <div className="relative flex min-h-[320px] w-full flex-1 flex-col items-center justify-center gap-3 p-8 sm:min-h-[380px]">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--accent)]">
                  <MapPin className="h-10 w-10" />
                </div>
                <span className="text-center text-sm font-bold text-[var(--text-primary)]">
                  {game.stadium} · 네이버 지도에서 보기
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  클릭하면 네이버 지도로 이동합니다
                </span>
              </div>
            </a>
          </section>

          {/* 오른쪽 하단: 가격표 */}
          <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              Price
            </span>
            <h2 className="mt-2 text-lg font-black text-[var(--text-primary)]">
              가격표
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              고정 · 주중/주말 요금 적용
            </p>
            <ul className="mt-4 space-y-2">
              {ORDER.map((tier) => {
                const m = TIER_META[tier];
                return (
                  <li
                    key={tier}
                    className="flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] px-5 py-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: m.color }}
                      />
                      <span className="text-sm font-bold text-[var(--text-secondary)]">
                        {m.label}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      주중 {won(m.price.weekday)} / 주말 {won(m.price.weekend)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[11px] text-[var(--text-muted)]">
              * 실제 결제/잔여좌석/상세 정책은 백엔드 연동 시 확정됩니다.
            </p>
          </section>
        </div>

        {/* 하단: 예매/공유 버튼만 */}
        <aside className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openQueue}
              className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-[var(--accent)] text-base font-black text-white shadow-lg hover:opacity-90"
            >
              예매하기
            </button>
            <button
              type="button"
              onClick={() => alert("공유는 준비중입니다.")}
              className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            >
              공유
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function GameDetailPage({
  params,
}: {
  params: Promise<{ gid: string }>;
}) {
  const { gid } = usePromise(params);
  return <Inner gid={gid} />;
}
