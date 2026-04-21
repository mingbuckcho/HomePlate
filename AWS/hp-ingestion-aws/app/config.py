# app/config.py
import os
from datetime import datetime
from urllib.parse import quote_plus


def _require(key: str) -> str:
    """
    필수 환경변수를 읽어온다.
    값이 없으면 즉시 에러를 발생시킨다 (Fail Fast).
    """
    val = os.getenv(key)
    if not val or not val.strip():
        raise RuntimeError(
            f"필수 환경변수가 없습니다: {key}\n"
            f"로컬: .env 파일에 {key}=값 을 추가하세요.\n"
            f"운영: k8s Secret 또는 ConfigMap에 {key}를 추가하세요."
        )
    return val


def _optional(key: str, default: str = "") -> str:
    val = os.getenv(key)
    return val if val and val.strip() else default


def _optional_int(key: str, default: int) -> int:
    val = os.getenv(key)
    if not val or not val.strip():
        return default
    try:
        return int(val)
    except ValueError:
        raise RuntimeError(f"환경변수 {key}={val!r} 을 정수로 변환할 수 없습니다.")


def _optional_float(key: str, default: float) -> float:
    val = os.getenv(key)
    if not val or not val.strip():
        return default
    try:
        return float(val)
    except ValueError:
        raise RuntimeError(f"환경변수 {key}={val!r} 을 실수로 변환할 수 없습니다.")


# ── MongoDB ───────────────────────────────────────────────────────────
# URI를 통째로 받지 않고 조각으로 받아서 여기서 조합한다
#
# Secret  → MONGO_PASSWORD, MONGO_ROOT_PASSWORD, MONGO_EXPORTER_PASSWORD (민감)
# ConfigMap → MONGO_HOST, MONGO_PORT, MONGO_USER, MONGO_DB,
#             MONGO_REPLICA_SET (민감하지 않음)
#
# 장점:
#   호스트가 바뀌면 ConfigMap만 수정하면 된다
#   Secret(민감한 파일)은 건드리지 않아도 된다
_MONGO_HOST = _require("MONGO_HOST")
_MONGO_PORT = _optional("MONGO_PORT", "27017")
_MONGO_USER = _require("MONGO_USER")
_MONGO_PASSWORD = _require("MONGO_PASSWORD")
MONGO_PASSWORD = _MONGO_PASSWORD
MONGO_DB = _optional("MONGO_DB", "hp_ops")

# bootstrap_mongo.py 전용 root 계정
# dev: docker-compose의 MONGO_INITDB_ROOT_USERNAME/PASSWORD와 동일하게 설정
# prod(K8s): secret-mongo-bootstrap에만 주입, 앱 Secret에는 포함하지 않음
MONGO_ROOT_USER = _optional("MONGO_ROOT_USER", "")
MONGO_ROOT_PASSWORD = _optional("MONGO_ROOT_PASSWORD", "")

# bootstrap_mongo.py 전용 exporter 계정 패스워드
# svc-exporter 유저를 생성할 때 사용
MONGO_EXPORTER_PASSWORD = _optional("MONGO_EXPORTER_PASSWORD", "")

# ReplicaSet 파라미터
# dev (standalone): 빈 문자열 → 파라미터 없음
# prod (replicaset): "rs0" → &replicaSet=rs0 추가
_MONGO_REPLICA_SET = _optional("MONGO_REPLICA_SET", "")

# URI 조합
_query = f"authSource={MONGO_DB}"
if _MONGO_REPLICA_SET:
    _query += f"&replicaSet={_MONGO_REPLICA_SET}"

MONGO_URI = (
    f"mongodb://{_MONGO_USER}:{quote_plus(_MONGO_PASSWORD)}"
    f"@{_MONGO_HOST}:{_MONGO_PORT}"
    f"/{MONGO_DB}?{_query}"
)

# bootstrap 전용 root URI (authSource=admin)
# MONGO_ROOT_USER/PASSWORD가 없으면 빈 문자열 → 유저 생성 단계를 건너뜀
_root_query = "authSource=admin"
if _MONGO_REPLICA_SET:
    _root_query += f"&replicaSet={_MONGO_REPLICA_SET}"
MONGO_ROOT_URI = (
    f"mongodb://{quote_plus(MONGO_ROOT_USER)}:{quote_plus(MONGO_ROOT_PASSWORD)}"
    f"@{_MONGO_HOST}:{_MONGO_PORT}/admin?{_root_query}"
    if MONGO_ROOT_USER and MONGO_ROOT_PASSWORD
    else ""
)

