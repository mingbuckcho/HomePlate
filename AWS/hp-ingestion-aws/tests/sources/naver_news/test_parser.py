from app.sources.naver_news.parser import parse_news_page, build_news_url


class TestBuildNewsUrl:
    def test_oid_aid로_url_생성(self):
        url = build_news_url("109", "0005480274")
        assert url == "https://n.news.naver.com/mnews/article/109/0005480274"


class TestParseNewsPage:
    def _make_data(self, news_list, total, page=1):
        """테스트용 API 응답 데이터를 만드는 헬퍼"""
        return {
            "result": {
                "newsList": news_list,
                "totalCount": total,
                "page": page,
            }
        }

    def _make_news(
        self,
        oid="109",
        aid="001",
        title="제목",
        thumbnail="http://img.jpg",
        image="",
        source="OSEN",
    ):
        """테스트용 뉴스 아이템을 만드는 헬퍼"""
        return {
            "oid": oid,
            "aid": aid,
            "title": title,
            "thumbnail": thumbnail,
            "image": image,
            "dateTime": "2026-02-19T20:15:07",
            "sourceName": source,
        }

    def test_정상_파싱(self):
        data = self._make_data([self._make_news()], total=1)
        items, has_next = parse_news_page(data)

        assert len(items) == 1
        assert items[0]["title"] == "제목"
        assert items[0]["source"] == "NAVER_KBO"
        assert items[0]["sourceName"] == "OSEN"
        assert has_next is False

    def test_oid_없으면_건너뜀(self):
        news_list = [
            self._make_news(oid="", aid="001", title="oid없음"),
            self._make_news(oid="109", aid="002", title="정상"),
        ]
        data = self._make_data(news_list, total=2)
        items, _ = parse_news_page(data)

        assert len(items) == 1
        assert items[0]["title"] == "정상"

    def test_aid_없으면_건너뜀(self):
        news_list = [
            self._make_news(oid="109", aid="", title="aid없음"),
            self._make_news(oid="109", aid="002", title="정상"),
        ]
        items, _ = parse_news_page(self._make_data(news_list, total=2))
        assert len(items) == 1

    def test_thumbnail_없으면_image_사용(self):
        news = self._make_news(thumbnail="", image="http://img2.jpg")
        items, _ = parse_news_page(self._make_data([news], total=1))
        assert items[0]["thumbnailUrl"] == "http://img2.jpg"

    def test_thumbnail_image_모두_없으면_None(self):
        news = self._make_news(thumbnail="", image="")
        items, _ = parse_news_page(self._make_data([news], total=1))
        assert items[0]["thumbnailUrl"] is None

    def test_다음페이지_있음(self):
        # 40개 아이템, 총 258개 → 다음 페이지 있음
        news_list = [self._make_news(aid=str(i)) for i in range(40)]
        data = self._make_data(news_list, total=258, page=1)
        _, has_next = parse_news_page(data)
        assert has_next is True

    def test_마지막_페이지(self):
        # 18개 아이템, 총 18개 → 다음 페이지 없음
        news_list = [self._make_news(aid=str(i)) for i in range(18)]
        data = self._make_data(news_list, total=18, page=1)
        _, has_next = parse_news_page(data)
        assert has_next is False

    def test_빈_목록(self):
        data = self._make_data([], total=0)
        items, has_next = parse_news_page(data)
        assert items == []
        assert has_next is False
