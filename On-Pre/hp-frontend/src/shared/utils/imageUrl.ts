/**
 * 썸네일 이미지 URL을 브라우저에서 접근 가능한 공개 URL로 변환.
 * - hp-thumbnails S3 버킷 기준 URL로 반환
 * - 완전한 URL(localhost:9000 등) → S3 버킷 URL로 치환
 * - 상대 경로만 오면 → S3 버킷 URL + 경로 반환
 */
const S3_THUMBNAILS_BASE =
  "https://hp-thumbnails.s3.ap-northeast-2.amazonaws.com";

export function toPublicImageUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;

  // Case 1: 이미 완전한 URL인 경우 (http로 시작)
  if (url.startsWith("http")) {
    try {
      const parsed = new URL(url);
      // kbomarket.com에서 오는 이미지는 S3로 변환하지 않고 그대로 사용
      if (parsed.hostname === "kbomarket.com") {
        return url;
      }
      // localhost 또는 기존 도메인에서 hp-thumbnails 경로로 온 경우 → S3 경로만 추출
      const pathname = parsed.pathname.replace(/^\/hp-thumbnails\/?/, "");
      if (pathname) {
        return `${S3_THUMBNAILS_BASE}/${pathname.replace(/^\//, "")}`;
      }
    } catch {
      // URL 파싱 실패 시 기존 URL 그대로 반환
    }
    return url;
  }

  // Case 2: DB에 상대 경로만 있는 경우 (예: naver_news/xxx.jpeg, kbomarket_goods/xxx.jpg)
  return `${S3_THUMBNAILS_BASE}/${url.replace(/^\//, "")}`;
}
