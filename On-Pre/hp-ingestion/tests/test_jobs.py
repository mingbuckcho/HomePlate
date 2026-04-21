from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta
from bson import ObjectId


class TestAcquireJob:
    @patch("app.jobs.get_db")
    @patch("app.jobs.utc_now")
    def test_대기중인_잡_가져오기(self, mock_now, mock_get_db):
        from app.jobs import acquire_job

        fixed_now = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_now.return_value = fixed_now

        fake_job = {"_id": ObjectId(), "type": "CRAWL_NAVER_NEWS", "status": "RUNNING"}
        mock_db = MagicMock()
        mock_db.crawl_jobs.find_one_and_update.return_value = fake_job
        mock_get_db.return_value = mock_db

        result = acquire_job("worker-abc")
        assert result == fake_job
        # RUNNING으로 상태가 변경됐는지 확인
        call_args = mock_db.crawl_jobs.find_one_and_update.call_args
        assert call_args[0][1]["$set"]["status"] == "RUNNING"
        assert call_args[0][1]["$set"]["lockedBy"] == "worker-abc"

    @patch("app.jobs.get_db")
    @patch("app.jobs.utc_now")
    def test_대기중인_잡_없으면_None(self, mock_now, mock_get_db):
        from app.jobs import acquire_job

        mock_now.return_value = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_db = MagicMock()
        mock_db.crawl_jobs.find_one_and_update.return_value = None
        mock_get_db.return_value = mock_db

        assert acquire_job("worker-abc") is None


class TestCompleteJob:
    @patch("app.jobs.get_db")
    @patch("app.jobs.utc_now")
    def test_잡_완료_후_SUCCESS(self, mock_now, mock_get_db):
        from app.jobs import complete_job

        mock_now.return_value = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db

        complete_job(ObjectId())
        update_arg = mock_db.crawl_jobs.update_one.call_args[0][1]

        # SUCCESS 상태여야 한다
        assert update_arg["$set"]["status"] == "SUCCESS"
        # 잠금 필드가 모두 제거돼야 한다
        assert "lockedAt" in update_arg["$unset"]
        assert "lockedBy" in update_arg["$unset"]
        assert "lockExpiresAt" in update_arg["$unset"]


class TestFailJob:
    @patch("app.jobs.get_db")
    @patch("app.jobs.utc_now")
    def test_첫번째_실패_1분_후_재시도(self, mock_now, mock_get_db):
        from app.jobs import fail_job

        fixed_now = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_now.return_value = fixed_now
        mock_db = MagicMock()
        # 첫 번째 실패: attempts=0
        mock_db.crawl_jobs.find_one.return_value = {"attempts": 0}
        mock_get_db.return_value = mock_db

        fail_job(ObjectId(), "테스트 에러")
        update_arg = mock_db.crawl_jobs.update_one.call_args[0][1]

        assert update_arg["$set"]["status"] == "PENDING"
        assert update_arg["$set"]["attempts"] == 1
        # 첫 번째 실패: BACKOFF_MINUTES[0] = 1분 후
        assert update_arg["$set"]["nextRunAt"] == fixed_now + timedelta(minutes=1)
        assert "테스트 에러" in update_arg["$set"]["lastError"]

    @patch("app.jobs.get_db")
    @patch("app.jobs.utc_now")
    def test_최대_backoff_180분(self, mock_now, mock_get_db):
        from app.jobs import fail_job

        fixed_now = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_now.return_value = fixed_now
        mock_db = MagicMock()
        # 10번 실패: BACKOFF_MINUTES 범위를 넘어서 마지막 값(180분) 사용
        mock_db.crawl_jobs.find_one.return_value = {"attempts": 10}
        mock_get_db.return_value = mock_db

        fail_job(ObjectId(), "에러")
        update_arg = mock_db.crawl_jobs.update_one.call_args[0][1]
        assert update_arg["$set"]["nextRunAt"] == fixed_now + timedelta(minutes=180)

    @patch("app.jobs.get_db")
    @patch("app.jobs.utc_now")
    def test_에러메시지_2000자_자름(self, mock_now, mock_get_db):
        from app.jobs import fail_job

        mock_now.return_value = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_db = MagicMock()
        mock_db.crawl_jobs.find_one.return_value = {"attempts": 0}
        mock_get_db.return_value = mock_db

        long_error = "x" * 5000
        fail_job(ObjectId(), long_error)
        update_arg = mock_db.crawl_jobs.update_one.call_args[0][1]
        assert len(update_arg["$set"]["lastError"]) == 2000
