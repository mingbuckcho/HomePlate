from datetime import datetime, timezone
from urllib.parse import unquote, urlparse
from pymongo import MongoClient
from .config import MONGO_URI, MONGO_DB


def utc_now() -> datetime:
    """
    현재 시각을 UTC 기준으로 반환한다.

    timezone.utc를 붙여야 timezone-aware 객체가 된다.
    timezone-aware가 아니면 MongoDB의 날짜 비교($gt, $lt)가
    예상과 다르게 동작할 수 있다.
    """
    return datetime.now(timezone.utc)


def get_db():
    """
    MongoDB에 접속하고 데이터베이스 핸들을 반환한다.

    MongoClient는 내부적으로 커넥션 풀을 관리하므로
    호출할 때마다 새로운 TCP 연결을 맺지 않는다.
    하지만 프로덕션에서는 MongoClient를 싱글턴으로 관리하는 게 더 좋다.
    지금 규모에서는 이 방식으로도 충분하다.
    """
    return MongoClient(MONGO_URI)[MONGO_DB]


def normalize_category_name(category_url: str) -> str:
    """
    카테고리 URL에서 카테고리명을 추출한다.
    예: https://kbomarket.com/category/기아타이거즈/160/ → "기아타이거즈"

    용도:
    - 같은 카테고리를 URL이 조금 달라도 동일하게 인식할 때 사용한다
    - 현재는 디버깅/로깅 목적으로 주로 사용한다
    """
    path = urlparse(category_url).path
    # path를 '/'로 나누고 빈 문자열을 제거한다
    # 예: '/category/기아타이거즈/160/' → ['category', '기아타이거즈', '160']
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 2:
        # URL 인코딩을 디코딩한다
        # 예: '%EA%B8%B0%EC%95%84' → '기아'
        return unquote(parts[1])
    return ""
