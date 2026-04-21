"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/features/auth/store";

/**
 * Client-side auth guard.
 * - If not authenticated, redirects to /auth/login?next=...
 */
export function useRequireAuth() {
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isAuthed) return;
    const qs = searchParams?.toString();
    const next = `${pathname}${qs ? `?${qs}` : ""}`;
    router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
  }, [isAuthed, router, pathname, searchParams]);

  return isAuthed;
}
