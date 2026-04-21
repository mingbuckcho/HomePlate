"use client";

import { useEffect, useState } from "react";
import {
  getBookingRemainingSec,
  useBookingStore,
} from "@/features/booking/store";
import { Clock } from "lucide-react";

function formatMMSS(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * 구역 선택 → 좌석 선택 → 결제 플로우에서 상단에 노출하는 결제 유효 시간 타이머.
 * lock이 없으면 아무것도 렌더하지 않음.
 */
export function BookingTimer() {
  const lock = useBookingStore((s) => s.lock);
  const [leftSec, setLeftSec] = useState<number | null>(() =>
    getBookingRemainingSec(lock),
  );

  useEffect(() => {
    if (!lock) {
      setLeftSec(null);
      return;
    }
    setLeftSec(getBookingRemainingSec(lock));
    const id = setInterval(() => {
      const remaining = getBookingRemainingSec(useBookingStore.getState().lock);
      setLeftSec(remaining);
    }, 1000);
    return () => clearInterval(id);
  }, [lock]);

  if (lock === null || leftSec === null) return null;

  const isExpired = leftSec <= 0;

  return (
    <div className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--page-bg)] text-[var(--accent)]">
          <Clock className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            결제 유효 시간
          </p>
          <p
            className={
              isExpired
                ? "text-sm font-bold text-[var(--accent)]"
                : "text-lg font-black tabular-nums text-[var(--text-primary)]"
            }
          >
            {isExpired ? "만료됨" : formatMMSS(leftSec)}
          </p>
        </div>
      </div>
    </div>
  );
}
