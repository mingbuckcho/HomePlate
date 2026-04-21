"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/shared/ui/Card";
import { Container } from "@/shared/ui/Container";
import { Chip } from "@/shared/ui/Chip";
import { EmptyState } from "@/shared/ui/EmptyState";

import { useRequireAuth } from "@/shared/hooks/useRequireAuth";
import {
  BOOKING_LOCK_SEC,
  getBookingRemainingSec,
  useBookingStore,
} from "@/features/booking/store";
import { useTicketStore } from "@/features/tickets/store";
import { useAuthStore } from "@/features/auth/store";
import { useGameStore } from "@/features/games/store";
import { useNotificationStore } from "@/features/notifications/store";
import type { TicketGameSnapshot } from "@/entities/tickets/type";
import { formatMMDDHHmm } from "@/shared/utils/datetime";
import { clearFlowPopup } from "@/shared/constants/flowPopup";
import { BookingTimer } from "@/features/booking/BookingTimer";
import { getApiBase, getAccessToken } from "@/shared/api/client";
import { createOrder, payment } from "@/shared/api/book";

type Method = "CARD" | "TOSS" | "KAKAO";

function won(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function formatTimer(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function CheckoutContent() {
  const router = useRouter();
  const authed = useRequireAuth();

  const hydrateTickets = useTicketStore((s) => s.hydrate);
  const addTicket = useTicketStore((s) => s.add);

  const gameId = useBookingStore((s) => s.gameId);
  const zoneId = useBookingStore((s) => s.zoneId);
  const selectedSeats = useBookingStore((s) => s.selectedSeats);
  const clearAll = useBookingStore((s) => s.clearAll);

  const hydrateGames = useGameStore((s) => s.hydrate);
  const getGame = useGameStore((s) => s.getById);

  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    hydrateTickets();
    hydrateGames();
  }, [hydrateTickets, hydrateGames]);

  const total = useMemo(
    () => selectedSeats.reduce((sum, s) => sum + s.price, 0),
    [selectedSeats],
  );

  const game = useMemo(
    () => (gameId ? getGame(gameId) : undefined),
    [getGame, gameId],
  );

  const [method, setMethod] = useState<Method>("CARD");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [leftSec, setLeftSec] = useState(
    () =>
      getBookingRemainingSec(useBookingStore.getState().lock) ??
      BOOKING_LOCK_SEC,
  );
  const [paymentDone, setPaymentDone] = useState(false);
  const [isPopup, setIsPopup] = useState(false);

  useEffect(() => {
    setIsPopup(typeof window !== "undefined" && !!window.opener);
  }, []);

  // 좌석 선점 성공 후 시작된 5분 타이머(store lock) 기준으로 남은 시간 갱신
  const hasCheckoutData = !!(gameId && zoneId && selectedSeats.length > 0);

  // 진입 시 이미 만료된 결제 정보면 비워서 "결제 정보를 찾을 수 없습니다" 표시
  useEffect(() => {
    if (!hasCheckoutData) return;
    const remaining = getBookingRemainingSec(useBookingStore.getState().lock);
    if (remaining !== null && remaining <= 0) {
      clearAll();
    }
  }, [hasCheckoutData, clearAll]);

  useEffect(() => {
    if (!hasCheckoutData) return;
    const id = setInterval(() => {
      const remaining = getBookingRemainingSec(useBookingStore.getState().lock);
      setLeftSec(remaining ?? 0);
    }, 1000);
    return () => clearInterval(id);
  }, [hasCheckoutData]);

  // 5분 만료 시 팝업이면 창 닫기
  useEffect(() => {
    if (!hasCheckoutData || !isPopup) return;
    const id = setInterval(() => {
      const remaining = getBookingRemainingSec(useBookingStore.getState().lock);
      if (remaining !== null && remaining <= 0) {
        clearAll();
        window.close();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [hasCheckoutData, isPopup, clearAll]);

  if (!authed) return null;

  // 결제 완료 후에는 데이터를 비우므로, paymentDone을 먼저 검사해 성공 화면을 보여줌
  if (paymentDone) {
    return (
      <Container className="py-14">
        <div className="mx-auto max-w-md rounded-3xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] p-10 text-center shadow-lg">
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            예매가 완료되었습니다.
          </p>
          <button
            type="button"
            onClick={() => {
              clearFlowPopup();
              if (isPopup && window.opener) {
                window.opener.location.href = "/mypage";
                window.opener.focus();
                window.close();
              } else {
                router.replace("/mypage");
              }
            }}
            className="mt-6 h-12 w-full rounded-2xl bg-[var(--accent)] text-sm font-bold text-white hover:opacity-90"
          >
            닫기
          </button>
        </div>
      </Container>
    );
  }

  if (!gameId || !zoneId || selectedSeats.length === 0) {
    return (
      <Container className="py-14">
        <EmptyState
          title="결제 정보를 찾을 수 없습니다"
          description="좌석을 선택한 뒤 결제하기로 이동해 주세요. 새 탭에서 열었거나 결제 유효 시간(5분)이 지난 경우에도 이 메시지가 표시됩니다."
          actionLabel="닫기"
          onAction={() => {
            clearFlowPopup();
            if (isPopup && window.opener) {
              window.opener.focus();
              window.close();
            } else {
              router.replace("/");
            }
          }}
        />
      </Container>
    );
  }

  const gameSnap: TicketGameSnapshot | undefined = game
    ? {
        gid: game.id,
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        stadium: game.stadium,
        gameAtISO: game.gameAtISO,
      }
    : undefined;

  return (
    <>
      <BookingTimer />
      <Container className="py-10">
        <div className="grid gap-6 lg:grid-cols-[1fr,420px]">
          <Card className="rounded-3xl border-2 border-[var(--border-subtle)] p-8 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              Checkout
            </p>
            <h1 className="mt-2 text-2xl font-black text-[var(--text-primary)]">
              결제하기
            </h1>

            <div className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] p-5">
              <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                예매자
              </div>
              <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                {user?.name ?? "이름 없음"}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] p-5">
              <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                경기
              </div>
              <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                {game ? (
                  <>
                    {game.awayTeam}{" "}
                    <span className="text-[var(--text-muted)]">vs</span>{" "}
                    {game.homeTeam}
                  </>
                ) : (
                  "경기 정보(더미)"
                )}
              </div>
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                {game
                  ? `${formatMMDDHHmm(game.gameAtISO)} KST • ${game.stadium}`
                  : ""}
              </div>
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                구역: {zoneId}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] p-5">
              <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                좌석
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedSeats.map((s) => (
                  <Chip key={s.seatId}>{s.label}</Chip>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                결제수단
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["CARD", "TOSS", "KAKAO"] as Method[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={
                      m === method
                        ? "rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white"
                        : "rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                    }
                  >
                    {m === "CARD" ? "카드" : m === "TOSS" ? "토스" : "카카오"}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="rounded-3xl border-2 border-[var(--border-subtle)] p-8 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              Summary
            </p>
            <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">
              결제 요약
            </h2>

            <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">결제 유효 시간</span>
                <span
                  className={
                    leftSec <= 0
                      ? "font-semibold text-[var(--accent)]"
                      : "font-bold text-[var(--text-primary)]"
                  }
                >
                  {formatTimer(leftSec)}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--page-bg)] p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">
                  좌석 {selectedSeats.length}개
                </span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {won(total)}
                </span>
              </div>
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                * 결제는 더미이며, 결제 완료 시 티켓이 발급됩니다.
              </div>
            </div>

            {leftSec <= 0 && (
              <div className="mt-3 rounded-xl bg-[var(--accent-muted)] px-4 py-2 text-sm text-[var(--accent)]">
                결제 유효 시간이 지났습니다. 좌석 선택부터 다시 진행해 주세요.
              </div>
            )}

            <button
              type="button"
              disabled={leftSec <= 0 || paymentLoading}
              onClick={async () => {
                if (!confirm("결제를 진행할까요?")) return;

                // 백엔드 팀 요청: 데이터 바인딩 실패 여부 디버깅용 (확인 후 제거 가능)
                console.log("[Booking Debug] 결제하기 클릭", {
                  gameId,
                  zoneId,
                  selectedSeatsCount: selectedSeats.length,
                  seatCodes: selectedSeats.map((s) => s.seatId),
                });

                if (getApiBase() && gameId && selectedSeats.length) {
                  const token = getAccessToken();
                  if (!token) {
                    console.warn(
                      "[Booking] AccessToken 유실: 결제 시점에 AccessToken이 없습니다. (Application 탭 homeplate_auth_session_v1 확인)",
                    );
                    useNotificationStore
                      .getState()
                      .add(
                        "error",
                        "로그인 세션이 없습니다. 다시 로그인한 뒤 결제해 주세요.",
                      );
                    return;
                  }
                  setPaymentLoading(true);
                  try {
                    const gameIdNum = Number(gameId);
                    if (!Number.isFinite(gameIdNum))
                      throw new Error("Invalid gameId");
                    const seatCodes = selectedSeats.map((s) => s.seatId);
                    const orderId = await createOrder(gameIdNum, seatCodes);
                    await payment(orderId);
                    clearAll();
                    useNotificationStore
                      .getState()
                      .add("success", "예매가 완료되었습니다.");
                    setPaymentDone(true);
                  } catch (err: unknown) {
                    let message = "결제에 실패했습니다. 다시 시도해 주세요.";
                    const ax = err as {
                      response?: {
                        status?: number;
                        data?: unknown;
                      };
                    };
                    if (
                      ax.response?.status === 409 ||
                      ax.response?.status === 400
                    ) {
                      const body = ax.response.data;
                      if (
                        body &&
                        typeof body === "object" &&
                        "message" in body
                      ) {
                        message = (body as { message: string }).message;
                      } else if (
                        body instanceof ArrayBuffer &&
                        body.byteLength > 0
                      ) {
                        try {
                          const json = JSON.parse(
                            new TextDecoder("utf-8").decode(body),
                          ) as { message?: string };
                          if (json.message) message = json.message;
                        } catch {
                          /* ignore */
                        }
                      }
                    }
                    useNotificationStore.getState().add("error", message);
                  } finally {
                    setPaymentLoading(false);
                  }
                  return;
                }

                const tid = `t-${Date.now()}`;
                addTicket({
                  id: tid,
                  buyerName: user?.name ?? "",
                  game: gameSnap,
                  zoneId,
                  seats: selectedSeats.map((s) => ({
                    seatId: s.seatId,
                    label: s.label,
                    price: s.price,
                  })),
                  totalPrice: total,
                  paymentMethod: method,
                });

                clearAll();
                useNotificationStore
                  .getState()
                  .add("success", "예매가 완료되었습니다.");
                setPaymentDone(true);
              }}
              className="mt-4 h-12 w-full rounded-2xl bg-[var(--accent)] text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paymentLoading
                ? "결제 중…"
                : getApiBase()
                  ? "결제 완료"
                  : "결제 완료(더미)"}
            </button>

            {!paymentDone && !paymentLoading && (
              <button
                type="button"
                onClick={() => router.back()}
                className="mt-2 h-12 w-full rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                이전
              </button>
            )}
          </Card>
        </div>
      </Container>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <Container className="py-14">
          <div className="text-center text-[var(--text-muted)]">로딩 중…</div>
        </Container>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
