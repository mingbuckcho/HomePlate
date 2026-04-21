/**
 * 구역별 좌석 상태 (여유 / 매진 임박 / 매진).
 * 백엔드 연동 시 GET /games/{gameId}/zones/{zoneId}/seats 응답으로
 * remaining, total 계산 후 70% 미만=여유, 70% 이상=매진 임박, 0=매진 으로 교체.
 */
export type ZoneSeatStatus = "여유" | "매진 임박" | "매진";

/** 백엔드에서 구역별 잔여 좌석 수 내려주면 그걸로 계산해 사용. 현재는 기본값만 반환. */
export function getZoneSeatStatus(
  _gameId: string,
  _zoneId: string,
): ZoneSeatStatus {
  return "여유";
}
