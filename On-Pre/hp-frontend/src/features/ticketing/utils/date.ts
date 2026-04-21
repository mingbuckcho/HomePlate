import type { DayType } from "@/features/ticketing/maps/types";

export const YEAR = 2026 as const;

export function isWeekendByDate(year: number, month: number, day: number) {
  const d = new Date(year, month - 1, day);
  const w = d.getDay(); // 0 Sun ... 6 Sat
  return w === 0 || w === 6;
}

// ✅ 백엔드 붙기 전: gid에서 날짜를 최대한 뽑아내기(없으면 fallback)
export function parseMonthDayFromGid(gid: string): { month: number; day: number } {
  // 예: g-0328-kt-lg-1 같은 패턴이면 03/28 사용
  const m = gid.match(/-(\d{2})(\d{2})-/);
  if (m) return { month: Number(m[1]), day: Number(m[2]) };
  return { month: 3, day: 28 };
}

export function dayTypeFromGid(gid: string, year: number = YEAR): DayType {
  const { month, day } = parseMonthDayFromGid(gid);
  return isWeekendByDate(year, month, day) ? "weekend" : "weekday";
}
