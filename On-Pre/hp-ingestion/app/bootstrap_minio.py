import json
from minio import Minio
from .config import (
    MINIO_ENDPOINT,
    MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY,
    MINIO_BUCKET,
    MINIO_USE_SSL,
)


def bootstrap():
    """
    MinIO 버킷 초기 설정을 담당한다.

    수행하는 작업:
    1. 버킷이 없으면 만든다
    2. 버킷을 공개 읽기로 설정한다

    공개 읽기 설정 이유:
        썸네일 이미지를 외부(앱, 웹)에서 URL로 직접 접근할 수 있어야 한다.
        쓰기는 액세스 키가 있어야 하므로 무단 업로드는 불가능하다.

    멱등성:
        이미 버킷이 있으면 만들지 않으므로 여러 번 실행해도 안전하다.
    """
    client = Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_USE_SSL,
    )

    if not client.bucket_exists(MINIO_BUCKET):
        client.make_bucket(MINIO_BUCKET)
        print(f"[bootstrap_minio] 버킷 생성: {MINIO_BUCKET}")
    else:
        print(f"[bootstrap_minio] 버킷 이미 존재: {MINIO_BUCKET}")

    # S3 호환 버킷 정책 (JSON 형식)
    # Version: AWS IAM 정책 버전 (2012-10-17 고정값)
    # Effect Allow: 허용
    # Principal *: 모든 사용자
    # Action s3:GetObject: 객체 읽기(다운로드)만 허용
    # Resource: 이 버킷의 모든 객체에 적용
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"AWS": ["*"]},
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{MINIO_BUCKET}/*"],
            }
        ],
    }
    client.set_bucket_policy(MINIO_BUCKET, json.dumps(policy))
    print("[bootstrap_minio] 공개 읽기 정책 설정 완료")
    print(
        f"[bootstrap_minio] 이미지 접근 URL 예시: "
        f"http://{MINIO_ENDPOINT}/{MINIO_BUCKET}/naver_news/abc123.jpg"
    )


if __name__ == "__main__":
    bootstrap()
