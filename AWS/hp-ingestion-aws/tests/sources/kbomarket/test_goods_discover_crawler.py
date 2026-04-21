from unittest.mock import MagicMock, patch, call
from bson import ObjectId


class TestKbomarketGoodsDiscoverCrawler:
    """
    KbomarketGoodsDiscoverCrawler 단위 테스트.

    핵심 테스트 케이스:
        1. 새 카테고리 → 잡 등록
        2. 없어진 카테고리 → DISABLED로 비활성화 (soft delete)
        3. 기존 카테고리 유지 → 잡 중복 등록 안 함
        4. HTTP 실패 → ERROR 이벤트 기록 후 예외 재발생
    """

    def _make_crawler(self):
        """테스트용 크롤러 인스턴스를 만드는 헬퍼."""
        db = MagicMock()
        job = {
            "_id": ObjectId(),
            "type": "DISCOVER_KBOMARKET_GOODS",
            "payload": {"url": "https://kbomarket.com"},
        }
        db.crawl_sources.find_one.return_value = {
            "type": "KBOMARKET_GOODS",
            "enabled": True,
            "policy": {"httpTimeoutSec": 20},
        }
        return db, job

    @patch("app.sources.kbomarket.goods_discover_crawler.parse_category_urls")
    @patch("app.sources.kbomarket.goods_discover_crawler.fetch_html")
    @patch("app.sources.kbomarket.goods_discover_crawler.build_session")
    def test_새_카테고리_잡_등록(self, mock_session, mock_fetch, mock_parse):
        """
        탐색한 카테고리에 해당하는 잡이 없으면 새로 등록한다.
        """
        from app.sources.kbomarket.goods_discover_crawler import (
            KbomarketGoodsDiscoverCrawler,
        )

        db, job = self._make_crawler()
        mock_fetch.return_value = "<html>...</html>"
        # 파서가 2개 카테고리를 반환한다
        mock_parse.return_value = [
            "https://kbomarket.com/category/kia/160/",
            "https://kbomarket.com/category/samsung/161/",
        ]

        # 기존에 등록된 잡 없음
        db.crawl_jobs.find.return_value = iter([])
        # upsert 결과: 새로 만들어졌음을 나타낸다
        mock_result = MagicMock()
        mock_result.upserted_id = ObjectId()
        db.crawl_jobs.update_one.return_value = mock_result

        crawler = KbomarketGoodsDiscoverCrawler(db, job)
        result = crawler.run()

        assert result == 2
        # update_one이 2번 호출돼야 한다 (카테고리 2개 등록)
        assert db.crawl_jobs.update_one.call_count == 2

    @patch("app.sources.kbomarket.goods_discover_crawler.parse_category_urls")
    @patch("app.sources.kbomarket.goods_discover_crawler.fetch_html")
    @patch("app.sources.kbomarket.goods_discover_crawler.build_session")
    def test_없어진_카테고리_비활성화(self, mock_session, mock_fetch, mock_parse):
        """
        이전에 등록된 카테고리가 이번 탐색에서 나타나지 않으면
        DISABLED로 변경된다 (soft delete).
        """
        from app.sources.kbomarket.goods_discover_crawler import (
            KbomarketGoodsDiscoverCrawler,
        )

        db, job = self._make_crawler()
        mock_fetch.return_value = "<html>...</html>"
        # 이번 탐색에서는 kia만 발견됐다
        mock_parse.return_value = ["https://kbomarket.com/category/kia/160/"]

        # 기존에는 kia와 lg 두 개가 등록돼 있었다
        db.crawl_jobs.find.return_value = iter(
            [
                {"payload": {"url": "https://kbomarket.com/category/kia/160/"}},
                {
                    "payload": {"url": "https://kbomarket.com/category/lg/162/"}
                },  # 없어진 카테고리
            ]
        )

        mock_result = MagicMock()
        mock_result.upserted_id = None  # 이미 있는 잡이므로 새로 만들지 않음
        db.crawl_jobs.update_one.return_value = mock_result

        crawler = KbomarketGoodsDiscoverCrawler(db, job)
        crawler.run()

        # update_one 호출 중 DISABLED로 바꾸는 호출이 있어야 한다
        disabled_calls = [
            c
            for c in db.crawl_jobs.update_one.call_args_list
            if c[0][1].get("$set", {}).get("status") == "DISABLED"
        ]
        assert len(disabled_calls) == 1
        # 없어진 lg 카테고리가 비활성화돼야 한다
        disabled_url = disabled_calls[0][0][0]["payload.url"]
        assert disabled_url == "https://kbomarket.com/category/lg/162/"

    @patch("app.sources.kbomarket.goods_discover_crawler.parse_category_urls")
    @patch("app.sources.kbomarket.goods_discover_crawler.fetch_html")
    @patch("app.sources.kbomarket.goods_discover_crawler.build_session")
    def test_기존_카테고리_중복_등록_안함(self, mock_session, mock_fetch, mock_parse):
        """
        이미 PENDING 상태인 잡이 있으면 새로 등록하지 않는다.
        """
        from app.sources.kbomarket.goods_discover_crawler import (
            KbomarketGoodsDiscoverCrawler,
        )

        db, job = self._make_crawler()
        mock_fetch.return_value = "<html>...</html>"
        mock_parse.return_value = ["https://kbomarket.com/category/kia/160/"]

        db.crawl_jobs.find.return_value = iter(
            [
                {"payload": {"url": "https://kbomarket.com/category/kia/160/"}},
            ]
        )

        # upserted_id=None: 이미 있어서 새로 만들지 않음
        mock_result = MagicMock()
        mock_result.upserted_id = None
        db.crawl_jobs.update_one.return_value = mock_result

        crawler = KbomarketGoodsDiscoverCrawler(db, job)
        crawler.run()

        # DISABLED 호출이 없어야 한다 (없어진 카테고리가 없으므로)
        disabled_calls = [
            c
            for c in db.crawl_jobs.update_one.call_args_list
            if c[0][1].get("$set", {}).get("status") == "DISABLED"
        ]
        assert len(disabled_calls) == 0

    @patch("app.sources.kbomarket.goods_discover_crawler.fetch_html")
    @patch("app.sources.kbomarket.goods_discover_crawler.build_session")
    def test_fetch_실패시_에러_이벤트_기록(self, mock_session, mock_fetch):
        """
        HTTP 요청이 실패하면 ERROR 이벤트를 기록하고 예외를 다시 발생시킨다.
        """
        from app.sources.kbomarket.goods_discover_crawler import (
            KbomarketGoodsDiscoverCrawler,
        )

        db, job = self._make_crawler()
        mock_fetch.side_effect = RuntimeError("연결 실패")

        crawler = KbomarketGoodsDiscoverCrawler(db, job)

        try:
            crawler.run()
            assert False, "예외가 발생해야 한다"
        except RuntimeError:
            pass

        db.events.insert_one.assert_called()
        event_arg = db.events.insert_one.call_args[0][0]
        assert event_arg["level"] == "ERROR"
