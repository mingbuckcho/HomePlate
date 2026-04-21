from unittest.mock import MagicMock, patch, call
from datetime import datetime, timezone


class TestInferTeamId:
    """TEAM_KEYWORDS 기반 구단 추론 테스트."""

    def test_카테고리_url_기아_타이거즈(self):
        from app.exporter import infer_team_id

        assert (
            infer_team_id("https://kbomarket.com/category/기아타이거즈/160/", "")
            == "KIA"
        )

    def test_카테고리_url_삼성_라이온즈(self):
        from app.exporter import infer_team_id

        assert (
            infer_team_id("https://kbomarket.com/category/삼성라이온즈/161/", "")
            == "SAMSUNG"
        )

    def test_카테고리_url_lg_트윈스(self):
        from app.exporter import infer_team_id

        assert infer_team_id("https://kbomarket.com/category/lg트윈스/162/", "") == "LG"

    def test_카테고리_url_ssg_랜더스(self):
        from app.exporter import infer_team_id

        assert (
            infer_team_id("https://kbomarket.com/category/ssg랜더스/163/", "") == "SSG"
        )

    def test_상품명_기준_매핑(self):
        from app.exporter import infer_team_id

        assert infer_team_id("", "KIA 응원 티셔츠") == "KIA"
        assert infer_team_id("", "SSG랜더스 모자") == "SSG"
        assert infer_team_id("", "NC다이노스 유니폼") == "NC"

    def test_kbo_공식_매핑(self):
        from app.exporter import infer_team_id

        assert infer_team_id("", "한국시리즈 기념 굿즈") == "KBO"
        assert infer_team_id("", "KBO 공인구") == "KBO"

    def test_매핑_실패시_None(self):
        from app.exporter import infer_team_id

        assert infer_team_id("", "일반 굿즈 상품") is None
        assert infer_team_id("https://kbomarket.com/", "") is None

    def test_대소문자_구분_안함(self):
        from app.exporter import infer_team_id

        # "kbo" 소문자도 KBO로 매핑돼야 한다
        assert infer_team_id("", "kbo 공인구") == "KBO"
        # "LG" 대문자도 LG로 매핑돼야 한다
        assert infer_team_id("", "LG 응원 타월") == "LG"

    def test_긴_키워드_우선_매핑(self):
        from app.exporter import infer_team_id

        # "기아타이거즈"가 "기아"보다 먼저 검사돼야 한다
        # 순서가 바뀌면 "기아타이거즈" → "기아"로 잘못 매핑될 수 있다
        result = infer_team_id("", "기아타이거즈 유니폼")
        assert result == "KIA"


class TestGetSetWatermark:
    """워터마크 읽기/쓰기 테스트."""

    def test_워터마크_없으면_epoch_반환(self):
        from app.exporter import get_watermark

        mock_db = MagicMock()
        mock_db.etl_state.find_one.return_value = None

        wm = get_watermark(mock_db, "news_exporter")

        # 1970-01-01 UTC를 반환해야 한다
        assert wm == datetime(1970, 1, 1, tzinfo=timezone.utc)

    def test_저장된_워터마크_반환(self):
        from app.exporter import get_watermark

        saved_ts = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
        mock_db = MagicMock()
        mock_db.etl_state.find_one.return_value = {"watermark": saved_ts}

        wm = get_watermark(mock_db, "news_exporter")
        assert wm == saved_ts

    def test_워터마크_저장(self):
        from app.exporter import set_watermark

        mock_db = MagicMock()
        ts = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)

        set_watermark(mock_db, "news_exporter", ts)

        # upsert=True로 update_one이 호출돼야 한다
        call_args = mock_db.etl_state.update_one.call_args
        assert call_args[0][0] == {"name": "news_exporter"}
        assert call_args[0][1]["$set"]["watermark"] == ts
        assert call_args[1]["upsert"] is True


