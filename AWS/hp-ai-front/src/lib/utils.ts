export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** CPU cores 표시 (소수점 2자리) */
export function formatCpuCores(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Number(value).toFixed(2)} cores`;
}

/** bytes → MiB/GiB 자동 변환 (1024 MiB 이상이면 GiB, 소수 1~2자리) */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return "-";
  const mib = bytes / 1024 / 1024;
  if (mib >= 1024) {
    const gib = mib / 1024;
    return `${gib.toFixed(gib >= 10 ? 1 : 2)} GiB`;
  }
  return `${mib.toFixed(mib >= 10 ? 1 : 2)} MiB`;
}

/** 로컬 시간 "HH:mm" (차트 X축 등) */
export function formatTimeHHmm(
  value: string | number | Date | null | undefined,
): string {
  if (value == null || value === "") return "";
  const d = new Date(
    typeof value === "number"
      ? value > 1e15
        ? value / 1e6
        : value > 1e12
          ? value
          : value * 1000
      : value,
  );
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 로컬 시간 "YYYY-MM-DD HH:mm:ss" (ISO/UTC 표기 금지) */
export function formatLocalDateTime(
  value: string | number | Date | null | undefined,
): string {
  if (value == null || value === "") return "";
  const d = new Date(
    typeof value === "number"
      ? value > 1e15
        ? value / 1e6
        : value > 1e12
          ? value
          : value * 1000
      : value,
  );
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const FALLBACK_ERROR = "오류가 발생했습니다. 재시도해 주세요.";

/** 에러 메시지 우선순위: prom_error || loki_error || tempo_error || 공통문구 */
export function getSnapshotErrorMessage(snapshot: {
  prom_error?: string | null;
  loki_error?: string | null;
  tempo_error?: string | null;
}): string {
  return (
    snapshot.prom_error ||
    snapshot.loki_error ||
    snapshot.tempo_error ||
    FALLBACK_ERROR
  );
}
