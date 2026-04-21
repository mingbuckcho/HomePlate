"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SeatMap from "@/features/ticketing/components/SeatMap";
import { JAMSIL_SECTIONS } from "@/features/ticketing/maps/jamsil";
import type { DayType, SeatSection } from "@/features/ticketing/maps/types";
import {
  getTierPrice,
  TIER_META,
  tierLabel,
  type SeatTier,
} from "@/features/ticketing/maps/types";
import { Card } from "@/shared/ui/Card";
import { Container } from "@/shared/ui/Container";
import { Button } from "@/shared/ui/Button";
import { useRequireAuth } from "@/shared/hooks/useRequireAuth";
import {
  getBookingRemainingSec,
  useBookingStore,
} from "@/features/booking/store";
import { useGameStore } from "@/features/games/store";
import { isFlowPopup } from "@/shared/constants/flowPopup";
import { getZoneSeatStatus } from "@/features/ticketing/utils/zoneSeatStatus";
import { cn } from "@/shared/utils/cn";
import { BookingTimer } from "@/features/booking/BookingTimer";
import { getApiBase } from "@/shared/api/client";
import { getZoneSeats } from "@/shared/api/book";

function asString(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

const TIER_ORDER: SeatTier[] = [
  "premium",
  "exciting",
  "blue",
  "orange",
  "red",
  "navy",
  "green",
  "purple",
];

export default function ZonesPage() {
  const authed = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ gid: string }>();
  const gid = asString(params?.gid) ?? "";

  const setGame = useBookingStore((s) => s.setGame);
  const clearAllBooking = useBookingStore((s) => s.clearAll);

  // 구역 선택 진입 시 게임만 설정. 5분 타이머는 좌석 선점 성공 시에만 시작(좌석 선택 → 결제)
  useEffect(() => {
    if (!authed) return;
    if (gid) {
      setGame(gid);
    } else {
      clearAllBooking();
    }
  }, [authed, gid, setGame, clearAllBooking]);

  // 5분 만료 시 팝업이면 창 닫기
  useEffect(() => {
    if (!gid || !isFlowPopup()) return;
    const id = setInterval(() => {
      const remaining = getBookingRemainingSec(useBookingStore.getState().lock);
      if (remaining !== null && remaining <= 0) {
        clearAllBooking();
        window.close();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [gid, clearAllBooking]);

  const [selectedByGid, setSelectedByGid] = useState<
    Record<string, string | null>
  >({});
  const selectedId = gid ? (selectedByGid[gid] ?? null) : null;
  const [zoneLoadStatus, setZoneLoadStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");

  const setSelectedId = (next: string | null) => {
    if (!gid) return;
    setSelectedByGid((prev) => {
      if (prev[gid] === next) return prev;
      return { ...prev, [gid]: next };
    });
  };

  const game = useGameStore((s) => s.getById)(gid);
  const dayType: DayType = useMemo(() => {
    if (!game?.gameAtISO) return "weekend";
    const d = new Date(game.gameAtISO);
    const day = d.getDay();
    return day === 0 || day === 6 ? "weekend" : "weekday";
  }, [game?.gameAtISO]);

  const selectedSection: SeatSection | null = useMemo(() => {
    if (!selectedId) return null;
    return JAMSIL_SECTIONS.find((s) => s.id === selectedId) ?? null;
  }, [selectedId]);

  useEffect(() => {
    if (!getApiBase() || !gid || !selectedId) {
      setZoneLoadStatus("idle");
      return;
    }
    setZoneLoadStatus("loading");
    getZoneSeats(gid, selectedId)
      .then((res) => {
        if (res?.seats?.length) setZoneLoadStatus("ok");
        else setZoneLoadStatus("error");
      })
      .catch(() => setZoneLoadStatus("error"));
  }, [gid, selectedId]);

  const canGoToSeats = !getApiBase() || zoneLoadStatus === "ok";

  const price = selectedSection
    ? getTierPrice(selectedSection.tier, dayType)
    : 0;

  if (!authed) return null;

  return (
    <div className="min-h-[100dvh]">
      <BookingTimer />
      <Container className="pt-6 pb-16">
        <div>
          <div className="text-lg font-bold text-[var(--text-primary)]">
            구역 선택
          </div>
          <div className="text-sm text-[var(--text-muted)]">
            경기: {gid || "-"} · {dayType === "weekday" ? "주중" : "주말"} 요금
            적용
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="p-4">
            <div className="mb-2 text-sm font-bold text-[var(--text-secondary)]">
              잠실 구장 구역 맵(클릭해서 선택)
            </div>

            <SeatMap
              sections={JAMSIL_SECTIONS}
              selectedId={selectedId ?? undefined}
              onSelect={(id) => setSelectedId(id)}
              backgroundSrc="/assets/stadium/jamsil-map.png"
              backgroundOpacity={0.85}
              viewBox={{ x: 0, y: 0, w: 100, h: 100 }}
              className="aspect-square rounded-xl border border-[var(--border-subtle)] bg-[var(--page-bg)]"
              getFill={(section, isSelected, isHover) => {
                void section;
                void isSelected;
                void isHover;
                return "rgba(0,0,0,0)";
              }}
              getStroke={(_, isSelected, isHover) => {
                void isSelected;
                void isHover;
                return "rgba(0,0,0,0)";
              }}
            />

            <div className="mt-3 text-xs text-[var(--text-muted)]">
              * 구역을 누르면 선택됩니다. (상세 좌석은 다음 단계에서)
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="p-4">
              <div className="text-sm font-bold text-[var(--text-secondary)]">
                선택 정보
              </div>

              {selectedSection ? (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-[var(--text-primary)]">
                      {`${selectedSection.id} 구역`}
                    </span>
                    <span
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                        getZoneSeatStatus(gid, selectedSection.id) === "여유" &&
                          "bg-[var(--field-muted)] text-[var(--field)]",
                        getZoneSeatStatus(gid, selectedSection.id) ===
                          "매진 임박" &&
                          "bg-[var(--accent-muted)] text-[var(--accent)]",
                        getZoneSeatStatus(gid, selectedSection.id) === "매진" &&
                          "bg-[var(--surface-hover)] text-[var(--text-muted)]",
                      )}
                    >
                      {getZoneSeatStatus(gid, selectedSection.id)}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--text-muted)]">
                    등급:{" "}
                    <span className="text-[var(--text-primary)]">
                      {tierLabel(selectedSection.tier)}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--text-muted)]">
                    가격:{" "}
                    <span className="text-[var(--text-primary)]">
                      {price.toLocaleString("ko-KR")}원
                    </span>
                  </div>

                  {getApiBase() && zoneLoadStatus === "loading" && (
                    <p className="mt-3 text-xs text-[var(--text-muted)]">
                      구역 정보 불러오는 중…
                    </p>
                  )}
                  {getApiBase() && zoneLoadStatus === "error" && (
                    <p className="mt-3 text-xs text-[var(--accent)]">
                      해당 구역 정보를 불러올 수 없습니다.
                    </p>
                  )}
                  <Button
                    className="mt-3 w-full"
                    disabled={!canGoToSeats}
                    onClick={() => {
                      // 백엔드 팀 요청: 데이터 바인딩 실패 여부 디버깅용 (확인 후 제거 가능)
                      console.log("[Booking Debug] 좌석 선택으로 이동 클릭", {
                        gameId: gid,
                        zoneId: selectedSection?.id,
                      });
                      router.push(
                        `/games/${encodeURIComponent(gid)}/zones/${encodeURIComponent(selectedSection.id)}`,
                      );
                    }}
                  >
                    좌석 선택으로 이동
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setSelectedId(null)}
                  >
                    선택 해제
                  </Button>
                </div>
              ) : (
                <div className="mt-3 text-sm text-[var(--text-muted)]">
                  구역을 하나 선택해주세요.
                </div>
              )}
            </Card>

            <Card className="p-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                Price
              </span>
              <h2 className="mt-2 text-lg font-black text-[var(--text-primary)]">
                가격표
              </h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {dayType === "weekend" ? "주말" : "주중"} 요금 적용
              </p>
              <ul className="mt-4 space-y-2">
                {TIER_ORDER.map((tier) => {
                  const m = TIER_META[tier];
                  const price =
                    dayType === "weekend" ? m.price.weekend : m.price.weekday;
                  const isCurrent = selectedSection?.tier === tier;
                  return (
                    <li
                      key={tier}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border px-4 py-3",
                        isCurrent
                          ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                          : "border-[var(--border-subtle)] bg-[var(--page-bg)]",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-sm font-bold text-[var(--text-secondary)]">
                          {m.label}
                        </span>
                        {isCurrent && (
                          <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-white">
                            선택
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        {price.toLocaleString("ko-KR")}원
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                * 실제 결제/잔여좌석은 백엔드 연동 시 확정됩니다.
              </p>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
