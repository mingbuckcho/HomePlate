from unittest.mock import MagicMock, patch
from bson import ObjectId


class TestKboGamesCrawler:
    def _make_crawler(self, policy=None):
        db = MagicMock()
        job = {
            "_id": ObjectId(),
            "type": "CRAWL_KBO_GAMES",
            "payload": {
                "url": "https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList",
                "seasonId": 2026,
            },
        }
        db.crawl_sources.find_one.return_value = {
            "type": "KBO_GAMES",
            "enabled": True,
            "policy": policy
            or {
                "months": ["03"],
                "teamId": "",
                "minDelaySec": 0.0,
                "maxDelaySec": 0.0,
                "httpTimeoutSec": 20,
                "maxRetries": 1,
            },
        }
        return db, job

    @patch("app.sources.kbo_games.crawler.polite_sleep")
    @patch("app.sources.kbo_games.crawler.fetch_schedule_json")
    @patch("app.sources.kbo_games.crawler.build_session")
    def test_경기_일정_수집(self, mock_session, mock_fetch, mock_sleep):
        from app.sources.kbo_games.crawler import KboGamesCrawler

        db, job = self._make_crawler()
        mock_fetch.return_value = {
            "rows": [
                {
                    "row": [
                        {"Text": "03.12(목)", "Class": "day"},
                        {"Text": "<b>13:00</b>", "Class": "time"},
                        {
                            "Text": "<span>LG</span><em><span>vs</span></em><span>NC</span>",
                            "Class": "play",
                        },
                        {"Text": "마산", "Class": None},
                    ]
                }
            ]
        }

        crawler = KboGamesCrawler(db, job)
        result = crawler.run()

        assert result == 1
        assert db.games_items_stg.update_one.call_count == 1
        mock_sleep.assert_not_called()

        payload = db.games_items_stg.update_one.call_args[0][1]["$set"]
        assert payload["ticketOpenAt"] == "2026-03-05"

    @patch("app.sources.kbo_games.crawler.fetch_schedule_json")
    @patch("app.sources.kbo_games.crawler.build_session")
    def test_요청_실패시_에러_이벤트_기록(self, mock_session, mock_fetch):
        from app.sources.kbo_games.crawler import KboGamesCrawler

        db, job = self._make_crawler()
        mock_fetch.side_effect = RuntimeError("network down")

        crawler = KboGamesCrawler(db, job)
        try:
            crawler.run()
            assert False, "예외가 발생해야 한다"
        except RuntimeError:
            pass

        db.events.insert_one.assert_called_once()
        event_arg = db.events.insert_one.call_args[0][0]
        assert event_arg["level"] == "ERROR"
        assert event_arg["sourceType"] == "KBO_GAMES"
