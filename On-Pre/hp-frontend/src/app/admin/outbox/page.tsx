"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminStore } from "@/features/admin/store";
import { useAuthStore } from "@/features/auth/store";
import { Logo } from "@/shared/ui/Logo";
import { getApiBase } from "@/shared/api/client";
import { getOutboxHistory } from "@/shared/api/admin";
import type {
  OutboxHistoryItem,
  OutboxHistoryStatus,
  PageOutboxHistory,
} from "@/shared/api/types";
import { logout as logoutApi } from "@/shared/api/auth";

const PAGE_SIZES = [10, 20, 50] as const;
const SORT_OPTIONS: Array<{
  value: "sentAt,desc" | "sentAt,asc";
  label: string;
}> = [
  { value: "sentAt,desc", label: "발송일시 최신순" },
  { value: "sentAt,asc", label: "발송일시 오래된순" },
];
const STATUS_OPTIONS: Array<{
  value: "" | OutboxHistoryStatus;
  label: string;
}> = [
  { value: "", label: "전체" },
  { value: "SUCCESS", label: "전송 성공" },
  { value: "FAILURE", label: "전송 실패" },
];

export default function AdminOutboxPage() {
  const router = useRouter();
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const logoutAdmin = useAdminStore((s) => s.logout);
  const logoutAuth = useAuthStore((s) => s.logout);

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [sort, setSort] = useState<"sentAt,asc" | "sentAt,desc">("sentAt,desc");
  const [statusFilter, setStatusFilter] = useState<"" | OutboxHistoryStatus>(
    "",
  );
  const [data, setData] = useState<PageOutboxHistory | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(() => {
    if (!getApiBase()) return;
    setLoading(true);
    getOutboxHistory({ page, size, sort })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page, size, sort]);

  useEffect(() => {
    if (!isAdmin) {
      router.replace("/admin");
      return;
    }
    fetchData();
  }, [isAdmin, router, fetchData]);

  const rows: OutboxHistoryItem[] = data?.content ?? [];
  const filteredRows =
    statusFilter === ""
      ? rows
      : rows.filter((r) => r.historyStatus === statusFilter);
  const totalElements = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--text-muted)]">
        이동 중…
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--page-bg)", color: "var(--text-primary)" }}
    >
      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--page-bg)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-base font-bold tracking-tight">
            <Logo />
            <span className="text-[var(--text-muted)]">ADMIN</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-xs font-bold hover:bg-[var(--surface-hover)]"
            >
              경기 관리
            </Link>
            <Link
              href="/"
              className="rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-xs font-bold hover:bg-[var(--surface-hover)]"
            >
              홈
            </Link>
            <button
              type="button"
              onClick={async () => {
                try {
                  await logoutApi();
                } catch {
                  /* 무시 */
                }
                logoutAdmin();
                logoutAuth();
                if (typeof window !== "undefined") window.location.href = "/";
              }}
              className="rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-xs font-bold hover:bg-[var(--surface-hover)]"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-2xl font-black text-[var(--text-primary)]">
          이메일 발송 이력
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          결제 완료/취소 알림 발송 성공·실패 이력 (OUTBOX)
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              페이지당 개수
            </span>
            <select
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value));
                setPage(0);
              }}
              className="input-base h-10 rounded-xl px-3 text-sm"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}개
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              정렬
            </span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as "sentAt,asc" | "sentAt,desc");
                setPage(0);
              }}
              className="input-base h-10 rounded-xl px-3 text-sm"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              전송 결과
            </span>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "" | OutboxHistoryStatus)
              }
              className="input-base h-10 rounded-xl px-3 text-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="mt-8 text-center text-[var(--text-muted)]">
            불러오는 중…
          </div>
        ) : (
          <>
            <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-hover)]">
                    <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">
                      이력 ID
                    </th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">
                      주문 ID
                    </th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">
                      사용자 ID
                    </th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">
                      전송 결과
                    </th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-muted)]">
                      발송일시
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-[var(--text-muted)]"
                      >
                        {rows.length === 0
                          ? "발송 이력이 없습니다."
                          : "선택한 조건에 맞는 이력이 없습니다."}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => (
                      <tr
                        key={r.historyId}
                        className="border-b border-[var(--border-subtle)] last:border-0"
                      >
                        <td className="px-4 py-3">{r.historyId}</td>
                        <td className="px-4 py-3">{r.orderId}</td>
                        <td className="px-4 py-3">{r.userId}</td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              r.historyStatus === "SUCCESS"
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {r.historyStatus === "SUCCESS" ? "성공" : "실패"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{r.sentAt}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  이전
                </button>
                <span className="text-sm text-[var(--text-muted)]">
                  {page + 1} / {totalPages} (총 {totalElements}건)
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            )}

            {statusFilter !== "" && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                ※ 전송 결과 필터는 현재 페이지 데이터만 적용됩니다. 백엔드
                API에서 상태별 조회를 지원하면 전체 데이터 기준으로 필터됩니다.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
