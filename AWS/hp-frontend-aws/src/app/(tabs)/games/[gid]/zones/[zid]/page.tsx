"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useRequireAuth } from "@/shared/hooks/useRequireAuth";

import {
  fetchClaimedSeats,
  reserveSeats,
  CLAIMED_POLL_MS,
} from "@/features/booking/api";
import {
  BOOKING_LOCK_SEC,
  getBookingRemainingSec,
  useBookingStore,
} from "@/features/booking/store";
import { isFlowPopup } from "@/shared/constants/flowPopup";
import { BookingTimer } from "@/features/booking/BookingTimer";
import { JAMSIL_SECTIONS } from "@/features/ticketing/maps/jamsil";
import {
  getTierPrice,
  tierLabel,
  type SeatTier,
} from "@/features/ticketing/maps/types";
import {
  YEAR,
  isWeekendByDate,
  parseMonthDayFromGid,
} from "@/features/ticketing/utils/date";
import { cn } from "@/shared/utils/cn";
import { getApiBase } from "@/shared/api/client";
import { getZoneSeats } from "@/shared/api/book";
import type { ZoneResponse } from "@/shared/api/types";
const MAX_SELECT = 4;
const SEAT_SIZE_PX = 26;
const SEAT_GAP_PX = 4;

type SeatState = "available" | "sold" | "gap";

type SeatCell = {
  id: string;
  row: number;
  col: number;
  state: SeatState;
  label: string;
};

