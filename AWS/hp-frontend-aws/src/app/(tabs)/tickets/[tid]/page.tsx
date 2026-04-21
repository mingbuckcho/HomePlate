"use client";

import { useEffect, useMemo, useState, use as usePromise } from "react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";

import { Container } from "@/shared/ui/Container";
import { useTicketStore } from "@/features/tickets/store";
import { useRequireAuth } from "@/shared/hooks/useRequireAuth";
import { formatYYYYMMDDKorean, fromKstIso } from "@/shared/utils/datetime";
import { EmptyState } from "@/shared/ui/EmptyState";
import { clearFlowPopup } from "@/shared/constants/flowPopup";
import { getTeamTheme, getTeamThemeKey } from "@/shared/config/teamThemes";
import { TEAM_SHORT_TO_ID, getTeamLogoUrl } from "@/shared/constants/teams";
import { Check, MapPin } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { getApiBase } from "@/shared/api/client";
import { getMyOrders } from "@/shared/api/mypage";
import { mapOrderResponseToTicket } from "@/shared/api/mappers";
import type { Ticket as TicketType } from "@/entities/tickets/type";

function getTeamLogoUrlByTheme(themeKey: string): string | null {
  const teamId = TEAM_SHORT_TO_ID[themeKey];
  return teamId ? getTeamLogoUrl(teamId) : null;
}