class TestExportNews:
    """뉴스 적재 테스트."""

    def _make_news_row(self, i):
        """테스트용 뉴스 문서를 만드는 헬퍼."""
        return {
            "_id": f"id_{i}",
            "url": f"https://news.naver.com/{i}",
            "title": f"뉴스 제목 {i}",
            "thumbnailUrl": f"https://img.example.com/{i}.jpg",
            "sourceName": "OSEN",
            "publishedAt": datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc),
            "updatedAt": datetime(2026, 2, 19, 12, 0, i, tzinfo=timezone.utc),
        }

    @patch("app.exporter.set_watermark")
    @patch("app.exporter.upload_thumbnail")
    @patch("app.exporter.get_watermark")
    def test_뉴스_정상_적재(self, mock_watermark, mock_upload, mock_set_wm):
        """뉴스 데이터가 MariaDB에 정상적으로 INSERT되는지 확인한다."""
        from app.exporter import export_news

        mock_watermark.return_value = datetime(1970, 1, 1, tzinfo=timezone.utc)
        mock_upload.return_value = "naver_news/abc123.jpg"

        mock_db = MagicMock()
        mock_rows = [self._make_news_row(i) for i in range(3)]
        # find().limit()의 체인 호출을 Mock으로 처리한다
        mock_db.news_items_stg.find.return_value.limit.return_value = mock_rows

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        result = export_news(mock_db, mock_conn)

        # 3건이 적재돼야 한다
        assert result == 3
        # execute가 3번 호출돼야 한다
        assert mock_cursor.execute.call_count == 3
        # commit이 1번 호출돼야 한다
        mock_conn.commit.assert_called_once()
        # 워터마크가 업데이트돼야 한다
        mock_set_wm.assert_called_once()

    @patch("app.exporter.get_watermark")
    def test_처리할_뉴스_없으면_0_반환(self, mock_watermark):
        """워터마크 이후 데이터가 없으면 0을 반환한다."""
        from app.exporter import export_news

        mock_watermark.return_value = datetime(2026, 2, 19, tzinfo=timezone.utc)
        mock_db = MagicMock()
        # 빈 목록 반환
        mock_db.news_items_stg.find.return_value.limit.return_value = []

        mock_conn = MagicMock()
        result = export_news(mock_db, mock_conn)

        assert result == 0
        # 처리할 게 없으면 commit이 호출되면 안 된다
        mock_conn.commit.assert_not_called()

    @patch("app.exporter.set_watermark")
    @patch("app.exporter.upload_thumbnail")
    @patch("app.exporter.get_watermark")
    def test_썸네일_없으면_빈_문자열로_업로드_시도(
        self, mock_watermark, mock_upload, mock_set_wm
    ):
        """
        thumbnailUrl이 None이면 빈 문자열로 upload_thumbnail을 호출한다.
        upload_thumbnail이 None을 처리해서 None을 반환한다.
        """
        from app.exporter import export_news

        mock_watermark.return_value = datetime(1970, 1, 1, tzinfo=timezone.utc)
        mock_upload.return_value = None  # 썸네일 없음

        row = self._make_news_row(0)
        row["thumbnailUrl"] = None  # 썸네일 없음

        mock_db = MagicMock()
        mock_db.news_items_stg.find.return_value.limit.return_value = [row]

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        export_news(mock_db, mock_conn)

        # upload_thumbnail이 빈 문자열로 호출돼야 한다
        mock_upload.assert_called_once_with("", prefix="naver_news", source="naver")