function hashToInt(s: string) {
  // deterministic hash (Date.now 같은 거 안 씀)
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function buildSeatLayout(
  tier: SeatTier,
  seedKey: string,
): { rows: number; cols: number; seats: SeatCell[] } {
  // ✅ 약 200석 정도의 "스탠드 모양" 더미 레이아웃
  // - 실제 좌석/통로/매진여부는 백엔드 연동 시 교체
  // - 지금은 UI/플로우 확인용으로만 사용
  const base = { rows: 10, cols: 28 };

  const seed = hashToInt(seedKey);

  const soldRatio =
    tier === "premium"
      ? 0.25
      : tier === "purple"
        ? 0.22
        : tier === "exciting"
          ? 0.18
          : tier === "blue"
            ? 0.14
            : tier === "orange"
              ? 0.12
              : tier === "red"
                ? 0.1
                : tier === "navy"
                  ? 0.08
                  : 0.06;

  // row별 좌석 범위 (총 200석)
  const rowRange: Record<number, { left: number; right: number }> = {
    1: { left: 7, right: 22 },
    2: { left: 6, right: 23 },
    3: { left: 5, right: 24 },
    4: { left: 4, right: 25 },
    5: { left: 3, right: 26 },
    6: { left: 3, right: 26 },
    7: { left: 4, right: 25 },
    8: { left: 5, right: 24 },
    9: { left: 6, right: 23 },
    10: { left: 7, right: 22 },
  };

  const hasSeat = (r: number, c: number) => {
    const rr = rowRange[r];
    if (!rr) return false;
    return c >= rr.left && c <= rr.right;
  };

  const seats: SeatCell[] = [];
  for (let r = 1; r <= base.rows; r++) {
    const rowLetter = String.fromCharCode(64 + r); // A, B, C...
    let seqInRow = 0;
    for (let c = 1; c <= base.cols; c++) {
      let state: SeatState = hasSeat(r, c) ? "available" : "gap";

      if (state !== "gap") seqInRow += 1;
      const label =
        state === "gap"
          ? ""
          : `${rowLetter}-${String(seqInRow).padStart(2, "0")}`;

      // sold(더미): seat면 확률로 매진 처리
      if (state === "available") {
        const h = hashToInt(`${seed}-${r}-${c}`);
        const p = (h % 1000) / 1000;
        if (p < soldRatio) state = "sold";
      }

      seats.push({ id: `R${r}-C${c}`, row: r, col: c, state, label });
    }
  }
  return { rows: base.rows, cols: base.cols, seats };
}

function formatPrice(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

export default function SeatsPage() {
  const authed = useRequireAuth();
  const params = useParams<{ gid: string; zid: string }>();
  const router = useRouter();

  const gid = params.gid;
  const zid = params.zid; // ✅ 섹션 id (예: 224)

  const section = useMemo(() => {
    return JAMSIL_SECTIONS.find((s) => s.id === zid) ?? null;
  }, [zid]);

  const { month, day } = parseMonthDayFromGid(gid);
  const weekend = isWeekendByDate(YEAR, month, day);
  const dayType = weekend ? "weekend" : "weekday";

  const unitPrice = section ? getTierPrice(section.tier, dayType) : 0;
  const zoneLabel = section ? `${zid} 구역` : `${zid} 구역`;
  const tierText = section ? tierLabel(section.tier) : "-";

  const [zoneFromApi, setZoneFromApi] = useState<ZoneResponse | null>(null);

  const ZONE_POLL_MS = 2500;

  useEffect(() => {
    if (!getApiBase() || !gid || !zid) return;
    const load = () => {
      getZoneSeats(gid, zid)
        .then(setZoneFromApi)
        .catch(() => setZoneFromApi(null));
    };
    load();
    const id = setInterval(load, ZONE_POLL_MS);
    return () => clearInterval(id);
  }, [gid, zid]);

  const layout = useMemo(() => {
    if (zoneFromApi?.seats?.length) {
      const seats = zoneFromApi.seats;
      const rowNum = (r: string) => {
        const c = r.toUpperCase().charCodeAt(0);
        return c >= 65 && c <= 90 ? c - 64 : parseInt(r, 10) || 1;
      };
      const cells: SeatCell[] = seats.map((s) => ({
        id: s.seatCode,
        row: rowNum(s.seatRow),
        col: s.seatCol,
        state: s.isBooked ? "sold" : "available",
        label: s.seatCode,
      }));
      const rows = Math.max(...cells.map((c) => c.row), 1);
      const cols = Math.max(...cells.map((c) => c.col), 1);
      return { rows, cols, seats: cells };
    }
    const tier: SeatTier = section?.tier ?? "navy";
    return buildSeatLayout(tier, `${gid}:${zid}`);
  }, [gid, zid, section, zoneFromApi]);

  // --- booking store (checkout과 연결) ---
  const storeGameId = useBookingStore((s) => s.gameId);
  const storeZoneId = useBookingStore((s) => s.zoneId);
  const selectedSeats = useBookingStore((s) => s.selectedSeats);

  const setGame = useBookingStore((s) => s.setGame);
  const setZone = useBookingStore((s) => s.setZone);
  const clearSeats = useBookingStore((s) => s.clearSeats);
  const removeSeatsById = useBookingStore((s) => s.removeSeatsById);
  const toggleSeat = useBookingStore((s) => s.toggleSeat);
  const startLock = useBookingStore((s) => s.startLock);
  const clearAll = useBookingStore((s) => s.clearAll);

  const [banner, setBanner] = useState<string | null>(null);
  const [claimedSeatIds, setClaimedSeatIds] = useState<string[]>([]);
  const [checkoutPending, setCheckoutPending] = useState(false);

  useEffect(() => {
    if (!gid || !zid) return;
    if (storeGameId !== gid) {
      clearAll();
      setGame(gid);
      setZone(zid);
    } else if (storeZoneId !== zid) {
      clearSeats();
      setZone(zid);
    }
  }, [
    gid,
    zid,
    storeGameId,
    storeZoneId,
    clearAll,
    clearSeats,
    setGame,
    setZone,
  ]);

  // 5분 만료 시 팝업이면 창 닫기
  useEffect(() => {
    if (!isFlowPopup()) return;
    const id = setInterval(() => {
      const remaining = getBookingRemainingSec(useBookingStore.getState().lock);
      if (remaining !== null && remaining <= 0) {
        clearAll();
        window.close();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [clearAll]);

  // API 사용 시: zone 데이터가 선점(lock)/예매(sold) 모두 포함 → claimedSeatIds를 zone 기준으로 동기화
  useEffect(() => {
    if (!getApiBase() || !zoneFromApi?.seats) return;
    const booked = zoneFromApi.seats
      .filter((s) => s.isBooked)
      .map((s) => s.seatCode);
    setClaimedSeatIds(booked);
  }, [zoneFromApi]);

  // API 미사용(목업) 시: 예약된 좌석 폴링
  useEffect(() => {
    if (getApiBase() || !gid || !zid) return;
    const load = () => fetchClaimedSeats(gid, zid).then(setClaimedSeatIds);
    load();
    const id = setInterval(load, CLAIMED_POLL_MS);
    return () => clearInterval(id);
  }, [gid, zid]);

  const selectedIds = useMemo(
    () => selectedSeats.map((s) => s.seatId),
    [selectedSeats],
  );

  const soldCount = useMemo(
    () => layout.seats.filter((s) => s.state === "sold").length,
    [layout.seats],
  );
  const realSeatCount = useMemo(
    () =>
      zoneFromApi
        ? zoneFromApi.totalSeats
        : layout.seats.filter((s) => s.state !== "gap").length,
    [layout.seats, zoneFromApi],
  );
  const remain = zoneFromApi
    ? Math.max(0, zoneFromApi.totalSeats - zoneFromApi.bookedSeats)
    : Math.max(0, realSeatCount - soldCount);
  const crowdLabel = zoneFromApi
    ? zoneFromApi.status === "SOLD_OUT"
      ? "매진"
      : zoneFromApi.status === "NEAR_SOLD_OUT"
        ? "매진 임박"
        : "여유"
    : remain === 0
      ? "매진"
      : remain <= Math.max(10, Math.floor(realSeatCount * 0.15))
        ? "매진 임박"
        : "여유";

  const totalPrice = selectedSeats.reduce((acc, s) => acc + s.price, 0);

  const onToggleSeat = (seatId: string) => {
    if (claimedSeatIds.includes(seatId)) {
      alert("이미 선택된 좌석입니다.");
      return;
    }
    const cell = layout.seats.find((x) => x.id === seatId);
    const label = cell ? cell.label : seatId;

    const res = toggleSeat({ seatId, label, price: unitPrice }, MAX_SELECT);
    if (!res.ok) setBanner(res.reason ?? "좌석을 선택할 수 없어요.");
  };

  const goCheckout = async () => {
    // 백엔드 팀 요청: 데이터 바인딩 실패 여부 디버깅용 (확인 후 제거 가능)
    console.log("[Booking Debug] 예매하기(결제하기) 클릭", {
      gameId: gid,
      zoneId: zid,
      selectedSeatIds: selectedIds,
    });

    if (selectedSeats.length === 0) {
      setBanner("좌석을 선택해 주세요.");
      return;
    }
    setCheckoutPending(true);
    try {
      const result = await reserveSeats(gid, zid, selectedIds);
      if (!result.ok) {
        const message =
          result.message ??
          "이미 선택된 좌석입니다. 다른 좌석을 선택해 주세요.";
        if (result.takenSeats?.length) {
          removeSeatsById(result.takenSeats);
          setClaimedSeatIds((prev) => [
            ...new Set([...prev, ...result.takenSeats!]),
          ]);
        }
        alert(message);
        setCheckoutPending(false);
        return;
      }
      // 좌석 선점 성공 시에만 5분 타이머 시작 (좌석 선택 → 결제까지)
      startLock(BOOKING_LOCK_SEC);
      router.push("/checkout");
    } catch {
      setBanner("예약 확인에 실패했습니다. 다시 시도해 주세요.");
      setCheckoutPending(false);
    }
  };

  if (!authed) return null;

  if (!section) {
    return (
      <>
        <BookingTimer />
        <div className="mx-auto w-full max-w-7xl px-6 py-10">
          <div className="rounded-3xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] p-8 shadow-sm">
            <div className="text-xl font-black text-[var(--text-primary)]">
              존 정보를 찾을 수 없어요
            </div>
            <div className="mt-2 text-sm text-[var(--text-muted)]">
              zone id: <b className="text-[var(--text-primary)]">{zid}</b>
            </div>
            <button
              type="button"
              onClick={() => router.back()}
              className="mt-4 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
            >
              뒤로가기
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <BookingTimer />
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="rounded-3xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                Zone
              </p>
              <div className="mt-1 text-xl font-black text-[var(--text-primary)]">
                {zoneLabel} 좌석
              </div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">
                {YEAR}.{String(month).padStart(2, "0")}.
                {String(day).padStart(2, "0")} · {weekend ? "주말" : "주중"} ·{" "}
                {tierText} · 1좌석 {formatPrice(unitPrice)}
              </div>
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                잔여 {remain} · 상태 {crowdLabel}
              </div>
            </div>
          </div>
        </div>

        {banner ? (
          <div className="mt-4 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-muted)] px-4 py-3 text-sm text-[var(--accent)]">
            {banner}
          </div>
        ) : null}

        <div className="mt-6">
          <div className="rounded-3xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] p-6">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                좌석 선택
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                최대 {MAX_SELECT}좌석
              </div>
            </div>

            <div className="mt-3 overflow-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] p-4">
              <div className="min-w-max flex justify-center">
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `repeat(${layout.cols}, ${SEAT_SIZE_PX}px)`,
                    gap: `${SEAT_GAP_PX}px`,
                    width:
                      layout.cols * (SEAT_SIZE_PX + SEAT_GAP_PX) - SEAT_GAP_PX,
                  }}
                >
                  {layout.seats.map((s) => {
                    if (s.state === "gap") {
                      return (
                        <div
                          key={s.id}
                          style={{ height: SEAT_SIZE_PX, width: SEAT_SIZE_PX }}
                        />
                      );
                    }

                    const isSel = selectedIds.includes(s.id);
                    const isSold = s.state === "sold";
                    const isClaimed = claimedSeatIds.includes(s.id);

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          if (isClaimed) {
                            alert("이미 선택된 좌석입니다.");
                            return;
                          }
                          if (!isSold) onToggleSeat(s.id);
                        }}
                        disabled={isSold || isClaimed}
                        className={cn(
                          "rounded-[4px] border",
                          isSold || isClaimed
                            ? "border-[var(--border-subtle)] bg-[var(--surface)] opacity-50"
                            : isSel
                              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                              : "border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)]",
                        )}
                        style={{ height: SEAT_SIZE_PX, width: SEAT_SIZE_PX }}
                        aria-label={`좌석 ${s.label}${isSold || isClaimed ? " (예매됨)" : ""}`}
                        title={isClaimed ? "이미 선택된 좌석입니다" : s.label}
                      >
                        <span
                          className={cn(
                            "block w-full text-center leading-none",
                            SEAT_SIZE_PX >= 28 ? "text-[10px]" : "text-[9px]",
                            isSold || isClaimed
                              ? "text-[var(--text-muted)]"
                              : isSel
                                ? "text-white"
                                : "text-[var(--text-secondary)]",
                          )}
                        >
                          {s.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  선택 좌석
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {selectedSeats.length}/{MAX_SELECT}
                </div>
              </div>

              <div className="mt-2 min-h-[24px] text-sm text-[var(--text-secondary)]">
                {selectedSeats.length
                  ? selectedSeats.map((s) => s.label).join(", ")
                  : "좌석을 선택해 주세요"}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm text-[var(--text-muted)]">
                  합계{" "}
                  <span className="font-bold text-[var(--text-primary)]">
                    {formatPrice(totalPrice)}
                  </span>
                </div>

                {getApiBase() && !zoneFromApi?.seats?.length && (
                  <p className="mb-2 text-xs text-[var(--accent)]">
                    좌석 정보를 불러오는 중이거나 해당 구역 데이터가 없습니다.
                  </p>
                )}
                <button
                  type="button"
                  disabled={
                    selectedSeats.length === 0 ||
                    checkoutPending ||
                    !!(getApiBase() && !zoneFromApi?.seats?.length)
                  }
                  onClick={() => void goCheckout()}
                  className={cn(
                    "rounded-2xl px-5 py-2.5 text-sm font-bold",
                    selectedSeats.length === 0 ||
                      checkoutPending ||
                      !!(getApiBase() && !zoneFromApi?.seats?.length)
                      ? "bg-[var(--surface)] text-[var(--text-muted)] cursor-not-allowed"
                      : "bg-[var(--accent)] text-white hover:opacity-95",
                  )}
                >
                  {checkoutPending ? "확인 중..." : "결제하기"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
