import boto3
from botocore.exceptions import ClientError
from .config import AWS_REGION, S3_BUCKET


def bootstrap():
    """
    S3 버킷 접근 가능 여부를 확인한다.

    AWS S3 버킷은 Terraform/CDK 등 인프라 코드로 미리 생성한다.
    이 스크립트는 버킷이 존재하고 접근 가능한지만 검증한다.
    자격증명은 IRSA(운영) 또는 ~/.aws/credentials(로컬)에서 자동으로 가져온다.

    멱등성:
        여러 번 실행해도 안전하다.
    """
    client = boto3.client("s3", region_name=AWS_REGION)

    try:
        client.head_bucket(Bucket=S3_BUCKET)
        print(f"[bootstrap_s3] 버킷 접근 확인: {S3_BUCKET} (region={AWS_REGION})")
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "404":
            raise RuntimeError(
                f"[bootstrap_s3] 버킷이 존재하지 않습니다: {S3_BUCKET}\n"
                "AWS 콘솔 또는 Terraform으로 버킷을 먼저 생성하세요."
            )
        raise RuntimeError(f"[bootstrap_s3] 버킷 접근 실패: {e}")


if __name__ == "__main__":
    bootstrap()