function TicketInner({ tid }: { tid: string }) {
  const authed = useRequireAuth();
  const hydrate = useTicketStore((s) => s.hydrate);
  const items = useTicketStore((s) => s.items);
  const ticketFromStore = useMemo(
    () => items.find((x) => x.id === tid),
    [items, tid],
  );
  const [ticketFromApi, setTicketFromApi] = useState<
    TicketType | null | undefined
  >(undefined);

  useEffect(() => {
    if (!getApiBase()) hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!getApiBase() || !tid) return;
    getMyOrders()
      .then((res) => {
        const all = [...res.activeOrders, ...res.inactiveOrders];
        const order = all.find((o) => String(o.orderId) === tid);
        setTicketFromApi(order ? mapOrderResponseToTicket(order) : null);
      })
      .catch(() => setTicketFromApi(null));
  }, [tid]);

  const ticket = ticketFromApi !== undefined ? ticketFromApi : ticketFromStore;
  const [isPopup, setIsPopup] = useState(false);
  const awayTeam = ticket?.game?.awayTeam ?? "";
  const homeTeam = ticket?.game?.homeTeam ?? "";
  const [selectedTeam, setSelectedTeam] = useState<string>(
    () => awayTeam || homeTeam || "",
  );

  useEffect(() => {
    if (typeof window !== "undefined" && window.opener) setIsPopup(true);
  }, []);

  useEffect(() => {
    if (awayTeam && !selectedTeam) setSelectedTeam(awayTeam);
  }, [awayTeam, selectedTeam]);

  const qrStringForQr = ticket?.qrPayload ?? ticket?.id ?? "";
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!qrStringForQr) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(qrStringForQr, {
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [qrStringForQr]);

  if (!authed) return null;

  const themeKey = getTeamThemeKey(selectedTeam);
  const theme = getTeamTheme(selectedTeam);
  const logoUrl = themeKey ? getTeamLogoUrlByTheme(themeKey) : null;

  if (getApiBase() && ticketFromApi === undefined) {
    return (
      <Container className="py-14">
        <div className="text-center text-[var(--text-muted)]">불러오는 중…</div>
      </Container>
    );
  }

  if (!ticket) {
    return (
      <Container className="py-14">
        <EmptyState
          title="티켓을 찾을 수 없습니다"
          description="마이페이지에서 발급된 티켓을 확인해 주세요."
          actionLabel="마이페이지"
          actionHref="/mypage"
        />
      </Container>
    );
  }

  const cancelled = ticket.status === "CANCELLED";
  const game = ticket.game;
  const fixtureLabel = game ? `${game.awayTeam} VS ${game.homeTeam}` : "—";
  const dateStr = game ? formatYYYYMMDDKorean(game.gameAtISO) : "—";
  const timeStr = game ? fromKstIso(game.gameAtISO).time : "—";
  const reservationCode = ticket.id
    .toUpperCase()
    .replace(/^T-/, "HP-")
    .slice(0, 14);
  const gateLabel = "E-12";

  return (
    <Container className="py-10">
      <div className="mx-auto max-w-2xl">
        {/* Progress + Active Fixture row */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)] sm:text-3xl">
              MATCH PASS <span className="text-[var(--accent)]">BOOKING</span>
            </h1>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              <span>01 ZONE</span>
              <span>02 SEATS</span>
              <span className="text-[var(--accent)]">03 PAYMENT</span>
            </div>
          </div>
          {game && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">
                Active Fixture
              </p>
              <p className="mt-1 flex items-center gap-2 text-lg font-black text-[var(--text-primary)]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--page-bg)] text-[10px] font-bold text-[var(--text-muted)]">
                  VS
                </span>
                {fixtureLabel}
              </p>
            </div>
          )}
        </div>

        {/* 팀 탭: 티켓 색상/로고 선택 */}
        {game && (awayTeam || homeTeam) && (
          <div className="mb-6">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              티켓 스타일 (구단)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedTeam(awayTeam)}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-2xl border-2 py-3 text-sm font-black transition",
                  selectedTeam === awayTeam
                    ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                )}
              >
                {awayTeam}
              </button>
              <button
                type="button"
                onClick={() => setSelectedTeam(homeTeam)}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-2xl border-2 py-3 text-sm font-black transition",
                  selectedTeam === homeTeam
                    ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                )}
              >
                {homeTeam}
              </button>
            </div>
          </div>
        )}

        {/* Main ticket card - 팀 색상 + 구단 로고 */}
        <div
          className="overflow-hidden rounded-3xl border-2 shadow-xl"
          style={{
            borderColor: theme.primary,
            backgroundColor: "var(--surface)",
          }}
        >
          {/* Elite Pass band - 팀 primary 색, 구단 마크 오른쪽 상단(빨간 박스 위치) */}
          <div
            className="relative px-6 py-6 text-white"
            style={{ backgroundColor: theme.primary }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                <Check className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xl font-black uppercase tracking-tight">
                  Elite Pass Issued
                </p>
                <p className="mt-1 text-sm font-medium opacity-90">
                  ENJOY THE GAME AT {game?.stadium ?? "—"}
                </p>
              </div>
            </div>
            {/* 구단 마크: 카드 맨 위 오른쪽 코너(빨간 박스), 배경 없음 */}
            <div className="absolute right-4 top-4 h-14 w-14 sm:right-6 sm:top-6 sm:h-16 sm:w-16">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={theme.name}
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl sm:text-3xl">
                  ⚾
                </span>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap gap-6 border-b border-[var(--border-subtle)] pb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                  Fixture ID
                </p>
                <p className="mt-1 font-bold text-[var(--text-primary)]">
                  {fixtureLabel}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                  Reservation Code
                </p>
                <p className="mt-1 font-black text-[var(--accent)]">
                  {reservationCode}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div className="col-span-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  경기일시
                </p>
                <p className="mt-0.5 font-semibold text-[var(--text-primary)]">
                  {dateStr}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
                  {timeStr} KST
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  Zone
                </p>
                <p className="mt-0.5 font-semibold text-[var(--text-primary)]">
                  {ticket.zoneId ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  Seats
                </p>
                <p className="mt-0.5 font-semibold text-[var(--text-primary)]">
                  {ticket.seats.length
                    ? ticket.seats.map((s) => s.label).join(", ")
                    : "—"}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center">
              {qrDataUrl && !cancelled && (
                <div className="flex shrink-0 items-center justify-center rounded-2xl border-2 border-[var(--border-subtle)] bg-white p-3">
                  <img
                    src={qrDataUrl}
                    alt="티켓 QR"
                    width={200}
                    height={200}
                    className="h-[200px] w-[200px]"
                  />
                </div>
              )}
              <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                SCAN AT STADIUM GATE {gateLabel}
              </p>
            </div>

            {cancelled && (
              <div className="mt-6 rounded-2xl border border-[var(--accent)] bg-[var(--accent-muted)] px-4 py-3 text-center text-sm font-bold text-[var(--accent)]">
                취소된 티켓입니다.
              </div>
            )}

            <Link
              href="/mypage"
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--page-bg)] py-4 text-sm font-bold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
            >
              <MapPin className="h-5 w-5" />
              RETURN TO DASHBOARD
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {isPopup && (
            <button
              type="button"
              onClick={() => {
                clearFlowPopup();
                if (window.opener) {
                  window.opener.location.href = "/mypage";
                  window.opener.focus();
                }
                window.close();
              }}
              className="rounded-2xl bg-[var(--accent)] px-6 py-3.5 text-sm font-bold text-white hover:opacity-90"
            >
              창 닫기
            </button>
          )}
          <Link
            href="/mypage"
            className="rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-3.5 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            마이페이지로
          </Link>
        </div>
      </div>
    </Container>
  );
}

function TicketDetailPage({ params }: { params: Promise<{ tid: string }> }) {
  const { tid } = usePromise(params);
  return <TicketInner tid={tid} />;
}

export default TicketDetailPage;
