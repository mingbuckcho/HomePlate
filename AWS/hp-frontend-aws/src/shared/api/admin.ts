import { http } from "@/shared/api/http";
import type {
  AdminGameResponse,
  PageAdminGames,
  PageOutboxHistory,
} from "@/shared/api/types";

/**
 * Swagger: AdminController
 * - POST /admin (경기 생성)
 * - PUT /admin/{gameId} (경기 수정)
 * - DELETE /admin/{gameId} (경기 삭제)
 * 인증 필요 + ADMIN 역할.
 *
 * 구장/팀 ID는 docs/seed-stadiums-teams.sql 에 등록된 값과 동일해야 합니다.
 */

/** 한글 구장명(짧은 이름) → 백엔드 stadium_id (DB와 동일한 영어 ID) */
export const STADIUM_NAME_TO_ID: Record<string, string> = {
  잠실: "SEOUL",
  인천: "INCHEON",
  수원: "SUWON",
  광주: "GWANGJU",
  대구: "DAEGU",
  사직: "SAJIK",
  창원: "CHANGWON",
  고척: "GOCHEOCK",
  대전: "DAEJEON",
};

/** API/DB 구장 전체명(stadium_name) → stadium_id (수정 폼 로드 시 사용) */
export const STADIUM_FULLNAME_TO_ID: Record<string, string> = {
  "서울종합운동장 야구장": "SEOUL",
  인천SSG랜더스필드: "INCHEON",
  수원케이티위즈파크: "SUWON",
  광주기아챔피언스필드: "GWANGJU",
  대구삼성라이온즈파크: "DAEGU",
  사직야구장: "SAJIK",
  창원NC파크: "CHANGWON",
  고척스카이돔: "GOCHEOCK",
  대전한화생명볼파크: "DAEJEON",
};

/** 관리자 구장 선택 옵션: value=영어 stadium_id(DB와 동일), label=한글 표시명 */
export const ADMIN_STADIUM_OPTIONS = Object.entries(STADIUM_NAME_TO_ID).map(
  ([label, value]) => ({ value, label }),
);

/** 수정 폼에서 구장이 API 응답(깨진 한글 등)으로 유효 ID가 아니면 비우기 위한 집합 */
export const VALID_STADIUM_IDS = new Set(
  ADMIN_STADIUM_OPTIONS.map((o) => o.value),
);

/** 팀 전체명(API 응답 등) → 영문 team_id (수정 폼 로드 시 사용) */
export const TEAM_NAME_TO_ID: Record<string, string> = {
  "LG 트윈스": "LG",
  "KT 위즈": "KT",
  "SSG 랜더스": "SSG",
  "NC 다이노스": "NC",
  "두산 베어스": "DOOSAN",
  "KIA 타이거즈": "KIA",
  "롯데 자이언츠": "LOTTE",
  "삼성 라이온즈": "SAMSUNG",
  "한화 이글스": "HANWHA",
  "키움 히어로즈": "KIWOOM",
};

/** 관리자 팀 선택 옵션: value=영문 team_id(DB와 동일), label=한글 표시명 */
export const ADMIN_TEAM_OPTIONS = [
  { value: "LG", label: "LG 트윈스" },
  { value: "KT", label: "KT 위즈" },
  { value: "SSG", label: "SSG 랜더스" },
  { value: "NC", label: "NC 다이노스" },
  { value: "DOOSAN", label: "두산 베어스" },
  { value: "KIA", label: "KIA 타이거즈" },
  { value: "LOTTE", label: "롯데 자이언츠" },
  { value: "SAMSUNG", label: "삼성 라이온즈" },
  { value: "HANWHA", label: "한화 이글스" },
  { value: "KIWOOM", label: "키움 히어로즈" },
];

/**
 * 구장 입력 문자열을 백엔드 stadiumId로 변환.
 * - "잠실" → JAMSIL
 * - "JAMSIL" → JAMSIL
 * - "JAMSIL(잠실)" 또는 "잠실(JAMSIL)" → JAMSIL
 */
