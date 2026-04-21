from .mongo_client import get_db, utc_now


def reap() -> int:
    """
    lockExpiresAt이 현재 시각보다 이전인 RUNNING 잡을 PENDING으로 복구한다.

    스탈 잡(Stale Job)이란:
        워커가 잡을 가져간 후 다음 상황에서 RUNNING 상태로 굳어버린다:
        - 워커 서버가 갑자기 다운됨
        - OOM(메모리 부족)으로 프로세스가 강제 종료됨
        - k8s가 파드를 강제로 종료함 (eviction)

        이런 잡은 영원히 RUNNING 상태로 남아서 처리되지 않는다.
        Reaper가 주기적으로 이런 잡을 찾아서 PENDING으로 돌려준다.

    왜 삭제하지 않고 PENDING으로 복구하는가:
        잡을 삭제하면 수집되지 않은 카테고리가 생긴다.
        PENDING으로 복구하면 다음 워커가 다시 처리한다.

    k8s CronJob 주기: 10분마다 실행
    잡 락 만료 시간: LOCK_EXPIRE_MINUTES (기본 30분)
    즉, 워커가 죽은 후 최대 40분 이내에 잡이 복구된다.
    """
    db = get_db()
    now = utc_now()

    result = db.crawl_jobs.update_many(
        {
            "status": "RUNNING",
            # lockExpiresAt이 현재 시각보다 이전인 잡이 스탈 잡이다
            "lockExpiresAt": {"$lt": now},
        },
        {
            "$set": {
                "status": "PENDING",  # 다시 대기 상태로 복구
                "nextRunAt": now,  # 즉시 재시도
                "updatedAt": now,
                # 왜 스탈 잡이 됐는지 기록한다
                "lastError": "[reaper] lock expired, worker probably crashed",
            },
            "$unset": {
                # 잠금 관련 필드를 모두 제거한다
                "lockedAt": "",
                "lockExpiresAt": "",
                "lockedBy": "",
            },
            # 실패 횟수를 1 증가시킨다
            # 이렇게 하면 자주 스탈이 되는 잡을 추적할 수 있고
            # BACKOFF_MINUTES에 따라 점점 늦게 재시도한다
            "$inc": {"attempts": 1},
        },
    )

    count = result.modified_count
    if count > 0:
        print(f"[reaper] 스탈 잡 {count}개 복구 완료")
    else:
        print("[reaper] 복구할 스탈 잡 없음")

    return count


if __name__ == "__main__":
    reap()
