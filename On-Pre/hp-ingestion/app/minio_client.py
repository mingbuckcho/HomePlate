import io
import json
import hashlib
import requests as req
from minio import Minio
from .config import (
    MINIO_ENDPOINT,
    MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY,
    MINIO_BUCKET,
    MINIO_USE_SSL,
)

# ────────────────────────────────────────────────────────────────────
# 소스별 이미지 다운로드 헤더
#
# 왜 소스별로 다른 헤더를 쓰는가:
#   각 사이트마다 Hotlink Protection 정책이 다르다.
#   Hotlink Protection: 자신의 사이트가 아닌 곳에서 이미지를
#   직접 요청하면 403을 반환하는 보안 기능이다.
#   이를 우회하려면 해당 사이트에서 요청하는 것처럼
#   Referer 헤더를 맞춰줘야 한다.
#
#   예:
#     네이버 이미지 → Referer: https://news.naver.com/
#     KBO마켓 이미지 → Referer: https://kbomarket.com/
#
#   두 소스에 같은 Referer를 쓰면:
#     네이버 이미지에 kbomarket.com Referer를 보내는 것은 말이 안 된다.
#     반드시 소스별로 분리해야 한다.
# ────────────────────────────────────────────────────────────────────
_SOURCE_HEADERS: dict[str, dict[str, str]] = {
    "naver": {
        # 네이버는 news.naver.com에서 요청하는 것처럼 보여야 한다
        "Referer": "https://news.naver.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36",
    },
    "kbomarket": {
        # KBO마켓은 kbomarket.com에서 요청하는 것처럼 보여야 한다
        "Referer": "https://kbomarket.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36",
    },
    # 새로운 소스를 추가할 때 여기에 헤더를 추가한다
    # 예: "lotte_giants": {"Referer": "https://www.lgibershop.com/", ...}
    "default": {
        # Referer 없이 기본 User-Agent만 사용한다
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36",
    },
}


def get_minio() -> Minio:
    """MinIO 클라이언트 인스턴스를 생성해서 반환한다."""
    return Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        # 로컬(HTTP): False, 운영(HTTPS): True
        secure=MINIO_USE_SSL,
    )


def upload_thumbnail(
    image_url: str, prefix: str, source: str = "default"
) -> str | None:
    """
    이미지 URL에서 이미지를 다운로드해서 MinIO에 업로드한다.

    Args:
        image_url: 다운로드할 이미지의 원본 URL
        prefix:    MinIO 저장 경로 구분자 (예: "naver_news", "kbomarket_goods")
        source:    소스 키 - 헤더 선택에 사용 (예: "naver", "kbomarket")

    Returns:
        MinIO 경로 (예: "naver_news/abc123.jpg")
        Hotlink Protection으로 403 시 원본 URL 그대로 반환
        image_url이 비어있으면 None 반환
        업로드 실패 시 원본 URL 반환 (수집을 멈추지 않는다)

    설계 원칙:
        썸네일 업로드 실패는 치명적이지 않다.
        굿즈 상품 정보(이름, 가격, URL)가 더 중요하다.
        업로드 실패 시 원본 URL을 DB에 저장해서 데이터 손실을 막는다.
    """
    if not image_url:
        return None

    # 소스에 맞는 헤더를 가져온다
    # 소스가 없으면 default 헤더를 사용한다
    headers = _SOURCE_HEADERS.get(source, _SOURCE_HEADERS["default"])

    try:
        resp = req.get(image_url, timeout=10, headers=headers)

        # 403: Hotlink Protection이 강하게 걸려있어서 우회 실패
        # 원본 URL을 그대로 반환한다 (데이터 손실 방지)
        if resp.status_code == 403:
            print(
                f"[minio] Hotlink Protection 감지 "
                f"(source={source}), 원본 URL 사용: {image_url}"
            )
            return image_url

        resp.raise_for_status()
        data = resp.content

        # URL의 MD5 해시를 파일명으로 사용한다
        # 이유:
        #   1. 같은 URL → 같은 해시 → 중복 업로드 방지
        #   2. URL에 포함된 특수문자를 파일명으로 쓸 필요 없음
        #   3. 해시는 고정 길이(32자)라 파일명이 일정하다
        file_hash = hashlib.md5(image_url.encode()).hexdigest()
        content_type = resp.headers.get("Content-Type", "image/jpeg")

        # Content-Type에서 확장자를 추출한다
        # 예: "image/jpeg; charset=utf-8" → "jpeg"
        ext = content_type.split("/")[-1].split(";")[0].strip()
        # 알 수 없는 확장자는 jpg로 기본 처리한다
        ext = ext if ext in ("jpeg", "jpg", "png", "webp", "gif") else "jpg"

        # MinIO에 저장될 최종 경로
        # 예: "naver_news/a1b2c3d4e5f6...jpg"
        object_name = f"{prefix}/{file_hash}.{ext}"

        client = get_minio()
        client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=object_name,
            # bytes를 파일 스트림으로 변환한다
            # MinIO SDK는 파일 객체를 받으므로 BytesIO로 감싼다
            data=io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )

        return object_name  # DB에 저장할 MinIO 경로

    except Exception as e:
        # 업로드 실패는 수집을 멈추지 않는다
        # 원본 URL을 반환해서 데이터 손실을 막는다
        print(f"[minio] 업로드 실패, 원본 URL 사용: {image_url} / {e}")
        return image_url
