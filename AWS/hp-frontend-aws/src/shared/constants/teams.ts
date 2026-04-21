/**
 * 팀 관련 공통 상수
 * 백엔드 DB teams 테이블의 team_id와 일치해야 함
 *
 * 실제 DB team_id: LG, KT, SSG, NC, DOOSAN, KIA, LOTTE, SAMSUNG, HANWHA, KIWOOM
 * 구단 로고: 프론트 public/teams/ 에 두고, DB에는 아래 경로(확장자 포함)만 저장
 */

export const TEAM_SHORT_TO_ID: Record<string, string> = {
  // 약칭
  LG: "LG",
  KT: "KT",
  SSG: "SSG",
  NC: "NC",
  두산: "DOOSAN",
  KIA: "KIA",
  롯데: "LOTTE",
  삼성: "SAMSUNG",
  한화: "HANWHA",
  키움: "KIWOOM",
  // 한글 풀네임 (백엔드에서 팀 이름을 풀네임으로 내려주는 경우 대응)
  "LG 트윈스": "LG",
  "한화 이글스": "HANWHA",
  "SSG 랜더스": "SSG",
  "삼성 라이온즈": "SAMSUNG",
  "NC 다이노스": "NC",
  "KT 위즈": "KT",
  "롯데 자이언츠": "LOTTE",
  "KIA 타이거즈": "KIA",
  "두산 베어스": "DOOSAN",
  "키움 히어로즈": "KIWOOM",
};

export const TEAM_ID_TO_SHORT: Record<string, string> = {
  LG: "LG",
  KT: "KT",
  SSG: "SSG",
  NC: "NC",
  DOOSAN: "두산",
  KIA: "KIA",
  LOTTE: "롯데",
  SAMSUNG: "삼성",
  HANWHA: "한화",
  KIWOOM: "키움",
};

export const TEAMS_LIST = [
  {
    id: "LG",
    shortName: "LG",
    fullName: "LG 트윈스",
    logoUrl: "/teams/LG.png",
  },
  { id: "KT", shortName: "KT", fullName: "KT 위즈", logoUrl: "/teams/KT.png" },
  {
    id: "SSG",
    shortName: "SSG",
    fullName: "SSG 랜더스",
    logoUrl: "/teams/SSG.png",
  },
  {
    id: "NC",
    shortName: "NC",
    fullName: "NC 다이노스",
    logoUrl: "/teams/NC.png",
  },
  {
    id: "DOOSAN",
    shortName: "두산",
    fullName: "두산 베어스",
    logoUrl: "/teams/DOOSAN.png",
  },
  {
    id: "KIA",
    shortName: "KIA",
    fullName: "KIA 타이거즈",
    logoUrl: "/teams/KIA.png",
  },
  {
    id: "LOTTE",
    shortName: "롯데",
    fullName: "롯데 자이언츠",
    logoUrl: "/teams/LOTTE.png",
  },
  {
    id: "SAMSUNG",
    shortName: "삼성",
    fullName: "삼성 라이온즈",
    logoUrl: "/teams/SAMSUNG.png",
  },
  {
    id: "HANWHA",
    shortName: "한화",
    fullName: "한화 이글스",
    logoUrl: "/teams/HANWHA.png",
  },
  {
    id: "KIWOOM",
    shortName: "키움",
    fullName: "키움 히어로즈",
    logoUrl: "/teams/KIWOOM.png",
  },
] as const;

/** 팀 로고 경로 (public/teams/ 기준, DB team_logo에 저장할 값) */
export function getTeamLogoUrl(teamId: string): string {
  if (!teamId) return "";
  return `/teams/${teamId}.png`;
}

export function toTeamId(shortNameOrId: string): string {
  if (!shortNameOrId) return "";
  return TEAM_SHORT_TO_ID[shortNameOrId] ?? shortNameOrId;
}

export function toTeamShortName(teamId: string): string {
  if (!teamId) return "";
  return TEAM_ID_TO_SHORT[teamId] ?? teamId;
}
