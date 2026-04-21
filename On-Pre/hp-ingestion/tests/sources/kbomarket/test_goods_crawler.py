from unittest.mock import MagicMock, patch
from bson import ObjectId


class TestKbomarketGoodsCrawler:
    """
    KbomarketGoodsCrawler 단위 테스트.

    핵심 테스트 케이스:
        1. 단일 페이지 수집
        2. 다중 페이지 수집 (페이지네이션)
        3. maxPagesPerRun 도달 시 중단점 저장
        4. maxItemsPerRun 도달 시 중단점 저장
        5. lastPageUrl이 있으면 해당 페이지부터 재개
        6. 모든 페이지 완료 시 lastPageUrl 제거
        7. HTTP 실패 시 ERROR 이벤트 기록
    """

    def _make_crawler(self, policy=None, last_page_url=None):
        """테스트용 크롤러 인스턴스를 만드는 헬퍼."""
        db = MagicMock()
        payload = {"url": "https://kbomarket.com/category/kia/160/"}
        if last_page_url:
            payload["lastPageUrl"] = last_page_url

        job = {
            "_id": ObjectId(),
            "type": "CRAWL_KBOMARKET_GOODS",
            "payload": payload,
        }
        db.crawl_sources.find_one.return_value = {
            "type": "KBOMARKET_GOODS",
            "enabled": True,
            "policy": policy
            or {
                "minDelaySec": 0.0,
                "maxDelaySec": 0.0,
                "httpTimeoutSec": 20,
                "maxPagesPerRun": 50,
                "maxItemsPerRun": 500,
            },
        }
        return db, job

    def _make_goods(self, count, base_url="https://kbomarket.com"):
        """테스트용 굿즈 목록을 만드는 헬퍼."""
        return [
            {
                "productUrl": f"{base_url}/product/item/{i}",
                "title": f"굿즈 {i}",
                "priceWon": 10000 + i * 1000,
                "thumbnailUrl": f"{base_url}/img/{i}.jpg",
                "sourceCategoryUrl": f"{base_url}/category/kia/160/",
            }
            for i in range(count)
        ]

    @patch("app.sources.kbomarket.goods_crawler.polite_sleep")
    @patch("app.sources.kbomarket.goods_crawler.parse_goods_page")
    @patch("app.sources.kbomarket.goods_crawler.fetch_html")
    @patch("app.sources.kbomarket.goods_crawler.build_session")
    def test_단일_페이지_수집(self, mock_session, mock_fetch, mock_parse, mock_sleep):
        """단일 페이지에서 굿즈를 정상적으로 수집한다."""
        from app.sources.kbomarket.goods_crawler import KbomarketGoodsCrawler

        db, job = self._make_crawler()
        mock_fetch.return_value = "<html>...</html>"
        # (굿즈 목록, 다음 페이지 URL=None) 반환
        mock_parse.return_value = (self._make_goods(5), None)

        crawler = KbomarketGoodsCrawler(db, job)
        result = crawler.run()

        assert result == 5
        assert db.goods_items_stg.update_one.call_count == 5
        # 단일 페이지이므로 polite_sleep 호출 없음
        mock_sleep.assert_not_called()

    @patch("app.sources.kbomarket.goods_crawler.polite_sleep")
    @patch("app.sources.kbomarket.goods_crawler.parse_goods_page")
    @patch("app.sources.kbomarket.goods_crawler.fetch_html")
    @patch("app.sources.kbomarket.goods_crawler.build_session")
    def test_다중_페이지_수집(self, mock_session, mock_fetch, mock_parse, mock_sleep):
        """여러 페이지에 걸친 굿즈를 모두 수집한다."""
        from app.sources.kbomarket.goods_crawler import KbomarketGoodsCrawler

        db, job = self._make_crawler()
        mock_fetch.return_value = "<html>...</html>"
        # 1페이지: 3개, 다음 페이지 있음 / 2페이지: 2개, 마지막 페이지
        mock_parse.side_effect = [
            (self._make_goods(3), "https://kbomarket.com/category/kia/160/?page=2"),
            (self._make_goods(2), None),
        ]

        crawler = KbomarketGoodsCrawler(db, job)
        result = crawler.run()

        assert result == 5
        # 페이지 간 딜레이 1번
        assert mock_sleep.call_count == 1

    @patch("app.sources.kbomarket.goods_crawler.polite_sleep")
    @patch("app.sources.kbomarket.goods_crawler.parse_goods_page")
    @patch("app.sources.kbomarket.goods_crawler.fetch_html")
    @patch("app.sources.kbomarket.goods_crawler.build_session")
    def test_max_pages_도달시_중단점_저장(
        self, mock_session, mock_fetch, mock_parse, mock_sleep
    ):
        """
        maxPagesPerRun에 도달하면 중단점을 저장하고 PENDING으로 돌린다.
        attempts가 증가하면 안 된다 (실패가 아니라 나눠서 처리 중이므로).
        """
        from app.sources.kbomarket.goods_crawler import KbomarketGoodsCrawler

        # maxPagesPerRun=2로 설정한다
        db, job = self._make_crawler(
            policy={
                "minDelaySec": 0.0,
                "maxDelaySec": 0.0,
                "httpTimeoutSec": 20,
                "maxPagesPerRun": 2,  # 2페이지까지만 처리
                "maxItemsPerRun": 500,
            }
        )
        mock_fetch.return_value = "<html>...</html>"

        next_url = "https://kbomarket.com/category/kia/160/?page=3"
        # 1페이지, 2페이지는 정상 처리
        # 3페이지 요청 직전에 제한 도달 → 중단점 저장
        mock_parse.side_effect = [
            (self._make_goods(3), "https://kbomarket.com/category/kia/160/?page=2"),
            (self._make_goods(3), next_url),
            # 3페이지는 요청되지 않아야 한다
        ]

        crawler = KbomarketGoodsCrawler(db, job)
        crawler.run()

        # update_one 호출 중 lastPageUrl 저장 + PENDING으로 바꾸는 호출이 있어야 한다
        checkpoint_calls = [
            c
            for c in db.crawl_jobs.update_one.call_args_list
            if "payload.lastPageUrl" in c[0][1].get("$set", {})
        ]
        assert len(checkpoint_calls) == 1
        saved_url = checkpoint_calls[0][0][1]["$set"]["payload.lastPageUrl"]
        assert saved_url == next_url

        # status가 PENDING으로 바뀌어야 한다
        pending_status = checkpoint_calls[0][0][1]["$set"]["status"]
        assert pending_status == "PENDING"

    @patch("app.sources.kbomarket.goods_crawler.polite_sleep")
    @patch("app.sources.kbomarket.goods_crawler.parse_goods_page")
    @patch("app.sources.kbomarket.goods_crawler.fetch_html")
    @patch("app.sources.kbomarket.goods_crawler.build_session")
    def test_max_items_도달시_중단점_저장(
        self, mock_session, mock_fetch, mock_parse, mock_sleep
    ):
        """
        maxItemsPerRun에 도달하면 중단점을 저장한다.
        """
        from app.sources.kbomarket.goods_crawler import KbomarketGoodsCrawler

        db, job = self._make_crawler(
            policy={
                "minDelaySec": 0.0,
                "maxDelaySec": 0.0,
                "httpTimeoutSec": 20,
                "maxPagesPerRun": 50,
                "maxItemsPerRun": 3,  # 3건까지만 처리
            }
        )
        mock_fetch.return_value = "<html>...</html>"
        next_url = "https://kbomarket.com/category/kia/160/?page=2"
        mock_parse.return_value = (self._make_goods(3), next_url)

        crawler = KbomarketGoodsCrawler(db, job)
        result = crawler.run()

        # 3건 처리 후 중단
        assert result == 3
        checkpoint_calls = [
            c
            for c in db.crawl_jobs.update_one.call_args_list
            if "payload.lastPageUrl" in c[0][1].get("$set", {})
        ]
        assert len(checkpoint_calls) == 1

    @patch("app.sources.kbomarket.goods_crawler.polite_sleep")
    @patch("app.sources.kbomarket.goods_crawler.parse_goods_page")
    @patch("app.sources.kbomarket.goods_crawler.fetch_html")
    @patch("app.sources.kbomarket.goods_crawler.build_session")
    def test_lastPageUrl_있으면_해당_페이지부터_재개(
        self, mock_session, mock_fetch, mock_parse, mock_sleep
    ):
        """
        payload.lastPageUrl이 있으면 첫 페이지가 아닌 해당 URL부터 시작한다.
        """
        from app.sources.kbomarket.goods_crawler import KbomarketGoodsCrawler

        resume_url = "https://kbomarket.com/category/kia/160/?page=3"
        db, job = self._make_crawler(last_page_url=resume_url)
        mock_parse.return_value = (self._make_goods(2), None)

        crawler = KbomarketGoodsCrawler(db, job)
        crawler.run()

        # fetch_html이 resume_url로 호출돼야 한다
        mock_fetch.assert_called_once_with(
            mock_session.return_value,
            resume_url,
            timeout=20,
        )

    @patch("app.sources.kbomarket.goods_crawler.polite_sleep")
    @patch("app.sources.kbomarket.goods_crawler.parse_goods_page")
    @patch("app.sources.kbomarket.goods_crawler.fetch_html")
    @patch("app.sources.kbomarket.goods_crawler.build_session")
    def test_완료시_lastPageUrl_제거(
        self, mock_session, mock_fetch, mock_parse, mock_sleep
    ):
        """
        모든 페이지 수집이 완료되면 lastPageUrl을 제거한다.
        """
        from app.sources.kbomarket.goods_crawler import KbomarketGoodsCrawler

        db, job = self._make_crawler()
        mock_parse.return_value = (self._make_goods(2), None)

        crawler = KbomarketGoodsCrawler(db, job)
        crawler.run()

        # $unset으로 lastPageUrl을 제거하는 호출이 있어야 한다
        unset_calls = [
            c
            for c in db.crawl_jobs.update_one.call_args_list
            if "payload.lastPageUrl" in c[0][1].get("$unset", {})
        ]
        assert len(unset_calls) == 1

    @patch("app.sources.kbomarket.goods_crawler.fetch_html")
    @patch("app.sources.kbomarket.goods_crawler.build_session")
    def test_fetch_실패시_에러_이벤트_기록(self, mock_session, mock_fetch):
        """HTTP 요청이 실패하면 ERROR 이벤트를 기록하고 예외를 재발생시킨다."""
        from app.sources.kbomarket.goods_crawler import KbomarketGoodsCrawler

        db, job = self._make_crawler()
        mock_fetch.side_effect = RuntimeError("타임아웃")

        crawler = KbomarketGoodsCrawler(db, job)

        try:
            crawler.run()
            assert False, "예외가 발생해야 한다"
        except RuntimeError:
            pass

        db.events.insert_one.assert_called()
        event_arg = db.events.insert_one.call_args[0][0]
        assert event_arg["level"] == "ERROR"

    @patch("app.sources.kbomarket.goods_crawler.polite_sleep")
    @patch("app.sources.kbomarket.goods_crawler.parse_goods_page")
    @patch("app.sources.kbomarket.goods_crawler.fetch_html")
    @patch("app.sources.kbomarket.goods_crawler.build_session")
    def test_upsert_productUrl_기준(
        self, mock_session, mock_fetch, mock_parse, mock_sleep
    ):
        """
        upsert가 productUrl을 기준으로 호출되는지 확인한다.
        같은 상품이 다시 수집되면 UPDATE가 일어나야 한다.
        """
        from app.sources.kbomarket.goods_crawler import KbomarketGoodsCrawler

        db, job = self._make_crawler()
        mock_parse.return_value = (self._make_goods(1), None)

        crawler = KbomarketGoodsCrawler(db, job)
        crawler.run()

        # goods_items_stg.update_one의 필터가 productUrl 기준인지 확인한다
        call_args = db.goods_items_stg.update_one.call_args
        filter_arg = call_args[0][0]
        assert "productUrl" in filter_arg
