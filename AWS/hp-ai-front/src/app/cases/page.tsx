"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useCallback } from "react";
import { getCases, type ListCasesParams } from "@/lib/api";
import type { CaseListItem } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ChevronRight } from "lucide-react";
import { cn, formatLocalDateTime } from "@/lib/utils";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 19);
}

function formatLastSeenKst(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

const LAYER_TABS = [
  { value: "", label: "All" },
  { value: "infrastructure", label: "infrastructure" },
  { value: "platform", label: "platform" },
  { value: "delivery", label: "delivery" },
  { value: "observability", label: "observability" },
  { value: "data", label: "data" },
  { value: "ux", label: "ux" },
  { value: "application", label: "application" },
  { value: "unknown", label: "unknown" },
];

function CasesListContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const layer = searchParams.get("layer") ?? "";

  const [items, setItems] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [severity, setSeverity] = useState<string>("");
  const [namespace, setNamespace] = useState<string>("");
  const [service, setService] = useState<string>("");
  const [timeRange, setTimeRange] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const setLayerInUrl = useCallback(
    (value: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (value) p.set("layer", value);
      else p.delete("layer");
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const load = useCallback(() => {
    setLoading(true);
    const params: ListCasesParams = { limit: 100, offset: 0 };
    if (status) params.status = status;
    if (severity) params.severity = severity;
    if (layer) params.layer = layer;
    if (namespace) params.namespace = namespace;
    if (service) params.service = service;
    if (search.trim()) params.search = search.trim();
    const now = new Date();
    if (timeRange === "24h") {
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      params.time_from = formatDate(from);
      params.time_to = formatDate(now);
    } else if (timeRange === "7d") {
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      params.time_from = formatDate(from);
      params.time_to = formatDate(now);
    }
    getCases(params)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [status, severity, layer, namespace, service, timeRange, search]);

  useEffect(() => {
    load();
  }, [load]);

  const severityClass = (s: string | null) => {
    if (!s) return "bg-gray-100 text-gray-700";
    const lower = s.toLowerCase();
    if (lower === "critical") return "bg-rose-100 text-rose-700";
    if (lower === "warning" || lower === "high")
      return "bg-amber-100 text-amber-700";
    if (lower === "info" || lower === "low") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl flex flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Case List
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage and track all system incidents (severity 우선 정렬)
          </p>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
          {LAYER_TABS.map((tab) => (
            <button
              key={tab.value || "all"}
              type="button"
              onClick={() => setLayerInUrl(tab.value)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                layer === tab.value
                  ? "bg-blue-500 text-white dark:bg-blue-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="relative min-w-[200px] flex-1">
            <input
              type="text"
              placeholder="Search by case key or alert name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
            />
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">All time</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <select
            value={layer}
            onChange={(e) => setLayerInUrl(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">All Layer</option>
            <option value="infrastructure">infrastructure</option>
            <option value="platform">platform</option>
            <option value="delivery">delivery</option>
            <option value="observability">observability</option>
            <option value="data">data</option>
            <option value="ux">ux</option>
            <option value="application">application</option>
            <option value="unknown">unknown</option>
          </select>
          <input
            type="text"
            placeholder="Namespace"
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="w-32 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
          />
          <input
            type="text"
            placeholder="Service"
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="w-32 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
          />
          <button
            type="button"
            onClick={load}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            Apply
          </button>
        </div>

        {loading ? (
          <LoadingSkeleton
            lines={8}
            className="rounded-2xl border border-gray-200 bg-white p-6"
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="현재 신호 없음"
            description="조건에 맞는 케이스가 없거나 아직 수집 전입니다."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-600 dark:bg-gray-700/80">
                  <th className="px-6 py-3 font-semibold text-gray-500 dark:text-gray-300">
                    Case Key
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-500 dark:text-gray-300">
                    Severity
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-500 dark:text-gray-300">
                    Layer
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-500 dark:text-gray-300">
                    Status
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-500 dark:text-gray-300">
                    Namespace
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-500 dark:text-gray-300">
                    Service
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-500 text-right dark:text-gray-300">
                    Last seen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-600">
                {items.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50/50 transition-colors dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/cases/${c.id}`}
                        className="font-mono text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {c.case_key}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "rounded-lg px-2 py-1 text-xs font-semibold",
                          severityClass(c.severity),
                        )}
                      >
                        {c.severity ?? "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {c.layer ?? "-"}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {c.status}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {c.namespace ?? "-"}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {c.service ?? "-"}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-400 dark:text-gray-500">
                      <span className="flex items-center justify-end gap-2">
                        {formatLastSeenKst(c.last_seen_at)}
                        <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-500" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CasesListPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-950">
          <div className="mx-auto max-w-7xl">
            <LoadingSkeleton lines={8} className="rounded-2xl p-6" />
          </div>
        </div>
      }
    >
      <CasesListContent />
    </Suspense>
  );
}
