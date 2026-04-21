export type GameStatus =
  | "예매전"
  | "예매오픈"
  | "예매중"
  | "종료"
  | "우천취소"
  | "매진";

export type ForcedStatus = "매진" | "종료" | "우천취소";

export type Game = {
  /** 관리자 입력 GID (예: g-20260328-LG-KT) */
  id: string;

  awayTeam: string;
  homeTeam: string;
  stadium: string;

  /** 실제 경기 시작 시각 (KST 기준 ISO 권장) */
  gameAtISO: string;

  /** 예매 오픈 시각 (KST 기준 ISO 권장) */
  openAtISO: string;

  /** 홈 배너/포스터 URL (public 경로 또는 외부 URL) */
  bannerUrl?: string;

  /** 강제 상태 (있으면 자동 계산보다 우선) */
  forcedStatus?: ForcedStatus | "";

  /** 자동 종료(경기 시작 24시간 전부터 종료로 표시) */
  autoCloseEnabled?: boolean;

  /** 백엔드 관리자 API gameStatus (있으면 표시 우선) */
  backendGameStatus?: "SCHEDULED" | "OPEN" | "ENDED";

  /** 계산된 상태(프론트에서만 사용) */
  status?: GameStatus;
};
