import { getApiBase, getAccessToken } from "@/shared/api/client";
import { lockSeats } from "@/shared/api/book";

/** 다른 사람이 예약 중인 좌석 목록만 조회하는 폴링 주기(ms). 좌석 배치/매진 등 전체 리프레시 아님. */
const CLAIMED_POLL_MS = 5000;

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  const key = "booking-session-id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function getBookingSessionId(): string {
  return getSessionId();
}

export type ReserveResult =
  | { ok: true }
  | { ok: false; takenSeats?: string[]; message?: string };

/**
 * 결제로 넘어가기 전 좌석 선점 시도.
 * - 백엔드 연동 시: shared/api/book lockSeats (POST /book/{gameId}/seats/lock)
 * - 로컬: /api/booking/reserve
 */
export async function reserveSeats(
  gameId: string,
  zoneId: string,
  seatIds: string[],
): Promise<ReserveResult> {
  if (getApiBase()) {
    const token = getAccessToken();
    if (!token) {
      console.warn(
        "[Booking] AccessToken 유실: sessionStorage(localStorage)에 AccessToken이 없습니다. 로그인 후 예매해 주세요. (Application 탭에서 homeplate_auth_session_v1 확인)",
      );
      return {
        ok: false,
        message:
          "로그인 세션이 없습니다. 다시 로그인한 뒤 예매해 주세요. (AccessToken 없음)",
      };
    }
    const result = await lockSeats(gameId, seatIds);
    if (result.ok) return { ok: true };
    return { ok: false, message: result.message };
  }

  const sessionId = getSessionId();
  const res = await fetch("/api/booking/reserve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, zoneId, seatIds, sessionId }),
  });
  if (res.status === 409) {
    const data = await res.json();
    return { ok: false, takenSeats: data.takenSeats ?? [] };
  }
  if (!res.ok) throw new Error("Reserve failed");
  return { ok: true };
}

/**
 * 해당 구역에서 예약 중/매진인 좌석 코드 목록 (폴링용).
 * 백엔드 연동 시 GET /book/{gameId}/zones/{zoneNumber} 에서 isBooked 인 seatCode 반환.
 */
export async function fetchClaimedSeats(
  gameId: string,
  zoneId: string,
): Promise<string[]> {
  if (getApiBase()) {
    try {
      const { getZoneSeats } = await import("@/shared/api/book");
      const zone = await getZoneSeats(gameId, zoneId);
      return (zone.seats ?? [])
        .filter((s) => s.isBooked)
        .map((s) => s.seatCode);
    } catch {
      return [];
    }
  }
  const res = await fetch(
    `/api/booking/claimed?gameId=${encodeURIComponent(gameId)}&zoneId=${encodeURIComponent(zoneId)}`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.seatIds) ? data.seatIds : [];
}

export { CLAIMED_POLL_MS };
