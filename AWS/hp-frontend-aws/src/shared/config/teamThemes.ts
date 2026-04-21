/**
 * 팀별 티켓/UI 테마 (마이페이지 티켓 보기 등)
 * primary: 메인 배경색, secondary: 보조(선택)
 */
export const TEAM_THEMES: Record<
  string,
  { primary: string; secondary?: string; name: string }
> = {
  LG: { primary: "#C41E3A", secondary: "#8B0000", name: "LG 트윈스" },
  KT: { primary: "#000000", secondary: "#FFFFFF", name: "KT 위즈" },
  SSG: { primary: "#CE0E2D", name: "SSG 랜더스" },
  NC: { primary: "#315288", name: "NC 다이노스" },
  두산: { primary: "#131230", secondary: "#C41E3A", name: "두산 베어스" },
  KIA: { primary: "#FFFFFF", secondary: "#000000", name: "KIA 타이거즈" },
  롯데: { primary: "#041E42", secondary: "#C41E3A", name: "롯데 자이언츠" },
  삼성: { primary: "#074CA1", name: "삼성 라이온즈" },
  한화: { primary: "#FF6600", name: "한화 이글스" },
  키움: { primary: "#570514", name: "키움 히어로즈" },
};

/** 표기명(예: "LG 트윈스", "KT 위즈") 또는 키(예: "LG", "KT") → 테마 키 */
export function getTeamThemeKey(team: string): string {
  if (!team) return "";
  if (TEAM_THEMES[team]) return team;
  for (const [key, value] of Object.entries(TEAM_THEMES)) {
    if (value.name === team || team === key) return key;
    if (team.startsWith(key) || value.name.startsWith(team)) return key;
  }
  return team;
}

export function getTeamTheme(team: string) {
  const key = getTeamThemeKey(team);
  return (key ? TEAM_THEMES[key] : null) ?? { primary: "#1a1a1a", name: team };
}
