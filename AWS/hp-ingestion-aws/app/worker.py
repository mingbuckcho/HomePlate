import signal
import time
import uuid
import traceback

from .mongo_client import get_db, utc_now
from .jobs import acquire_job, complete_job, fail_job
from .sources.naver_news.crawler import NaverNewsCrawler
from .sources.kbomarket.goods_discover_crawler import KbomarketGoodsDiscoverCrawler
from .sources.kbomarket.goods_crawler import KbomarketGoodsCrawler
from .sources.kbo_games.crawler import KboGamesCrawler
from .sources.kbo_team_rank.crawler import KboTeamRankCrawler
from . import logger

# 이 워커 인스턴스의 고유 ID
# k8s에서 replicas=2로 실행하면 worker-abc123, worker-def456 처럼
# 서로 다른 ID를 가진 워커가 2개 실행된다
# crawl_jobs의 lockedBy 필드에 저장되어 어떤 워커가 처리 중인지 알 수 있다
WORKER_ID = f"worker-{uuid.uuid4().hex[:8]}"

# 처리할 잡이 없을 때 대기 시간 (초)
# 너무 짧으면 MongoDB에 폴링 부하가 생긴다
# 너무 길면 새 잡이 등록됐을 때 반응이 늦어진다
# 5초는 실무에서 많이 사용하는 적당한 값이다
IDLE_SLEEP_SEC = 5

# ────────────────────────────────────────────────────────────────────
# 잡 타입 → 크롤러 클래스 매핑
#
# OCP(개방-폐쇄 원칙) 적용:
#   새 소스/사이트를 추가할 때:
#     1. sources/{도메인}/ 디렉토리에 크롤러 파일 추가
#     2. 여기 CRAWLER_MAP에 한 줄 추가
#     3. worker.py 나머지 코드는 수정하지 않는다
#
# 잡 타입 네이밍 규칙:
#   CRAWL_{도메인}_{대상}    - 실제 데이터를 수집하는 크롤러
#   DISCOVER_{도메인}_{대상} - 잡을 탐색해서 등록하는 크롤러
# ────────────────────────────────────────────────────────────────────
CRAWLER_MAP = {
    "CRAWL_NAVER_NEWS": NaverNewsCrawler,
    "DISCOVER_KBOMARKET_GOODS": KbomarketGoodsDiscoverCrawler,
    "CRAWL_KBOMARKET_GOODS": KbomarketGoodsCrawler,
    "CRAWL_KBO_GAMES": KboGamesCrawler,
    "CRAWL_KBO_TEAM_RANK": KboTeamRankCrawler,
    # 새로운 소스 추가 예시:
    # "DISCOVER_LOTTE_GOODS":  LotteGoodsDiscoverCrawler,
    # "CRAWL_LOTTE_GOODS":     LotteGoodsCrawler,
}

# 종료 요청이 들어왔는지 추적하는 플래그
# handle_signal에서 True로 바꾸면 run()의 while 루프가 종료된다
shutdown_flag = False


def handle_signal(signum, frame):
    """
    SIGINT(Ctrl+C) 또는 SIGTERM(k8s 파드 종료)을 처리한다.

    즉시 종료하지 않는 이유:
        워커가 잡을 처리하는 도중에 강제 종료되면
        잡이 RUNNING 상태로 굳어버린다 (스탈 잡).
        Reaper가 복구할 때까지 최대 30분 이상 처리되지 않는다.

    graceful shutdown:
        shutdown_flag를 True로 바꾸면
        현재 처리 중인 잡이 완료된 후 루프가 종료된다.

    k8s terminationGracePeriodSeconds=60:
        SIGTERM 후 60초 이내에 종료해야 한다.
        60초가 넘으면 SIGKILL로 강제 종료된다.
    """
    global shutdown_flag
    logger.info("worker_signal_received", signal=signum)
    shutdown_flag = True


# 종료 시그널 핸들러 등록
signal.signal(signal.SIGINT, handle_signal)  # Ctrl+C
signal.signal(signal.SIGTERM, handle_signal)  # k8s 파드 종료


def run():
    """
    메인 워커 루프.

    동작:
        1. crawl_jobs에서 PENDING 잡을 하나 가져온다 (acquire_job)
        2. 잡에 맞는 크롤러를 CRAWLER_MAP에서 찾는다
        3. 크롤러를 실행한다 (crawler.run())
        4. 성공이면 complete_job, 실패이면 fail_job을 호출한다
        5. 잡이 없으면 5초 기다렸다가 다시 확인한다
        6. shutdown_flag가 True이면 루프를 종료한다
    """
    db = get_db()
    logger.info("worker_start", worker_id=WORKER_ID)

    while not shutdown_flag:
        job = acquire_job(WORKER_ID)

        if job is None:
            time.sleep(IDLE_SLEEP_SEC)
            continue

        if shutdown_flag:
            logger.info("worker_shutdown_pending_return", job_type=job["type"])
            db.crawl_jobs.update_one(
                {"_id": job["_id"]},
                {
                    "$set": {
                        "status": "PENDING",
                        "updatedAt": utc_now(),
                    },
                    "$unset": {
                        "lockedAt": "",
                        "lockExpiresAt": "",
                        "lockedBy": "",
                    },
                },
            )
            break

        job_id = job["_id"]
        jtype = job["type"]
        logger.info("job_start", job_type=jtype, job_id=str(job_id), worker_id=WORKER_ID)

        try:
            crawler_class = CRAWLER_MAP.get(jtype)
            if not crawler_class:
                raise ValueError(
                    f"알 수 없는 잡 종류: {jtype}. "
                    f"CRAWLER_MAP에 등록된 타입: {list(CRAWLER_MAP.keys())}"
                )

            crawler = crawler_class(db, job)
            n = crawler.run()

            complete_job(job_id)
            logger.info("job_complete", job_type=jtype, job_id=str(job_id), item_count=n)

        except Exception as e:
            err = traceback.format_exc()
            logger.error(
                "job_failed",
                job_type=jtype,
                job_id=str(job_id),
                http_status=getattr(e, "status_code", None),
                error=str(e),
            )
            fail_job(job_id, err)

    logger.info("worker_shutdown", worker_id=WORKER_ID)


if __name__ == "__main__":
    run()
