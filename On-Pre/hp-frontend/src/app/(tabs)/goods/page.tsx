"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ThemeSelect } from "@/shared/ui/ThemeSelect";
import { getApiBase } from "@/shared/api/client";
import { getGoodsList } from "@/shared/api/info";
import { toPublicImageUrl } from "@/shared/utils/imageUrl";
import type { GoodsResponse } from "@/shared/api/types";
import { TEAMS_LIST, toTeamId } from "@/shared/constants/teams";

const YEAR = 2026 as const;

const TEAMS = [
  { value: "", label: "전체" },
  ...TEAMS_LIST.map((t) => ({ value: t.shortName, label: t.shortName })),
] as const;

type SortKey = "기본" | "가격낮은순" | "가격높은순";

function formatPrice(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

function GoodsFallbackImage({ team }: { team: string }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center text-sm font-semibold"
      style={{ color: "var(--text-muted)", background: "var(--page-bg)" }}
    >
      {team} 굿즈
    </div>
  );
}

export default function GoodsPage() {
  const [goods, setGoods] = useState<GoodsResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("기본");
  const [query, setQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  const pageSize = 12;

  useEffect(() => {
    if (!getApiBase()) {
      setGoods([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const teamId = toTeamId(team) || undefined;
    getGoodsList(teamId)
      .then(setGoods)
      .catch(() => setGoods([]))
      .finally(() => setLoading(false));
  }, [team]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = goods.slice();
    if (q) list = list.filter((g) => g.goodsName.toLowerCase().includes(q));
    list.sort((a, b) => {
      if (sort === "가격낮은순") return a.goodsPrice - b.goodsPrice;
      if (sort === "가격높은순") return b.goodsPrice - a.goodsPrice;
      return 0;
    });
    return list;
  }, [goods, sort, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, totalPages]);

  const setTeamSafe = (t: string) => {
    setTeam(t);
    setPage(1);
  };

  const setSortSafe = (s: SortKey) => {
    setSort(s);
    setPage(1);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <section className="mb-8">
        <div className="text-2xl font-bold tracking-tight text-[var(--text-primary)] md:text-3xl">
          NEW ARRIVAL
        </div>
        <div className="mt-1 text-sm text-[var(--text-muted)]">
          {YEAR} KBO{" "}
          {new Date().toLocaleDateString("ko-KR", {
            month: "long",
            day: "numeric",
          })}{" "}
          출시
        </div>
        <div className="mt-2 text-sm text-[var(--text-muted)]">
          팬심을 담아 준비했습니다. HOMEPLATE 굿즈
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                팀
              </span>
              <ThemeSelect
                value={team}
                onChange={setTeamSafe}
                options={TEAMS.map((t) => ({
                  value: t.value,
                  label: t.label,
                }))}
                className="h-10 min-w-[100px]"
                aria-label="팀 필터"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                정렬
              </span>
              <ThemeSelect
                value={sort}
                onChange={(v) => setSortSafe(v as SortKey)}
                options={(
                  ["기본", "가격낮은순", "가격높은순"] as SortKey[]
                ).map((s) => ({ value: s, label: s }))}
                placeholder="기본"
                className="h-10 min-w-[120px]"
                aria-label="정렬 필터"
              />
            </div>
          </div>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="굿즈 검색"
            className="input-base h-10 w-[220px] rounded-xl px-3 text-sm"
          />
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-[var(--text-muted)]">
            로딩 중…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={
              goods.length === 0
                ? "등록된 굿즈가 없습니다"
                : "검색 결과가 없습니다"
            }
            description={
              goods.length === 0
                ? "백엔드에서 굿즈를 등록하면 여기에 표시됩니다."
                : "다른 팀이나 키워드로 검색해 보세요."
            }
            actionLabel="필터 초기화"
            onAction={() => {
              setTeam("");
              setQuery("");
              setSort("기본");
              setPage(1);
            }}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {pageItems.map((g) => (
                <a
                  key={g.goodsId}
                  href={g.goodsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-left transition hover:bg-[var(--surface-hover)]"
                >
                  <div className="aspect-square w-full overflow-hidden bg-[var(--page-bg)]">
                    {g.goodsThumbnail ? (
                      <img
                        src={
                          toPublicImageUrl(g.goodsThumbnail) ?? g.goodsThumbnail
                        }
                        alt={g.goodsName}
                        className="h-full w-full object-cover opacity-95 transition group-hover:opacity-100"
                      />
                    ) : (
                      <GoodsFallbackImage team={g.teamName} />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-2 text-sm font-medium text-[var(--text-primary)]">
                      {g.goodsName}
                    </div>
                    <div className="mt-1.5 text-sm font-bold text-[var(--accent)]">
                      {formatPrice(g.goodsPrice)}
                    </div>
                  </div>
                </a>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={cn(
                  "h-10 rounded-xl px-3 text-sm font-semibold transition",
                  page <= 1
                    ? "cursor-not-allowed bg-[var(--surface)] text-[var(--text-muted)]"
                    : "bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                )}
              >
                이전
              </button>
              <span className="px-3 text-sm text-[var(--text-muted)]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={cn(
                  "h-10 rounded-xl px-3 text-sm font-semibold transition",
                  page >= totalPages
                    ? "cursor-not-allowed bg-[var(--surface)] text-[var(--text-muted)]"
                    : "bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                )}
              >
                다음
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