# ── MariaDB ───────────────────────────────────────────────────────────
MYSQL_HOST = _require("MYSQL_HOST")
MYSQL_PORT = _optional_int("MYSQL_PORT", 3306)
MYSQL_DB = _optional("MYSQL_DB", "hp_serving")
MYSQL_USER = _require("MYSQL_USER")
MYSQL_PASSWORD = _require("MYSQL_PASSWORD")

# ── AWS S3 ────────────────────────────────────────────────────────────
# 자격증명은 IRSA(EKS IAM Roles for Service Accounts)가 제공한다.
# 로컬 개발 시에는 AWS_PROFILE 또는 ~/.aws/credentials 를 사용한다.
AWS_REGION = _optional("AWS_REGION", "ap-northeast-2")
S3_BUCKET = _optional("S3_BUCKET", "hp-thumbnails")


# ── HTTP ──────────────────────────────────────────────────────────────
# 실제 브라우저처럼 보이도록 User-Agent를 설정한다
DEFAULT_UA = _optional(
    "USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36",
)
DEFAULT_MIN_DELAY = _optional_float("MIN_DELAY_SEC", 1.0)
DEFAULT_MAX_DELAY = _optional_float("MAX_DELAY_SEC", 2.0)
DEFAULT_TIMEOUT = _optional_int("HTTP_TIMEOUT_SEC", 20)

# ── 수집 대상 URL ─────────────────────────────────────────────────────
NAVER_NEWS_API_URL = _optional(
    "NAVER_NEWS_API_URL", "https://api-gw.sports.naver.com/news/articles/kbaseball"
)
KBOMARKET_ROOT_URL = _optional("KBOMARKET_ROOT_URL", "https://kbomarket.com")
KBO_SCHEDULE_API_URL = _optional(
    "KBO_SCHEDULE_API_URL",
    "https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList",
)
KBO_SCHEDULE_SEASON = _optional_int("KBO_SCHEDULE_SEASON", datetime.now().year)
KBO_TEAM_RANK_URL = _optional(
    "KBO_TEAM_RANK_URL",
    "https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx",
)

# ── 잡 락 ────────────────────────────────────────────────────────────
# 워커가 잡을 가져간 후 이 시간(분)이 지나도 완료 안 되면
# Reaper가 스탈 잡으로 간주하고 PENDING으로 복구한다
LOCK_EXPIRE_MINUTES = _optional_int("LOCK_EXPIRE_MINUTES", 30)


# ── Kafka ─────────────────────────────────────────────────────────────
# 로컬: docker-compose의 kafka 서비스 이름 (kafka:9092)
# 운영: Strimzi가 생성하는 bootstrap 서비스 주소
KAFKA_BOOTSTRAP_SERVERS = _optional("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

# Worker → Exporter 이벤트 전달 토픽
# "크롤링 완료됐으니 이제 MariaDB에 적재해" 라는 신호
KAFKA_TOPIC_CRAWL_RESULT = _optional("KAFKA_TOPIC_CRAWL_RESULT", "hp.crawl.result")

# Outbox Relay → Slack Consumer 이벤트 전달 토픽
# "가격이 변동됐으니 슬랙에 알려" 라는 신호
KAFKA_TOPIC_CRAWL_EXPORTED = _optional(
    "KAFKA_TOPIC_CRAWL_EXPORTED", "hp.crawl.exported"
)

# TLS 설정
# 로컬(docker-compose): KAFKA_SECURITY_PROTOCOL=PLAINTEXT (기본값)
# K8s(Strimzi):        KAFKA_SECURITY_PROTOCOL=SSL, 인증서 경로는 볼륨마운트 위치
KAFKA_SECURITY_PROTOCOL = _optional("KAFKA_SECURITY_PROTOCOL", "PLAINTEXT")
KAFKA_SSL_CA_LOCATION = _optional("KAFKA_SSL_CA_LOCATION", "")
KAFKA_SSL_CERT_LOCATION = _optional("KAFKA_SSL_CERT_LOCATION", "")
KAFKA_SSL_KEY_LOCATION = _optional("KAFKA_SSL_KEY_LOCATION", "")

# ── Slack ─────────────────────────────────────────────────────────────
# 비워두면 슬랙 전송 없이 로그만 출력한다
# 로컬 개발 시 슬랙 설정 없이도 동작하게 하기 위해 _optional로 처리
SLACK_WEBHOOK_URL = _optional("SLACK_WEBHOOK_URL", "")
