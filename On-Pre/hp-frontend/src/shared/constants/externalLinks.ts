/**
 * 외부 서비스 링크 (순위·기록 페이지 "상세 데이터 분석" 등)
 * - 네이버 스포츠 야구 선수 분석이 없을 수 있어 KBO 공식 기록실로 안내
 */
export const RECORD_EXTERNAL_URL =
  "https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx";

export const RECORD_EXTERNAL_LABEL = "KBO 기록실";

/** 구장명으로 네이버 지도 검색 URL (클릭 시 새 탭) */
export function getNaverMapSearchUrl(stadium: string): string {
  const query = stadium.includes("야구장") ? stadium : `${stadium} 야구장`;
  return `https://map.naver.com/v5/search/${encodeURIComponent(query)}`;
}
