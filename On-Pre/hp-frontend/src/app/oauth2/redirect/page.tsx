"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/features/auth/store";
import { getApiBase } from "@/shared/api/client";

/** JWT payload에서 sub(이메일) 추출 (서명 검증 없이 표시용) */
function parseJwtPayload(token: string): { sub?: string } {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return {};
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as { sub?: string };
  } catch {
    return {};
  }
}

function OAuth2RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setLogin = useAuthStore((s) => s.setLogin);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    const accessToken = searchParams.get("accessToken");
    if (!accessToken) {
      setStatus("error");
      return;
    }
    const payload = parseJwtPayload(accessToken);
    const email = payload.sub ?? "";
    setLogin({
      accessToken,
      email,
      name: email || "사용자",
    });
    setStatus("done");
    let next = searchParams.get("next") ?? "/";
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("oauth_next");
      if (stored) {
        sessionStorage.removeItem("oauth_next");
        next = stored;
      }
    }
    router.replace(next);
  }, [searchParams, setLogin, router]);

  if (status === "error") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6">
        <p className="text-[var(--text-primary)]">
          로그인 정보를 받지 못했어요.
        </p>
        <a
          href="/auth/login"
          className="rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white"
        >
          로그인 페이지로
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center text-[var(--text-muted)]">
      로그인 완료, 이동 중…
    </div>
  );
}

export default function OAuth2RedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center text-[var(--text-muted)]">
          로그인 처리 중…
        </div>
      }
    >
      <OAuth2RedirectContent />
    </Suspense>
  );
}
