import type { Game, GameStatus } from "@/entities/game/type";

export function computeGameStatus(game: Game, nowMs = Date.now()): GameStatus {
  // 1) 관리자 강제 상태 (우천취소는 관리자만 설정)
  if (game.forcedStatus === "매진") return "매진";
  if (game.forcedStatus === "우천취소") return "우천취소";
  if (game.forcedStatus === "종료") return "종료";

  // 2) 자동 종료: 경기 시작 24시간 전부터 종료
  const autoClose = game.autoCloseEnabled !== false;
  if (autoClose) {
    const gameAtMs = new Date(game.gameAtISO).getTime();
    const closeAtMs = gameAtMs - 24 * 60 * 60 * 1000;
    if (nowMs >= closeAtMs) return "종료";
  }

  // 3) 예매 오픈 전/후 (오픈 후에는 모두 "예매 오픈"으로 표시)
  const openAtMs = new Date(game.openAtISO).getTime();
  if (nowMs < openAtMs) return "예매전";
  return "예매오픈";
}

export function withComputedStatus(game: Game, nowMs = Date.now()): Game {
  return { ...game, status: computeGameStatus(game, nowMs) };
}
