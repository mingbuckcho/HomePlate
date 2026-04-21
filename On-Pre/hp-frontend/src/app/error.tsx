"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-[var(--accent)]">
          오류가 발생했습니다
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          일시적인 문제가 생겼어요
        </h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
          잠시 후 다시 시도해 주세요. 계속되면 고객센터로 문의해 주세요.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-11 items-center rounded-xl bg-[var(--accent)] px-6 text-sm font-semibold text-white hover:opacity-90"
          >
            다시 시도
          </button>
          <a
            href="/"
            className="inline-flex h-11 items-center rounded-xl border border-[var(--border-focus)] bg-[var(--surface)] px-6 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            홈으로
          </a>
        </div>
      </div>
    </div>
  );
}
