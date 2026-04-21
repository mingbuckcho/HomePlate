"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/shared/ui/Container";
import { Card } from "@/shared/ui/Card";
import { useTicketStore } from "@/features/tickets/store";
import { useAuthStore } from "@/features/auth/store";
import { useAdminStore } from "@/features/admin/store";
import { useRequireAuth } from "@/shared/hooks/useRequireAuth";
import { Ticket, LogOut } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { formatYYYYMMDDKorean, fromKstIso } from "@/shared/utils/datetime";
import { EmptyState } from "@/shared/ui/EmptyState";
import { useNotificationStore } from "@/features/notifications/store";
import type { Ticket as TicketType } from "@/entities/tickets/type";
import { getApiBase } from "@/shared/api/client";
import {
  getMyOrders,
  cancelOrder as cancelOrderApi,
} from "@/shared/api/mypage";
import { logout as logoutApi } from "@/shared/api/auth";
import { mapOrderResponseToTicket } from "@/shared/api/mappers";
import type { MyPageResponse } from "@/shared/api/types";

function won(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

/** 경기일시가 지나서 만료된 티켓인지 (경기 보러 가서 만료 = 이미 지난 경기) */
function isExpired(t: TicketType): boolean {
  if (!t.game?.gameAtISO) return false;
  return new Date(t.game.gameAtISO) < new Date();
}

function MyPageContent() {
  const authed = useRequireAuth();
  const router = useRouter();

  const user = useAuthStore((s) => s.user);
  const logoutStore = useAuthStore((s) => s.logout);
  const isAdminStore = useAdminStore((s) => s.isAdmin);
  const isAdmin =
    user?.role === "ROLE_ADMIN" ||
    (isAdminStore &&
      (user?.email === "admin" || user?.email === "admin@admin"));

  const hydrateTickets = useTicketStore((s) => s.hydrate);
  const tickets = useTicketStore((s) => s.items);
  const cancelTicket = useTicketStore((s) => s.cancel);

  const [tab, setTab] = useState<"confirmed" | "cancelled_expired">(
    "confirmed",
  );
  const [ordersFromApi, setOrdersFromApi] = useState<MyPageResponse | null>(
    null,
  );

  useEffect(() => {
    if (!getApiBase()) hydrateTickets();
  }, [hydrateTickets]);

  useEffect(() => {
    if (!getApiBase()) return;
    getMyOrders()
      .then(setOrdersFromApi)
      .catch(() => setOrdersFromApi(null));
  }, []);

  const confirmedTickets = useMemo(() => {
    if (getApiBase() && ordersFromApi) {
      return ordersFromApi.activeOrders.map(mapOrderResponseToTicket);
    }
    return tickets.filter((t) => t.status === "ACTIVE" && !isExpired(t));
  }, [ordersFromApi, tickets]);

  const cancelledOrExpiredTickets = useMemo(() => {
    if (getApiBase() && ordersFromApi) {
      return ordersFromApi.inactiveOrders
        .filter((o) => o.orderStatus !== "PENDING")
        .map(mapOrderResponseToTicket);
    }
    return tickets.filter((t) => t.status === "CANCELLED" || isExpired(t));
  }, [ordersFromApi, tickets]);

  const refetchOrders = () => {
    if (getApiBase()) {
      getMyOrders()
        .then(setOrdersFromApi)
        .catch(() => setOrdersFromApi(null));
    }
  };

  const handleCancelTicket = (id: string) => {
    if (getApiBase()) {
      cancelOrderApi(Number(id))
        .then(() => {
          refetchOrders();
          useNotificationStore.getState().add("info", "예매가 취소되었습니다.");
        })
        .catch((e: unknown) => {
          const err = e as { response?: { data?: { message?: string } } };
          const msg = err?.response?.data?.message ?? "취소에 실패했습니다.";
          useNotificationStore.getState().add("error", msg);
        });
    } else {
      cancelTicket(id);
      useNotificationStore.getState().add("info", "예매가 취소되었습니다.");
    }
  };

  const handleLogout = async () => {
    if (getApiBase()) {
      try {
        await logoutApi();
      } catch {
        // ignore
      }
    }
    logoutStore();
    router.push("/");
  };

  if (!authed) return null;

  return (
    <Container className="py-10">
      <div className="mx-auto max-w-3xl">
        <Card className="rounded-3xl border-2 border-[var(--border-subtle)] p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                My Page
              </p>
              <div className="mt-2 text-2xl font-black tracking-tight text-[var(--text-primary)]">
                {user?.name ?? "사용자"}
              </div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">
                {user?.email}
              </div>
              {user?.phone ? (
                <div className="mt-1 text-sm text-[var(--text-muted)]">
                  {user.phone}
                </div>
              ) : null}
              <div className="mt-3 text-xs text-[var(--text-muted)]">
                예매확정 {confirmedTickets.length}개
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 sm:flex-row">
              {isAdmin ? (
                <Link
                  href="/admin"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border-2 border-[var(--accent)] bg-[var(--accent-muted)] px-5 text-sm font-bold text-[var(--accent)] hover:opacity-90"
                >
                  관리자 페이지
                </Link>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-5 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                <LogOut className="h-4 w-4" />
                로그아웃
              </button>
            </div>
          </div>
        </Card>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            내 티켓
          </div>
          <Link
            href="/schedule"
            className="text-xs font-bold text-[var(--text-muted)] hover:underline"
          >
            경기 보러가기 →
          </Link>
        </div>

        {/* 탭: 예매확정 / 예매취소·만료 */}
        <div className="mt-3 flex gap-1 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] p-1">
          <button
            type="button"
            onClick={() => setTab("confirmed")}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-sm font-semibold transition",
              tab === "confirmed"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
            )}
          >
            예매확정{" "}
            {confirmedTickets.length > 0 && `(${confirmedTickets.length})`}
          </button>
          <button
            type="button"
            onClick={() => setTab("cancelled_expired")}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-sm font-semibold transition",
              tab === "cancelled_expired"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
            )}
          >
            예매취소·만료{" "}
            {cancelledOrExpiredTickets.length > 0 &&
              `(${cancelledOrExpiredTickets.length})`}
          </button>
        </div>

        <div className="mt-3 grid gap-3">
          {tab === "confirmed" && (
            <>
              {confirmedTickets.length === 0 ? (
                <EmptyState
                  icon={<Ticket className="h-6 w-6" />}
                  title="예매확정 티켓이 없어요"
                  description="예매 후 결제 완료한 티켓이 여기에 표시돼요."
                  actionLabel="일정 보러가기"
                  actionHref="/schedule"
                />
              ) : (
                confirmedTickets.map((t) => (
                  <TicketCard
                    key={t.id}
                    t={t}
                    cancelTicket={handleCancelTicket}
                    badge="예매완료"
                    showCancel
                  />
                ))
              )}
            </>
          )}

          {tab === "cancelled_expired" && (
            <>
              {cancelledOrExpiredTickets.length === 0 ? (
                <EmptyState
                  icon={<Ticket className="h-6 w-6" />}
                  title="예매취소·만료된 티켓이 없어요"
                  description="취소했거나 경기가 지난 티켓이 여기에 표시돼요."
                />
              ) : (
                cancelledOrExpiredTickets.map((t) => {
                  const cancelled = t.status === "CANCELLED";
                  const expired = !cancelled && isExpired(t);
                  const badge = cancelled ? "예매취소" : "만료";
                  return (
                    <TicketCard
                      key={t.id}
                      t={t}
                      cancelTicket={cancelTicket}
                      badge={badge}
                      showCancel={false}
                      isCancelledOrExpired
                    />
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </Container>
  );
}

export default function () {
  return (
    <Suspense
      fallback={
        <Container className="py-14">
          <div className="text-center text-[var(--text-muted)]">로딩 중…</div>
        </Container>
      }
    >
      <MyPageContent />
    </Suspense>
  );
}

function TicketCard({
  t,
  cancelTicket,
  badge,
  showCancel,
  isCancelledOrExpired,
}: {
  t: TicketType;
  cancelTicket: (id: string) => void;
  badge: string;
  showCancel: boolean;
  isCancelledOrExpired?: boolean;
}) {
  const cancelled = t.status === "CANCELLED";
  const title = t.game
    ? `${t.game.awayTeam} vs ${t.game.homeTeam}`
    : `티켓 ${t.id}`;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {title}
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                isCancelledOrExpired
                  ? "border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-muted)]"
                  : "bg-[var(--accent)] text-white",
              )}
            >
              {badge}
            </span>
          </div>

          {t.game ? (
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              <div>{formatYYYYMMDDKorean(t.game.gameAtISO)}</div>
              <div>
                {fromKstIso(t.game.gameAtISO).time} KST • {t.game.stadium}
              </div>
            </div>
          ) : null}

          <div className="mt-2 line-clamp-1 text-xs text-[var(--text-secondary)]">
            좌석: {t.seats.map((s) => s.label).join(", ")}
          </div>

          <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {won(t.totalPrice)}{" "}
            <span className="text-xs font-normal text-[var(--text-muted)]">
              · {t.paymentMethod}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <Link
            href={`/tickets/${t.id}`}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-center text-xs font-semibold text-white hover:opacity-90"
          >
            보기
          </Link>

          {showCancel && (
            <button
              type="button"
              disabled={cancelled}
              onClick={() => {
                if (cancelled) return;
                if (!confirm("이 티켓을 예매취소할까요?")) return;
                cancelTicket(t.id);
                useNotificationStore
                  .getState()
                  .add("info", "예매가 취소되었습니다.");
              }}
              className={cn(
                "rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold transition",
                cancelled
                  ? "cursor-not-allowed bg-[var(--surface)] text-[var(--text-muted)]"
                  : "bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
              )}
            >
              예매취소
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