class TestExportGoods:
    """굿즈 적재 테스트."""

    def _make_goods_row(self, i, category="기아타이거즈"):
        """테스트용 굿즈 문서를 만드는 헬퍼."""
        return {
            "_id": f"id_{i}",
            "productUrl": f"https://kbomarket.com/product/{i}",
            "title": f"KIA 굿즈 {i}",
            "priceWon": 15000,
            "thumbnailUrl": f"https://kbomarket.com/img/{i}.jpg",
            "sourceCategoryUrl": f"https://kbomarket.com/category/{category}/160/",
            "updatedAt": datetime(2026, 2, 19, 12, 0, i, tzinfo=timezone.utc),
        }

    @patch("app.exporter.set_watermark")
    @patch("app.exporter.upload_thumbnail")
    @patch("app.exporter.get_watermark")
    def test_굿즈_정상_적재(self, mock_watermark, mock_upload, mock_set_wm):
        """굿즈 데이터가 MariaDB에 정상적으로 INSERT되는지 확인한다."""
        from app.exporter import export_goods

        mock_watermark.return_value = datetime(1970, 1, 1, tzinfo=timezone.utc)
        mock_upload.return_value = "kbomarket_goods/xyz789.jpg"

        mock_db = MagicMock()
        mock_rows = [self._make_goods_row(i) for i in range(2)]
        mock_db.goods_items_stg.find.return_value.limit.return_value = mock_rows

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        result = export_goods(mock_db, mock_conn)

        assert result == 2
        assert mock_cursor.execute.call_count == 2
        mock_conn.commit.assert_called_once()

    @patch("app.exporter.set_watermark")
    @patch("app.exporter.upload_thumbnail")
    @patch("app.exporter.get_watermark")
    def test_team_id_올바르게_추론(self, mock_watermark, mock_upload, mock_set_wm):
        """
        sourceCategoryUrl에서 구단을 올바르게 추론해서 INSERT한다.
        """
        from app.exporter import export_goods

        mock_watermark.return_value = datetime(1970, 1, 1, tzinfo=timezone.utc)
        mock_upload.return_value = None

        # 기아타이거즈 카테고리 굿즈
        row = self._make_goods_row(0, category="기아타이거즈")

        mock_db = MagicMock()
        mock_db.goods_items_stg.find.return_value.limit.return_value = [row]

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        export_goods(mock_db, mock_conn)

        # execute의 두 번째 인자(params)에서 team_id를 확인한다
        execute_params = mock_cursor.execute.call_args[0][1]
        team_id = execute_params[0]  # 첫 번째 파라미터가 team_id
        assert team_id == "KIA"

    @patch("app.exporter.set_watermark")
    @patch("app.exporter.upload_thumbnail")
    @patch("app.exporter.get_watermark")
    def test_kbomarket_source_헤더_사용(self, mock_watermark, mock_upload, mock_set_wm):
        """
        굿즈 썸네일 업로드 시 source="kbomarket"을 사용해야 한다.
        (네이버 Referer가 아닌 KBO마켓 Referer를 사용해야 하므로)
        """
        from app.exporter import export_goods

        mock_watermark.return_value = datetime(1970, 1, 1, tzinfo=timezone.utc)
        mock_upload.return_value = "kbomarket_goods/abc.jpg"

        mock_db = MagicMock()
        mock_db.goods_items_stg.find.return_value.limit.return_value = [
            self._make_goods_row(0)
        ]

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        export_goods(mock_db, mock_conn)

        # upload_thumbnail이 source="kbomarket"으로 호출돼야 한다
        mock_upload.assert_called_once_with(
            "https://kbomarket.com/img/0.jpg",
            prefix="kbomarket_goods",
            source="kbomarket",
        )

    @patch("app.exporter.get_watermark")
    def test_처리할_굿즈_없으면_0_반환(self, mock_watermark):
        """워터마크 이후 데이터가 없으면 0을 반환한다."""
        from app.exporter import export_goods

        mock_watermark.return_value = datetime(2026, 2, 19, tzinfo=timezone.utc)
        mock_db = MagicMock()
        mock_db.goods_items_stg.find.return_value.limit.return_value = []

        result = export_goods(mock_db, MagicMock())
        assert result == 0


class TestExportGames:
    """경기 일정 적재 테스트."""

    def _make_game_row(self, i):
        return {
            "_id": f"id_{i}",
            "gameId": 900000 + i,
            "gameStartAt": datetime(2026, 3, 12, 13, i, 0, tzinfo=timezone.utc),
            "gameStatus": "SCHEDULED",
            "maxSeats": None,
            "ticketOpenAt": "2026-03-05",
            "awayTeam": "LG",
            "homeTeam": "NC",
            "stadiumId": "MASAN",
            "updatedAt": datetime(2026, 2, 19, 12, 0, i, tzinfo=timezone.utc),
        }

    @patch("app.exporter.set_watermark")
    @patch("app.exporter.get_watermark")
    def test_경기_정상_적재(self, mock_watermark, mock_set_wm):
        from app.exporter import export_games

        mock_watermark.return_value = datetime(1970, 1, 1, tzinfo=timezone.utc)
        mock_db = MagicMock()
        mock_rows = [self._make_game_row(i) for i in range(2)]
        mock_db.games_items_stg.find.return_value.limit.return_value = mock_rows

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        result = export_games(mock_db, mock_conn)

        assert result == 2
        assert mock_cursor.execute.call_count == 2
        mock_conn.commit.assert_called_once()
        mock_set_wm.assert_called_once()

    @patch("app.exporter.get_watermark")
    def test_처리할_경기_없으면_0_반환(self, mock_watermark):
        from app.exporter import export_games

        mock_watermark.return_value = datetime(2026, 2, 19, tzinfo=timezone.utc)
        mock_db = MagicMock()
        mock_db.games_items_stg.find.return_value.limit.return_value = []

        result = export_games(mock_db, MagicMock())
        assert result == 0
