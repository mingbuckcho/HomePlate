from pymongo import MongoClient
from pymongo.errors import OperationFailure
from .config import MONGO_URI, MONGO_DB, MONGO_ROOT_URI, MONGO_EXPORTER_PASSWORD, MONGO_ROOT_PASSWORD, MONGO_PASSWORD


def _ensure_users():
    """
    root 계정으로 앱 계정을 생성한다.

    - 이미 존재하는 유저는 건너뛴다 (멱등성).
    - MONGO_ROOT_URI가 없으면 이 단계를 건너뛴다.

    생성하는 계정:
      svc-crawler   : worker, seed, bootstrap 전용 (readWrite)
      svc-exporter  : exporter 전용 (readWrite)
    """
    if not MONGO_ROOT_URI:
        print("[bootstrap_mongo] MONGO_ROOT_URI 없음 → 유저 생성 건너뜀")
        return
    if not MONGO_EXPORTER_PASSWORD:
        raise RuntimeError(
            "MONGO_ROOT_URI가 설정됐지만 MONGO_EXPORTER_PASSWORD가 없습니다.\n"
            "K8s Secret 또는 .env에 MONGO_EXPORTER_PASSWORD를 추가하세요."
        )

    client = MongoClient(MONGO_ROOT_URI)
    ops_db = client[MONGO_DB]

    users = [
        {
            "name": "svc-crawler",
            "pwd": MONGO_PASSWORD,
            "roles": [{"role": "readWrite", "db": MONGO_DB}],
        },
        {
            "name": "svc-exporter",
            "pwd": MONGO_EXPORTER_PASSWORD,
            "roles": [{"role": "readWrite", "db": MONGO_DB}],
        },
    ]

    for u in users:
        try:
            ops_db.command("createUser", u["name"], pwd=u["pwd"], roles=u["roles"])
            print(f"[bootstrap_mongo] 유저 생성: {u['name']}")
        except OperationFailure as e:
            if e.code == 51003:  # UserAlreadyExists
                print(f"[bootstrap_mongo] 유저 이미 존재, 건너뜀: {u['name']}")
            else:
                raise

    client.close()


def bootstrap():
    """
    MongoDB 유저와 인덱스를 초기 설정한다.

    멱등성: 이미 존재하는 유저/인덱스는 건너뛰므로 여러 번 실행해도 안전하다.

    언제 실행하는가:
    - 로컬: 최초 1회 (python -m app.bootstrap_mongo)
    - 운영(K8s): ArgoCD PreSync Hook Job으로 배포 시 자동 실행
    """
    _ensure_users()
    db = MongoClient(MONGO_URI)[MONGO_DB]

    # ── crawl_sources ────────────────────────────────────────────────
    # type과 url 조합이 같은 소스가 중복 등록되지 않도록 막는다
    # 예: ("NAVER_KBO_NEWS", "https://...") 조합이 유니크해야 한다
    db.crawl_sources.create_index(
        [("type", 1), ("url", 1)], unique=True, name="idx_source_type_url"
    )

    # ── crawl_jobs ───────────────────────────────────────────────────
    # 워커가 대기 중인 잡을 빠르게 찾기 위한 핵심 인덱스
    # acquire_job() 쿼리: status=PENDING AND nextRunAt<=now
    # 정렬: priority 높은 것 먼저, 같으면 nextRunAt 오래된 것 먼저
    # 이 인덱스가 없으면 전체 컬렉션을 스캔해야 하므로 성능이 크게 떨어진다
    db.crawl_jobs.create_index(
        [("status", 1), ("nextRunAt", 1), ("priority", -1)], name="idx_job_pickup"
    )

    # Reaper가 만료된 RUNNING 잡을 빠르게 찾기 위한 인덱스
    # reap() 쿼리: status=RUNNING AND lockExpiresAt<now
    # sparse=True: lockExpiresAt 필드가 없는 문서(PENDING, SUCCESS 등)는
    #              인덱스에 포함하지 않는다 → 인덱스 크기 절약
    db.crawl_jobs.create_index(
        [("status", 1), ("lockExpiresAt", 1)], sparse=True, name="idx_job_lock_expires"
    )

    # ── news_items_stg ───────────────────────────────────────────────
    # stg = staging (임시 저장소)
    # Exporter가 MariaDB로 옮기기 전까지 수집 데이터를 여기에 저장한다

    # URL이 같은 뉴스가 중복 저장되지 않도록 막는다
    # worker의 upsert가 이 인덱스를 사용한다
    db.news_items_stg.create_index([("url", 1)], unique=True, name="idx_news_stg_url")

    # Exporter의 워터마크 쿼리에 사용된다
    # get_watermark() 이후의 문서를 updatedAt 순으로 가져온다
    db.news_items_stg.create_index([("updatedAt", 1)], name="idx_news_stg_updated")

    # ── goods_items_stg ──────────────────────────────────────────────
    db.goods_items_stg.create_index(
        [("productUrl", 1)], unique=True, name="idx_goods_stg_url"
    )
    db.goods_items_stg.create_index([("updatedAt", 1)], name="idx_goods_stg_updated")

    # ── games_items_stg ──────────────────────────────────────────────
    db.games_items_stg.create_index(
        [("gameId", 1)], unique=True, name="idx_games_stg_game_id"
    )
    db.games_items_stg.create_index([("updatedAt", 1)], name="idx_games_stg_updated")

    # ── events ───────────────────────────────────────────────────────
    # 수집 성공/실패/ALERT 로그를 저장한다
    # base.py의 _log_event()가 여기에 기록한다

    # TTL 인덱스: createdAt 기준으로 30일 후 자동 삭제한다
    # 로그가 무한정 쌓이지 않도록 한다
    db.events.create_index(
        [("createdAt", 1)],
        expireAfterSeconds=60 * 60 * 24 * 30,  # 30일 = 2,592,000초
        name="idx_events_ttl",
    )

    # 레벨별 최근 이벤트 조회에 사용된다
    # 예: db.events.find({"level": "ERROR"}).sort("createdAt", -1)
    db.events.create_index(
        [("level", 1), ("createdAt", -1)], name="idx_events_level_created"
    )

    # sourceType별 이벤트 조회에 사용된다
    # 예: db.events.find({"sourceType": "NAVER_KBO_NEWS"})
    db.events.create_index(
        [("sourceType", 1), ("createdAt", -1)], name="idx_events_source_created"
    )

    # ── etl_state ────────────────────────────────────────────────────
    # Exporter가 어디까지 처리했는지 기록하는 컬렉션
    # "news_exporter", "goods_exporter" 두 개의 문서가 여기에 저장된다
    # get_watermark(), set_watermark()가 이 컬렉션을 사용한다
    db.etl_state.create_index([("name", 1)], unique=True, name="idx_etl_state_name")

    print("[bootstrap_mongo] MongoDB 인덱스 설정 완료")


if __name__ == "__main__":
    bootstrap()
