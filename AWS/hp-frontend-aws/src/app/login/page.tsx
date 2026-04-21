"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * 백엔드 OAuth 실패 시 리다이렉트: https://homeplate.site/login?error=social_login_failed
 * → /auth/login 으로 쿼리 유지하며 이동
 */
function LoginRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/auth/login?${qs}` : "/auth/login");
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center text-[var(--text-muted)]">
      로그인 페이지로 이동 중…
    </div>
  );
}

export default function LoginRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center text-[var(--text-muted)]">
          이동 중…
        </div>
      }
    >
      <LoginRedirectContent />
    </Suspense>
  );
}
