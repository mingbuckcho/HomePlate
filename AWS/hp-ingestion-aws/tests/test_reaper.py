from unittest.mock import MagicMock, patch
from datetime import datetime, timezone


class TestReap:
    """
    reaper.py의 reap() 함수 단위 테스트.

    테스트 전략:
        MongoDB update_many를 Mock으로 대체한다.
        실제 DB 없이 Reaper 로직만 검증한다.

    검증 포인트:
        1. 스탈 잡을 PENDING으로 복구하는지
        2. 잠금 필드(lockedAt, lockedBy, lockExpiresAt)를 제거하는지
        3. attempts를 1 증가시키는지
        4. 복구할 잡이 없으면 0을 반환하는지
        5. update_many의 조건(status=RUNNING, lockExpiresAt<now)이 올바른지
    """

    @patch("app.reaper.get_db")
    @patch("app.reaper.utc_now")
    def test_스탈_잡_복구(self, mock_now, mock_get_db):
        """
        lockExpiresAt이 현재 시각보다 이전인 RUNNING 잡을
        PENDING으로 복구한다.
        """
        from app.reaper import reap

        fixed_now = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_now.return_value = fixed_now

        mock_db = MagicMock()
        # update_many가 3개를 수정했다고 응답한다
        mock_db.crawl_jobs.update_many.return_value = MagicMock(modified_count=3)
        mock_get_db.return_value = mock_db

        count = reap()

        assert count == 3

    @patch("app.reaper.get_db")
    @patch("app.reaper.utc_now")
    def test_복구_조건_status_running_and_lock_expired(self, mock_now, mock_get_db):
        """
        update_many의 필터 조건이 올바른지 확인한다.
        status=RUNNING 이고 lockExpiresAt < now 인 잡만 복구해야 한다.
        """
        from app.reaper import reap

        fixed_now = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_now.return_value = fixed_now

        mock_db = MagicMock()
        mock_db.crawl_jobs.update_many.return_value = MagicMock(modified_count=0)
        mock_get_db.return_value = mock_db

        reap()

        # update_many의 첫 번째 인자(필터)를 확인한다
        filter_arg = mock_db.crawl_jobs.update_many.call_args[0][0]

        assert filter_arg["status"] == "RUNNING"
        assert filter_arg["lockExpiresAt"]["$lt"] == fixed_now

    @patch("app.reaper.get_db")
    @patch("app.reaper.utc_now")
    def test_복구_후_status_pending(self, mock_now, mock_get_db):
        """복구된 잡의 status가 PENDING으로 바뀌어야 한다."""
        from app.reaper import reap

        mock_now.return_value = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_db = MagicMock()
        mock_db.crawl_jobs.update_many.return_value = MagicMock(modified_count=1)
        mock_get_db.return_value = mock_db

        reap()

        update_arg = mock_db.crawl_jobs.update_many.call_args[0][1]
        assert update_arg["$set"]["status"] == "PENDING"

    @patch("app.reaper.get_db")
    @patch("app.reaper.utc_now")
    def test_복구_후_잠금_필드_제거(self, mock_now, mock_get_db):
        """
        복구 시 잠금 관련 필드를 모두 제거해야 한다.
        제거하지 않으면 다음 워커가 이 잡을 가져갈 수 없다.
        """
        from app.reaper import reap

        mock_now.return_value = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_db = MagicMock()
        mock_db.crawl_jobs.update_many.return_value = MagicMock(modified_count=1)
        mock_get_db.return_value = mock_db

        reap()

        update_arg = mock_db.crawl_jobs.update_many.call_args[0][1]
        unset_fields = update_arg["$unset"]

        assert "lockedAt" in unset_fields
        assert "lockedBy" in unset_fields
        assert "lockExpiresAt" in unset_fields

    @patch("app.reaper.get_db")
    @patch("app.reaper.utc_now")
    def test_복구_후_attempts_증가(self, mock_now, mock_get_db):
        """
        복구된 잡의 attempts를 1 증가시킨다.
        이렇게 해야 자주 스탈이 되는 잡이 점점 늦게 재시도된다.
        (fail_job의 BACKOFF_MINUTES와 연동)
        """
        from app.reaper import reap

        mock_now.return_value = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_db = MagicMock()
        mock_db.crawl_jobs.update_many.return_value = MagicMock(modified_count=1)
        mock_get_db.return_value = mock_db

        reap()

        update_arg = mock_db.crawl_jobs.update_many.call_args[0][1]
        assert update_arg["$inc"]["attempts"] == 1

    @patch("app.reaper.get_db")
    @patch("app.reaper.utc_now")
    def test_복구_후_nextRunAt_즉시_실행(self, mock_now, mock_get_db):
        """
        복구된 잡의 nextRunAt을 현재 시각으로 설정해서 즉시 재시도한다.
        """
        from app.reaper import reap

        fixed_now = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_now.return_value = fixed_now
        mock_db = MagicMock()
        mock_db.crawl_jobs.update_many.return_value = MagicMock(modified_count=1)
        mock_get_db.return_value = mock_db

        reap()

        update_arg = mock_db.crawl_jobs.update_many.call_args[0][1]
        assert update_arg["$set"]["nextRunAt"] == fixed_now

    @patch("app.reaper.get_db")
    @patch("app.reaper.utc_now")
    def test_복구_후_lastError_기록(self, mock_now, mock_get_db):
        """
        왜 스탈 잡이 됐는지 lastError에 기록한다.
        운영에서 원인 파악에 도움이 된다.
        """
        from app.reaper import reap

        mock_now.return_value = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_db = MagicMock()
        mock_db.crawl_jobs.update_many.return_value = MagicMock(modified_count=1)
        mock_get_db.return_value = mock_db

        reap()

        update_arg = mock_db.crawl_jobs.update_many.call_args[0][1]
        last_error = update_arg["$set"]["lastError"]

        # reaper가 복구했다는 사실이 메시지에 포함돼야 한다
        assert "reaper" in last_error.lower()

    @patch("app.reaper.get_db")
    @patch("app.reaper.utc_now")
    def test_복구할_잡_없으면_0_반환(self, mock_now, mock_get_db):
        """
        스탈 잡이 없으면 0을 반환한다.
        정상 운영 중에는 이 케이스가 대부분이다.
        """
        from app.reaper import reap

        mock_now.return_value = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_db = MagicMock()
        mock_db.crawl_jobs.update_many.return_value = MagicMock(modified_count=0)
        mock_get_db.return_value = mock_db

        assert reap() == 0

    @patch("app.reaper.get_db")
    @patch("app.reaper.utc_now")
    def test_update_many_한번만_호출(self, mock_now, mock_get_db):
        """
        reap()은 단 하나의 update_many로 모든 스탈 잡을 한 번에 복구한다.
        루프를 돌면서 하나씩 복구하는 방식이 아니다.
        """
        from app.reaper import reap

        mock_now.return_value = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_db = MagicMock()
        mock_db.crawl_jobs.update_many.return_value = MagicMock(modified_count=10)
        mock_get_db.return_value = mock_db

        reap()

        # 10개의 스탈 잡을 복구했지만 update_many는 1번만 호출됐어야 한다
        assert mock_db.crawl_jobs.update_many.call_count == 1
