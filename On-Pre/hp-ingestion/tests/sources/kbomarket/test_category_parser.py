from app.sources.kbomarket.category_parser import parse_category_urls

SEED_URL = "https://kbomarket.com"


class TestParseCategoryUrls:
    def test_카테고리_url_추출(self):
        html = """
        <html><body>
          <a href="/category/기아타이거즈/160/">기아</a>
          <a href="/category/삼성라이온즈/161/">삼성</a>
        </body></html>
        """
        urls = parse_category_urls(html, SEED_URL)
        assert len(urls) == 2
        assert "https://kbomarket.com/category/기아타이거즈/160/" in urls

    def test_admin_경로_제외(self):
        html = """
        <html><body>
          <a href="/admin/product/list">관리자</a>
          <a href="/category/kia/160/">정상</a>
        </body></html>
        """
        urls = parse_category_urls(html, SEED_URL)
        assert len(urls) == 1
        assert all("/admin" not in u for u in urls)

    def test_api_경로_제외(self):
        html = """
        <html><body>
          <a href="/api/products">API</a>
          <a href="/category/kia/160/">정상</a>
        </body></html>
        """
        urls = parse_category_urls(html, SEED_URL)
        assert len(urls) == 1
        assert all("/api" not in u for u in urls)

    def test_숫자id_없는_카테고리_제외(self):
        html = """
        <html><body>
          <a href="/category/kia/">숫자ID없음</a>
          <a href="/category/kia/160/">정상</a>
        </body></html>
        """
        urls = parse_category_urls(html, SEED_URL)
        assert len(urls) == 1

    def test_중복_제거(self):
        html = """
        <html><body>
          <a href="/category/kia/160/">기아1</a>
          <a href="/category/kia/160/">기아2</a>
        </body></html>
        """
        urls = parse_category_urls(html, SEED_URL)
        assert len(urls) == 1

    def test_카테고리_없으면_빈_리스트(self):
        html = "<html><body><a href='/about'>소개</a></body></html>"
        urls = parse_category_urls(html, SEED_URL)
        assert urls == []
