const S3_THUMBNAILS_BASE =
  "https://hp-thumbnails.s3.ap-northeast-2.amazonaws.com";

/**
 * 썸네일 이미지 URL 변환 (뉴스 등 공용).
 * - kbomarket.com, imgnews.pstatic.net → 그대로 반환
 * - localhost 등에서 hp-thumbnails 경로 → S3 URL로 변환
 * - 상대 경로(naver_news/... 등) → S3 URL로 변환 (뉴스 썸네일용)
 * (굿즈는 toGoodsThumbnailUrl 사용)
 */
export function toPublicImageUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;

  if (url.startsWith("http")) {
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname === "kbomarket.com" ||
        parsed.hostname === "imgnews.pstatic.net"
      ) {
        return url;
      }
      const pathname = parsed.pathname.replace(/^\/hp-thumbnails\/?/, "");
      if (pathname) {
        return `${S3_THUMBNAILS_BASE}/${pathname.replace(/^\//, "")}`;
      }
      return url;
    } catch {
      return url;
    }
  }

  return `${S3_THUMBNAILS_BASE}/${url.replace(/^\//, "")}`;
}

/**
 * 굿즈 전용: 썸네일 URL 변환.
 * - https://kbomarket.com/... → 그대로 사용
 * - kbomarket_goods/... 상대경로 → S3 URL로 변환 (https://hp-thumbnails.s3.../kbomarket_goods/xxx.jpeg)
 * - 그 외 → null (이미지 없음)
 */
export function toGoodsThumbnailUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  if (url.startsWith("http")) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === "kbomarket.com") return url;
      return null;
    } catch {
      return null;
    }
  }
  const path = url.replace(/^\//, "");
  if (path.startsWith("kbomarket_goods/")) {
    return `${S3_THUMBNAILS_BASE}/${path}`;
  }
  return null;
}
