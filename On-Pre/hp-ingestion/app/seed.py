from datetime import timedelta
from .mongo_client import get_db, utc_now
from .config import (
    NAVER_NEWS_API_URL,
    KBOMARKET_ROOT_URL,
    KBO_SCHEDULE_API_URL,
    KBO_SCHEDULE_SEASON,
)

# KBO마켓 딜레이 정책 (MongoDB crawl_sources의 source of truth)
# 변경 시 seed를 재실행하면 MongoDB에 반영된다
# dev: 빠른 테스트를 위해 짧게
# prod: 서버 부하를 줄이기 위해 길게 (seed.py 직접 수정 또는 mongosh로 업데이트)
_KBOMARKET_MIN_DELAY = 1.5
_KBOMARKET_MAX_DELAY = 3.0


def seed():
    """
    crawl_sources 정책과 루트 잡을 등록한다.

    언제 실행하는가:
        로컬: hp-bootstrap 서비스가 자동 실행
        운영(K8s): ArgoCD PreSync Hook Job이 자동 실행

    운영에서 주기적인 잡 등록은 누가 담당하는가:
        k8s CronJob이 담당한다.
        hp-naver-news-cronjob:             1시간마다 CRAWL_NAVER_NEWS 잡 등록
        hp-kbomarket-goods-discover-cronjob: 하루 1번 DISCOVER_KBOMARKET_GOODS 잡 등록
        hp-kbo-games-cronjob:              하루 1번 CRAWL_KBO_GAMES 잡 등록

    crawl_sources에 저장하는 정책:
        실제 크롤러 코드에서 읽어서 사용하는 값만 정의한다.
        사용하는 값: policy (delay, timeout, maxPages, maxItems, maxRetries)
        사용하는 값: alert (consecutiveFailThreshold)
        저장하지 않는 값:
            stats → events 컬렉션에서 집계 쿼리로 대체
            rateLimit → 코드에서 구현하지 않음
            schedule → k8s CronJob이 담당
            headers → 크롤러 코드에 하드코딩 (소스별로 다름)
            robotsTxt → 파서에서 직접 필터링
    """
    db = get_db()
    now = utc_now()

    # ── 네이버 뉴스 수집 정책 ─────────────────────────────────────────
    db.crawl_sources.update_one(
        {"type": "NAVER_KBO_NEWS"},
        {
            "$set": {
                "type": "NAVER_KBO_NEWS",
                "url": NAVER_NEWS_API_URL,
                "enabled": True,
                # naver_news/crawler.py의 policy.get()으로 읽어서 사용한다
                "policy": {
                    # 요청 간 대기 시간 (랜덤)
                    "minDelaySec": 1.5,
                    "maxDelaySec": 3.0,
                    # HTTP 요청 제한 시간
                    "httpTimeoutSec": 25,
                    # http_fetch.py의 fetch_json retries 파라미터
                    "maxRetries": 3,
                    # 무한 루프 방지용 안전장치 (뉴스는 오늘 날짜 기준이라 많지 않음)
                    "maxPagesPerRun": 200,
                    "maxItemsPerRun": 5000,
                },
                # base.py의 _check_and_alert()가 사용한다
                # 연속 N회 실패 시 ALERT 이벤트를 기록한다
                "alert": {
                    "consecutiveFailThreshold": 5,
                },
                "updatedAt": now,
            }
        },
        upsert=True,
    )
    print("[seed] NAVER_KBO_NEWS 정책 등록 완료")

    # ── KBO마켓 굿즈 수집 정책 ───────────────────────────────────────
    # Discover와 Goods 크롤러가 같은 소스 정책을 공유한다
    # 같은 사이트(kbomarket.com)에서 수집하므로 딜레이 정책이 동일하다
    db.crawl_sources.update_one(
        {"type": "KBOMARKET_GOODS"},
        {
            "$set": {
                "type": "KBOMARKET_GOODS",
                "url": KBOMARKET_ROOT_URL,
                "enabled": True,
                "policy": {
                    "minDelaySec": _KBOMARKET_MIN_DELAY,
                    "maxDelaySec": _KBOMARKET_MAX_DELAY,
                    "httpTimeoutSec": 20,
                    "maxRetries": 3,
                    # goods_crawler.py: 50페이지 초과 시 중단점 저장 후 재시도
                    "maxPagesPerRun": 50,
                    "maxItemsPerRun": 500,
                },
                "alert": {
                    "consecutiveFailThreshold": 5,
                },
                "updatedAt": now,
            }
        },
        upsert=True,
    )
    print("[seed] KBOMARKET_GOODS 정책 등록 완료")

    # ── KBO 경기 일정 수집 정책 ─────────────────────────────────────
    db.crawl_sources.update_one(
        {"type": "KBO_GAMES"},
        {
            "$set": {
                "type": "KBO_GAMES",
                "url": KBO_SCHEDULE_API_URL,
                "enabled": True,
                "policy": {
                    "seasonId": KBO_SCHEDULE_SEASON,
                    "months": [f"{m:02d}" for m in range(3, 11)],
                    "teamId": "",
                    "minDelaySec": 2.5,
                    "maxDelaySec": 7.5,
                    "httpTimeoutSec": 20,
                    "maxRetries": 2,
                },
                "alert": {
                    "consecutiveFailThreshold": 5,
                },
                "updatedAt": now,
            }
        },
        upsert=True,
    )
    print("[seed] KBO_GAMES 정책 등록 완료")

    # ── 루트 잡 등록 ────────────────────────────────────────────────
    # PENDING이나 RUNNING 상태의 같은 잡이 있으면 새로 등록하지 않는다
    # 이미 처리 중인 잡을 중복 등록하지 않기 위해서다
    # SUCCESS 상태의 잡은 조건에 해당하지 않으므로 새로 등록된다
    db.crawl_jobs.update_one(
        {
            "type": "CRAWL_NAVER_NEWS",
            "status": {"$in": ["PENDING", "RUNNING"]},
        },
        {
            "$setOnInsert": {
                "type": "CRAWL_NAVER_NEWS",
                "status": "PENDING",
                "priority": 90,  # DISCOVER(100)보다 낮음
                "payload": {"url": NAVER_NEWS_API_URL},
                "attempts": 0,
                "nextRunAt": now + timedelta(seconds=1),  # 즉시 실행
                "createdAt": now,
                "updatedAt": now,
            }
        },
        upsert=True,
    )
    print("[seed] CRAWL_NAVER_NEWS 잡 등록 완료")

    db.crawl_jobs.update_one(
        {
            "type": "DISCOVER_KBOMARKET_GOODS",
            "status": {"$in": ["PENDING", "RUNNING"]},
        },
        {
            "$setOnInsert": {
                "type": "DISCOVER_KBOMARKET_GOODS",
                "status": "PENDING",
                "priority": 100,  # 가장 높은 우선순위
                "payload": {"url": KBOMARKET_ROOT_URL},
                "attempts": 0,
                "nextRunAt": now + timedelta(seconds=1),
                "createdAt": now,
                "updatedAt": now,
            }
        },
        upsert=True,
    )
    print("[seed] DISCOVER_KBOMARKET_GOODS 잡 등록 완료")

    db.crawl_jobs.update_one(
        {
            "type": "CRAWL_KBO_GAMES",
            "status": {"$in": ["PENDING", "RUNNING"]},
        },
        {
            "$setOnInsert": {
                "type": "CRAWL_KBO_GAMES",
                "status": "PENDING",
                "priority": 85,
                "payload": {
                    "url": KBO_SCHEDULE_API_URL,
                    "seasonId": KBO_SCHEDULE_SEASON,
                },
                "attempts": 0,
                "nextRunAt": now + timedelta(seconds=1),
                "createdAt": now,
                "updatedAt": now,
            }
        },
        upsert=True,
    )
    print("[seed] CRAWL_KBO_GAMES 잡 등록 완료")


if __name__ == "__main__":
    seed()
