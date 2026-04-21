/**
 * 좌석 예약 메모리 저장소 (동시 선택 시 먼저 결제로 넘어간 사람이 좌석 확보).
 * 프로덕션에서는 Redis 등으로 교체 권장.
 */
export const RESERVE_TTL_MS = 5 * 60 * 1000; // 5분

export type Entry = { sessionId: string; expiresAt: number };

const store = new Map<string, Entry>();

export function reserveKey(gameId: string, zoneId: string, seatId: string) {
  return `${gameId}:${zoneId}:${seatId}`;
}

export function pruneExpired() {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.expiresAt <= now) store.delete(k);
  }
}

export function getEntry(
  gameId: string,
  zoneId: string,
  seatId: string,
): Entry | undefined {
  return store.get(reserveKey(gameId, zoneId, seatId));
}

export function setEntry(
  gameId: string,
  zoneId: string,
  seatId: string,
  entry: Entry,
) {
  store.set(reserveKey(gameId, zoneId, seatId), entry);
}

export function* listClaimed(
  gameId: string,
  zoneId: string,
): Generator<string> {
  const prefix = `${gameId}:${zoneId}:`;
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (k.startsWith(prefix) && v.expiresAt > now) {
      yield k.slice(prefix.length);
    }
  }
}
