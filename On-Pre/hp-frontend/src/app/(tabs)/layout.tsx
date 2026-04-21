"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Search, User } from "lucide-react";

import { cn } from "@/shared/utils/cn";
import { useAuthStore } from "@/features/auth/store";
import { useTicketStore } from "@/features/tickets/store";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { ToastList } from "@/features/notifications/Toast";
import { Chatbot } from "@/features/chatbot/Chatbot";
import { isFlowPopup } from "@/shared/constants/flowPopup";
import { Logo } from "@/shared/ui/Logo";

const NAV = [
  { href: "/", label: "HOME" },
  { href: "/schedule", label: "TICKETS" },
  { href: "/ranks", label: "RANK" },
  { href: "/goods", label: "GOODS" },
];

function titleFromPath(path: string) {
  if (path.startsWith("/queue")) return "대기열";
  if (path.startsWith("/games/") && path.includes("/zones/"))
    return "좌석 선택";
  if (path.startsWith("/games/") && path.endsWith("/zones")) return "구역 선택";
  if (path.startsWith("/games/")) return "경기 상세";
  if (path.startsWith("/checkout")) return "결제";
  if (path.startsWith("/tickets")) return "티켓";
  if (path.startsWith("/auth/")) return "로그인";
  return "HOMEPLATE";
}

function Footer() {
  const openSoon = (label: string) => alert(`${label} (준비중)`);

  return (
    <footer className="border-t border-white/10 bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <Logo className="[&_.logo-text]:text-white" />
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              대한민국 No.1 KBO 야구 포털 HomePlate.
              <br />
              팬들의 열정을 티켓으로, 기록을 감동으로 잇습니다.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--accent)]">
              Navigation
            </h4>
            <ul className="mt-4 space-y-3 text-sm font-semibold text-slate-400">
              <li>
                <Link href="/schedule" className="hover:text-white transition">
                  티켓 예매
                </Link>
              </li>
              <li>
                <Link href="/ranks" className="hover:text-white transition">
                  경기 기록
                </Link>
              </li>
              <li>
                <Link href="/goods" className="hover:text-white transition">
                  굿즈 샵
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--accent)]">
              Support
            </h4>
            <ul className="mt-4 space-y-3 text-sm font-semibold text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => openSoon("자주 묻는 질문")}
                  className="hover:text-white transition text-left"
                >
                  자주 묻는 질문
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => openSoon("1:1 문의")}
                  className="hover:text-white transition text-left"
                >
                  1:1 문의
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => openSoon("예매 정책")}
                  className="hover:text-white transition text-left"
                >
                  예매 정책
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--accent)]">
              Connect
            </h4>
            <div className="mt-4 flex gap-4">
              <button
                type="button"
                onClick={() => openSoon("인스타그램")}
                className="text-xl text-slate-400 hover:text-[var(--accent)] transition"
                aria-label="인스타그램"
              >
                ⌘
              </button>
              <button
                type="button"
                onClick={() => openSoon("유튜브")}
                className="text-xl text-slate-400 hover:text-[var(--accent)] transition"
                aria-label="유튜브"
              >
                ▶
              </button>
            </div>
          </div>
        </div>
        <div className="mt-16 border-t border-slate-800 pt-8 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
          © {new Date().getFullYear()} HOMEPLATE BASEBALL. ALL RIGHTS RESERVED.
        </div>
      </div>
    </footer>
  );
}

export default function TabsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [popupMode, setPopupMode] = useState(false);

  const { isAuthed } = useAuthStore();
  const hydrateTickets = useTicketStore((s) => s.hydrate);

  useEffect(() => {
    hydrateTickets?.();
  }, [hydrateTickets]);

  useEffect(() => {
    setPopupMode(isFlowPopup());
  }, []);

  const isTopTab = NAV.some((n) => n.href === pathname);

  // 대기열~결제 팝업: 탭/풀 헤더/푸터 없이 최소 헤더만
  if (popupMode) {
    return (
      <div
        className="min-h-screen"
        style={{ background: "var(--page-bg)", color: "var(--text-primary)" }}
      >
        <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--page-bg)]">
          <div className="flex h-14 items-center gap-3 px-4">
            {!pathname.startsWith("/checkout") ? (
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
                aria-label="뒤로"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            <span className="text-sm font-semibold text-[var(--text-secondary)]">
              {titleFromPath(pathname)}
            </span>
          </div>
        </header>
        <main>{children}</main>
        <ToastList />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--page-bg)", color: "var(--text-primary)" }}
    >
      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)]/50 bg-[var(--page-bg)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-6">
          <div className="flex min-w-[180px] items-center gap-2">
            {!isTopTab && !pathname.startsWith("/checkout") ? (
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
                aria-label="뒤로"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}

            <Logo className="hidden md:flex" />

            {!isTopTab ? (
              <div
                className="text-sm font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                {titleFromPath(pathname)}
              </div>
            ) : null}
          </div>

          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "relative rounded-xl px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                  )}
                >
                  {n.label}
                  {active ? (
                    <span
                      className="absolute -bottom-[10px] left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full"
                      style={{ background: "var(--accent)" }}
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-[180px] items-center justify-end gap-2">
            <ThemeToggle className="hidden sm:flex" />
            <button
              type="button"
              onClick={() => alert("검색은 준비중입니다.")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
              aria-label="검색"
            >
              <Search className="h-5 w-5" />
            </button>

            <Link
              href={isAuthed ? "/mypage" : "/auth/login"}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 hover:bg-[var(--surface-hover)]"
            >
              <User className="h-5 w-5" />
              <span className="hidden text-sm font-semibold md:inline">
                {isAuthed ? "My" : "Login"}
              </span>
            </Link>
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)] md:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "flex-1 rounded-xl px-2 py-2 text-center text-xs font-semibold transition",
                    active
                      ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                      : "text-[var(--text-muted)]",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main>{children}</main>
      <ToastList />
      <Footer />
      <Chatbot />
    </div>
  );
}
