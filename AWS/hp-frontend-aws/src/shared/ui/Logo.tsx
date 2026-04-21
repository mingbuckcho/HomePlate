"use client";

import Link from "next/link";

/** 홈플레이트 로고 — HP(레드 박스) + HOMEPLATE 텍스트, 약간 빛나는 포인트 */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-3 group ${className ?? ""}`}
      aria-label="HOMEPLATE 홈"
    >
      <span className="relative">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-white font-black text-xl italic skew-x-[-8deg] shadow-[0_0_20px_rgba(227,27,35,0.45)] transition duration-300 group-hover:shadow-[0_0_24px_rgba(227,27,35,0.6)] group-hover:scale-105">
          HP
        </span>
        <span
          className="absolute -inset-1 rounded-lg bg-[var(--accent)] blur opacity-20 transition group-hover:opacity-35"
          aria-hidden
        />
      </span>
      <span className="logo-text hidden font-black tracking-tighter text-[var(--text-primary)] md:inline md:text-xl uppercase italic drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
        HOMEPLATE
      </span>
    </Link>
  );
}
