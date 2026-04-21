from datetime import timedelta
from pymongo import ReturnDocument
from .mongo_client import get_db, utc_now
from .config import LOCK_EXPIRE_MINUTES

# 실패 횟수별 재시도 대기 시간 (분)
# 지수 백오프(Exponential Backoff) 패턴:
#   실패할수록 더 오래 기다렸다가 재시도한다
#   이렇게 하면 일시적인 장애가 발생했을 때
#   계속 같은 주기로 재시도하는 것보다 서버 부하를 줄일 수 있다
#
# attempts  1 → 1분 후
# attempts  2 → 5분 후
# attempts  3 → 15분 후
# attempts  4 → 60분 후
# attempts 5+ → 180분(3시간) 후
BACKOFF_MINUTES = [1, 5, 15, 60, 180]


def acquire_job(worker_id: str) -> dict | None:
    """
    대기 중인 잡을 하나 원자적으로 가져와서 RUNNING으로 바꾼다.

    원자적(Atomic)이란:
        find_one_and_update는 조건 검색과 상태 변경이 동시에 일어난다.
        두 워커가 동시에 같은 잡을 찾더라도
        MongoDB가 하나의 워커에만 성공을 반환하고
        나머지는 다른 잡을 찾거나 None을 반환한다.
        이것이 가능한 이유는 MongoDB의 문서 레벨 잠금 덕분이다.

    잡 선택 우선순위:
        1. priority 높은 잡 먼저 (숫자가 클수록 우선)
        2. priority가 같으면 nextRunAt이 오래된 잡 먼저 (FIFO)

    Returns:
        가져온 잡 문서 (dict), 또는 대기 중인 잡이 없으면 None
    """
    db = get_db()
    now = utc_now()
    lock_expires_at = now + timedelta(minutes=LOCK_EXPIRE_MINUTES)

    return db.crawl_jobs.find_one_and_update(
        # 조건: PENDING 상태이고 실행 예정 시각이 현재 이전인 잡
        {"status": "PENDING", "nextRunAt": {"$lte": now}},
        {
            "$set": {
                "status": "RUNNING",  # PENDING → RUNNING
                "lockedAt": now,  # 잡을 가져간 시각
                "lockExpiresAt": lock_expires_at,  # 이 시각까지 완료 안 되면 Reaper가 복구
                "lockedBy": worker_id,  # 어떤 워커가 가져갔는지 기록
                "updatedAt": now,
            }
        },
        # 잡 선택 우선순위: priority 높은 것 → nextRunAt 오래된 것
        sort=[("priority", -1), ("nextRunAt", 1)],
        # ReturnDocument.AFTER: 업데이트 후의 문서를 반환한다
        # BEFORE로 하면 업데이트 전 문서가 반환되어 status가 아직 PENDING이다
        return_document=ReturnDocument.AFTER,
    )


def complete_job(job_id) -> None:
    """
    잡이 성공적으로 완료됐을 때 호출한다.

    상태를 SUCCESS로 바꾸고 잠금 관련 필드를 모두 제거한다.
    다음 실행은 k8s CronJob(hp-naver-news, hp-kbomarket-goods-discover)이
    주기적으로 잡을 새로 등록해서 담당한다.

    왜 SUCCESS 상태로 끝내는가:
        이전 설계에서는 complete_job이 다시 PENDING으로 돌렸다.
        하지만 그러면 코드가 "언제 다시 실행할지"를 알게 된다.
        실무에서는 스케줄 관리를 코드가 아닌 인프라(k8s CronJob)가 담당한다.
        이렇게 하면 코드는 "지금 할 일"만 알고
        "언제 다시 할지"는 인프라가 결정한다.
    """
    db = get_db()
    now = utc_now()

    db.crawl_jobs.update_one(
        {"_id": job_id},
        {
            "$set": {
                "status": "SUCCESS",
                "updatedAt": now,
            },
            # $unset: 필드를 완전히 제거한다
            # 값을 null로 만드는 게 아니라 필드 자체를 없앤다
            # 이렇게 해야 문서가 불필요하게 커지지 않는다
            "$unset": {
                "lockedAt": "",
                "lockExpiresAt": "",
                "lockedBy": "",
                "lastError": "",
            },
        },
    )


def fail_job(job_id, err_msg: str) -> None:
    """
    잡이 실패했을 때 호출한다.

    실패 횟수(attempts)에 따라 점점 더 오래 기다렸다가 재시도한다.
    이를 지수 백오프(Exponential Backoff)라고 한다.

    Args:
        job_id:  실패한 잡의 MongoDB _id
        err_msg: 에러 메시지 (traceback 포함)
                 2000자로 잘라서 저장한다 (스택 트레이스가 길 수 있다)
    """
    db = get_db()
    now = utc_now()
    job = db.crawl_jobs.find_one({"_id": job_id})
    # 현재 attempts에서 1을 더한다
    attempts = int(job.get("attempts", 0)) + 1 if job else 1

    # attempts가 BACKOFF_MINUTES 범위를 벗어나면 마지막 값(180분)을 사용한다
    delay_min = BACKOFF_MINUTES[min(attempts - 1, len(BACKOFF_MINUTES) - 1)]

    db.crawl_jobs.update_one(
        {"_id": job_id},
        {
            "$set": {
                "status": "PENDING",  # 다시 대기 상태로
                "attempts": attempts,  # 실패 횟수 누적
                "lastError": (err_msg or "")[:2000],  # 마지막 에러 저장
                "nextRunAt": now + timedelta(minutes=delay_min),  # 백오프 후 재시도
                "updatedAt": now,
            },
            "$unset": {
                "lockedAt": "",
                "lockExpiresAt": "",
                "lockedBy": "",
            },
        },
    )