export function resolveStadiumId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const matchParen = s.match(/^([^(]+)\(([^)]+)\)$/);
  if (matchParen) {
    const [, a, b] = matchParen;
    const part1 = a.trim();
    const part2 = b.trim();
    if (STADIUM_NAME_TO_ID[part2]) return STADIUM_NAME_TO_ID[part2];
    if (STADIUM_NAME_TO_ID[part1]) return STADIUM_NAME_TO_ID[part1];
    if (/^[A-Z0-9]+$/i.test(part1) && part1.length <= 10)
      return part1.toUpperCase();
    if (/^[A-Z0-9]+$/i.test(part2) && part2.length <= 10)
      return part2.toUpperCase();
  }
  if (STADIUM_NAME_TO_ID[s]) return STADIUM_NAME_TO_ID[s];
  if (/^[A-Z0-9]+$/i.test(s) && s.length <= 10) return s.toUpperCase();
  return null;
}

export type AdminGameRequest = {
  stadiumId: string;
  homeTeamId: string;
  awayTeamId: string;
  gameStartAt: string; // "yyyy-MM-dd HH:mm"
  ticketOpenAt: string; // "yyyy-MM-dd HH:mm"
  maxSeats: number;
};

/**
 * 경기 생성. 백엔드가 "123: 경기 생성 완료" 같은 문자열을 줄 수 있어
 * Content-Type이 application/json이면 기본 transformResponse가 JSON.parse에서 터지므로,
 * 이 요청만 raw ArrayBuffer로 받아서 문자열로 파싱한다.
 */
export async function createGame(body: AdminGameRequest): Promise<number> {
  const res = await http.request<ArrayBuffer>({
    method: "POST",
    url: "/admin",
    data: body,
    responseType: "arraybuffer",
    transformResponse: [(d: unknown) => d],
  });
  const raw = res.data;
  if (raw instanceof ArrayBuffer && raw.byteLength > 0) {
    const text = new TextDecoder("utf-8").decode(raw);
    const match = String(text).match(/^(\d+):/);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

/**
 * 관리자 전용 경기 목록 (GET /api/admin/games).
 * ticketOpenAt, gameStatus 포함, 10개씩 페이지네이션.
 */
export async function getAdminGamesPage(params: {
  page?: number;
  size?: number;
  sort?: string;
}): Promise<PageAdminGames> {
  const { page = 0, size = 10, sort = "gameStartAt,desc" } = params;
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("size", String(size));
  searchParams.set("sort", sort);
  const { data } = await http.get<PageAdminGames>(
    `/admin/games?${searchParams.toString()}`,
  );
  return data;
}

/**
 * 경기 수정. 백엔드가 "123: 경기 수정 완료" 같은 문자열을 주면
 * JSON 파싱 에러가 나지 않도록 이 요청만 raw로 받는다.
 */
export async function updateGame(
  gameId: number,
  body: AdminGameRequest,
): Promise<void> {
  await http.request({
    method: "PUT",
    url: `/admin/${gameId}`,
    data: body,
    responseType: "arraybuffer",
    transformResponse: [(d: unknown) => d],
  });
}

/**
 * 경기 삭제. 백엔드가 문자열 본문을 주면 JSON 파싱으로 에러 나는 걸 피하기 위해
 * 이 요청만 raw로 받는다.
 */
export async function deleteGame(gameId: number): Promise<void> {
  await http.request({
    method: "DELETE",
    url: `/admin/${gameId}`,
    responseType: "arraybuffer",
    transformResponse: [(d: unknown) => d],
  });
}

/**
 * 관리자 발송 이력 (OUTBOX). 페이지/개수/정렬.
 * 전송 성공·실패 필터는 백엔드 미지원 시 현재 페이지 데이터만 클라이언트에서 필터링.
 */
export async function getOutboxHistory(params: {
  page?: number;
  size?: number;
  sort?: "sentAt,asc" | "sentAt,desc";
}): Promise<PageOutboxHistory> {
  const { page = 0, size = 20, sort = "sentAt,desc" } = params;
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("size", String(size));
  searchParams.set("sort", sort);
  const { data } = await http.get<PageOutboxHistory>(
    `/admin/history/outbox?${searchParams.toString()}`,
  );
  return data;
}
