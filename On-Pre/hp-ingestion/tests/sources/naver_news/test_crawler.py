from unittest.mock import MagicMock, patch, call
from datetime import datetime, timezone
from bson import ObjectId


class TestNaverNewsCrawler:
    """
    NaverNewsCrawler 단위 테스트.

    테스트 전략:
        외부 의존성(HTTP 요청, MongoDB)을 Mock으로 대체한다.
        크롤러 내부 로직(파싱 결과 처리, upsert 호출, 반복 조건)만 테스트한다.
        실제 네이버 API를 호출하지 않으므로 인터넷 없이도 실행된다.
    """

    def _make_crawler(self, policy=None):
        """테스트용 크롤러 인스턴스를 만드는 헬퍼."""
        db = MagicMock()
        job = {
            "_id": ObjectId(),
            "type": "CRAWL_NAVER_NEWS",
            "payload": {"url": "https://api-gw.sports.naver.com/..."},
        }
        # crawl_sources에서 정책을 읽어오는 부분을 Mock으로 대체한다
        db.crawl_sources.find_one.return_value = {
            "type": "NAVER_KBO_NEWS",
            "enabled": True,
            "policy": policy
            or {
                "minDelaySec": 0.0,  # 테스트에서는 딜레이를 0으로 설정한다
                "maxDelaySec": 0.0,
                "httpTimeoutSec": 25,
                "maxPagesPerRun": 200,
            },
        }
        return db, job

    def _make_api_response(self, count, total, page=1):
        """테스트용 네이버 뉴스 API 응답을 만드는 헬퍼."""
        return {
            "result": {
                "newsList": [
                    {
                        "oid": "109",
                        "aid": f"{i:010d}",
                        "title": f"뉴스 {i}",
                        "thumbnail": f"https://img.example.com/{i}.jpg",
                        "image": "",
                        "dateTime": "2026-02-19T12:00:00",
                        "sourceName": "OSEN",
                    }
                    for i in range(count)
                ],
                "totalCount": total,
                "page": page,
            }
        }

    @patch("app.sources.naver_news.crawler.polite_sleep")
    @patch("app.sources.naver_news.crawler.fetch_json")
    @patch("app.sources.naver_news.crawler.build_session")
    def test_단일_페이지_수집(self, mock_session, mock_fetch, mock_sleep):
        """
        뉴스가 한 페이지만 있을 때 정상적으로 수집되는지 확인한다.
        """
        from app.sources.naver_news.crawler import NaverNewsCrawler

        db, job = self._make_crawler()
        # fetch_json이 5개 뉴스, 총 5개(다음 페이지 없음)를 반환한다
        mock_fetch.return_value = self._make_api_response(count=5, total=5)

        crawler = NaverNewsCrawler(db, job)
        result = crawler.run()

        # 5건이 수집돼야 한다
        assert result == 5
        # news_items_stg.update_one이 5번 호출돼야 한다
        assert db.news_items_stg.update_one.call_count == 5
        # 다음 페이지가 없으므로 polite_sleep을 호출하지 않는다
        mock_sleep.assert_not_called()

    @patch("app.sources.naver_news.crawler.polite_sleep")
    @patch("app.sources.naver_news.crawler.fetch_json")
    @patch("app.sources.naver_news.crawler.build_session")
    def test_다중_페이지_수집(self, mock_session, mock_fetch, mock_sleep):
        """
        뉴스가 여러 페이지에 걸쳐있을 때 모든 페이지를 수집하는지 확인한다.
        """
        from app.sources.naver_news.crawler import NaverNewsCrawler

        db, job = self._make_crawler()
        # 1페이지: 40개, 총 45개 → 다음 페이지 있음
        # 2페이지: 5개, 총 45개 → 다음 페이지 없음
        mock_fetch.side_effect = [
            self._make_api_response(count=40, total=45, page=1),
            self._make_api_response(count=5, total=45, page=2),
        ]

        crawler = NaverNewsCrawler(db, job)
        result = crawler.run()

        assert result == 45
        # 페이지 사이에 polite_sleep이 1번 호출돼야 한다
        assert mock_sleep.call_count == 1

    @patch("app.sources.naver_news.crawler.polite_sleep")
    @patch("app.sources.naver_news.crawler.fetch_json")
    @patch("app.sources.naver_news.crawler.build_session")
    def test_upsert_url_기준으로_호출(self, mock_session, mock_fetch, mock_sleep):
        """
        upsert가 URL을 기준으로 호출되는지 확인한다.
        같은 URL이 다시 수집되면 UPDATE(덮어쓰기)가 일어나야 한다.
        """
        from app.sources.naver_news.crawler import NaverNewsCrawler

        db, job = self._make_crawler()
        mock_fetch.return_value = self._make_api_response(count=1, total=1)

        crawler = NaverNewsCrawler(db, job)
        crawler.run()

        # update_one의 첫 번째 인자(필터)가 url 기준인지 확인한다
        call_args = db.news_items_stg.update_one.call_args
        filter_arg = call_args[0][0]
        assert "url" in filter_arg

    @patch("app.sources.naver_news.crawler.fetch_json")
    @patch("app.sources.naver_news.crawler.build_session")
    def test_fetch_실패시_에러_이벤트_기록(self, mock_session, mock_fetch):
        """
        HTTP 요청이 실패하면 ERROR 이벤트가 기록되고 예외가 다시 발생하는지 확인한다.
        """
        from app.sources.naver_news.crawler import NaverNewsCrawler

        db, job = self._make_crawler()
        # fetch_json이 예외를 발생시킨다
        mock_fetch.side_effect = RuntimeError("네트워크 오류")

        crawler = NaverNewsCrawler(db, job)

        # 예외가 다시 발생해야 한다 (worker.py의 fail_job이 처리)
        try:
            crawler.run()
            assert False, "예외가 발생해야 한다"
        except RuntimeError:
            pass

        # ERROR 이벤트가 기록돼야 한다
        db.events.insert_one.assert_called_once()
        event_arg = db.events.insert_one.call_args[0][0]
        assert event_arg["level"] == "ERROR"
        assert event_arg["sourceType"] == "NAVER_KBO_NEWS"

    @patch("app.sources.naver_news.crawler.polite_sleep")
    @patch("app.sources.naver_news.crawler.fetch_json")
    @patch("app.sources.naver_news.crawler.build_session")
    def test_성공시_info_이벤트_기록(self, mock_session, mock_fetch, mock_sleep):
        """
        수집이 성공하면 INFO 이벤트가 기록되는지 확인한다.
        """
        from app.sources.naver_news.crawler import NaverNewsCrawler

        db, job = self._make_crawler()
        mock_fetch.return_value = self._make_api_response(count=3, total=3)

        crawler = NaverNewsCrawler(db, job)
        crawler.run()

        db.events.insert_one.assert_called_once()
        event_arg = db.events.insert_one.call_args[0][0]
        assert event_arg["level"] == "INFO"
        assert event_arg["itemCount"] == 3
