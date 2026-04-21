"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { setFlowPopup } from "@/shared/constants/flowPopup";
import { BaseballIcon } from "@/shared/ui/BaseballIcon";
import { getApiBase } from "@/shared/api/client";
import { enterQueue, getQueueRank } from "@/shared/api/queue";

const QUEUE_WAIT_MS = 3000;
const QUEUE_POLL_MS = 2000;

/**
 * 예매 대기열. ENTERING THE ARENA 스타일.
 * from=popup&gameId=xxx 이면 대기 후 해당 경기 구역 선택으로 이동.
 * 백엔드 연동 시: POST /queue/{gameId} 진입 후 GET /queue/{gameId}/rank 폴링, status ACTIVE 시 이동.
 */
function QueueContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameId = searchParams.get("gameId") ?? "";
  const fromPopup = searchParams.get("from") === "popup";

  const [countdown, setCountdown] = useState(
    fromPopup && gameId ? Math.ceil(QUEUE_WAIT_MS / 1000) : 0,
  );
  const [progress, setProgress] = useState(0);
  const [queueRank, setQueueRank] = useState<number | null>(null);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (fromPopup && gameId) setFlowPopup();
  }, [fromPopup, gameId]);

  useEffect(() => {
    if (!getApiBase() || !gameId) return;
    enterQueue(gameId)
      .then((res) => {
        setQueueRank(res.rank ?? null);
        setQueueStatus(res.status ?? null);
      })
      .catch(() => {});
  }, [gameId]);

  useEffect(() => {
    if (!getApiBase() || !gameId) return;
    const id = setInterval(() => {
      getQueueRank(gameId)
        .then((res) => {
          setQueueRank(res.rank ?? null);
          setQueueStatus(res.status ?? null);
          if (res.status === "ACTIVE") {
            router.replace(`/games/${encodeURIComponent(gameId)}/zones`);
          }
        })
        .catch(() => {});
    }, QUEUE_POLL_MS);
    return () => clearInterval(id);
  }, [gameId, router]);

  useEffect(() => {
    if (!fromPopup || !gameId) return;
    if (!getApiBase() && countdown <= 0) {
      router.replace(`/games/${encodeURIComponent(gameId)}/zones`);
      return;
    }
    if (!getApiBase()) {
      const t = setInterval(() => setCountdown((c) => c - 1), 1000);
      return () => clearInterval(t);
    }
  }, [fromPopup, gameId, countdown, router]);

  // 진행률 애니메이션
  useEffect(() => {
    const start = Date.now();
    const duration = 2000;
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) % duration;
      setProgress(0.72 + (elapsed / duration) * 0.12);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const queuePosition =
    queueStatus === "WAITING" && queueRank != null ? queueRank : null;
  const queuePositionLabel =
    queueStatus === "EXPIRED"
      ? "만료"
      : queuePosition != null
        ? queuePosition.toLocaleString("en-US")
        : "—";

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--page-bg)] px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        {/* 원형 진행 + 야구공 (BaseballIcon 컴포넌트) */}
        <div className="relative flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40">
          <svg
            className="absolute h-full w-full -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 46}`}
              strokeDashoffset={`${2 * Math.PI * 46 * (1 - progress)}`}
              className="transition-[stroke-dashoffset] duration-300"
            />
          </svg>
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-[var(--accent)]/40 bg-[var(--page-bg)] sm:h-24 sm:w-24">
            <BaseballIcon size={48} stroke="var(--accent)" strokeWidth={2.5} />
          </div>
        </div>

        <h1 className="mt-8 text-3xl font-black italic uppercase tracking-tight text-white sm:text-4xl">
          Entering the Arena
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
          홈플레이트 보안 대기열 시스템입니다.
          <br />팬 여러분의 공정한 예매를 위해 잠시만 기다려주세요.
        </p>

        {/* ESTIMATED QUEUE POSITION */}
        <div className="mt-10 w-full max-w-xs rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-8 py-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Estimated Queue Position
          </p>
          <p className="mt-2 text-4xl font-black tabular-nums text-white sm:text-5xl">
            {queuePositionLabel}
          </p>
          {!getApiBase() && fromPopup && gameId && countdown > 0 && (
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              {countdown}초 후 구역 선택으로 이동합니다...
            </p>
          )}
        </div>

        {getApiBase() && queueStatus && (
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            상태: {queueStatus}
          </p>
        )}
        <p
          className="mt-8 text-xs text-[var(--text-muted)]"
          suppressHydrationWarning
        >
          {mounted && getApiBase()
            ? "대기열 순번이 갱신됩니다. 입장 가능 시 자동으로 이동합니다."
            : "API 미연동 시 순번은 표시되지 않습니다."}
        </p>

        {!(fromPopup && gameId) && (
          <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
            <Link
              href={gameId ? `/games/${gameId}/zones` : "/schedule"}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-bold text-white hover:opacity-90"
            >
              {gameId ? "구역 선택으로 이동" : "일정 보기"}
            </Link>
            <Link
              href="/"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            >
              홈으로
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QueuePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--page-bg)]">
          <div className="text-[var(--text-muted)]">로딩 중…</div>
        </div>
      }
    >
      <QueueContent />
    </Suspense>
  );
}
