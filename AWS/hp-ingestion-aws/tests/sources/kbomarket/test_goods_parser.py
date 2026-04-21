from app.sources.kbomarket.goods_parser import parse_goods_page

BASE_URL = "https://kbomarket.com/category/kia/160/"


def make_html(cards="", pagination=""):
    """
    테스트용 HTML을 만드는 헬퍼.
    cards: li.xans-record- 태그 내용
    pagination: 페이지네이션 HTML
    """
    return f"""
    <html><body>
      <ul class="prdList">
        {cards}
      </ul>
      {pagination}
    </body></html>
    """


def make_card(
    product_path="/product/item/123",
    name="KIA 응원 티셔츠",
    price="29000",
    img_src="https://img.kbomarket.com/thumb.jpg",
    hidden_label="상품명 :",
):
    """
    테스트용 상품 카드 HTML을 만드는 헬퍼.
    실제 KBO마켓 HTML 구조를 기반으로 한다.
    """
    return f"""
    <li class="xans-record-">
      <div class="thumbnail">
        <a href="{product_path}">
          <img src="{img_src}"/>
        </a>
      </div>
      <div class="description" ec-data-price="{price}"></div>
      <div class="name">
        <a href="{product_path}">
          <span class="displaynone">{hidden_label}</span>
          <span>{name}</span>
        </a>
      </div>
    </li>
    """


class TestParseGoodsPageBasic:
    """기본 파싱 동작 테스트."""

    def test_정상_상품_추출(self):
        """정상적인 상품 카드에서 모든 필드를 추출한다."""
        html = make_html(cards=make_card())
        goods, next_url = parse_goods_page(html, BASE_URL)

        assert len(goods) == 1
        assert goods[0]["title"] == "KIA 응원 티셔츠"
        assert goods[0]["priceWon"] == 29000
        assert goods[0]["productUrl"] == "https://kbomarket.com/product/item/123"
        assert goods[0]["thumbnailUrl"] == "https://img.kbomarket.com/thumb.jpg"
        assert goods[0]["sourceCategoryUrl"] == BASE_URL
        assert next_url is None

    def test_prdList_없으면_빈_리스트(self):
        """
        ul.prdList가 없으면 빈 목록을 반환한다.
        카테고리 페이지 구조가 바뀌었을 때의 방어 로직이다.
        """
        html = "<html><body><p>상품이 없습니다.</p></body></html>"
        goods, next_url = parse_goods_page(html, BASE_URL)

        assert goods == []
        assert next_url is None

    def test_여러_상품_추출(self):
        """여러 개의 상품 카드를 모두 추출한다."""
        cards = (
            make_card("/product/item/1", "상품 A", "10000")
            + make_card("/product/item/2", "상품 B", "20000")
            + make_card("/product/item/3", "상품 C", "30000")
        )
        html = make_html(cards=cards)
        goods, next_url = parse_goods_page(html, BASE_URL)

        assert len(goods) == 3
        assert goods[0]["title"] == "상품 A"
        assert goods[1]["title"] == "상품 B"
        assert goods[2]["title"] == "상품 C"


class TestParseGoodsPageFiltering:
    """필터링 로직 테스트 (admin, api 경로 제외)."""

    def test_admin_경로_상품_제외(self):
        """
        /admin/ 경로의 상품은 수집하지 않는다.
        robots.txt: Disallow: /admin
        """
        admin_card = make_card(product_path="/admin/product/123", name="관리 상품")
        html = make_html(cards=admin_card)
        goods, _ = parse_goods_page(html, BASE_URL)

        assert len(goods) == 0

    def test_api_경로_상품_제외(self):
        """
        /api/ 경로의 상품은 수집하지 않는다.
        robots.txt: Disallow: /api
        """
        api_card = make_card(product_path="/api/product/123", name="API 상품")
        html = make_html(cards=api_card)
        goods, _ = parse_goods_page(html, BASE_URL)

        assert len(goods) == 0

    def test_product_경로_없으면_제외(self):
        """
        /product/ 경로가 없으면 상품 URL이 아니므로 제외한다.
        """
        invalid_card = make_card(product_path="/goods/item/123", name="잘못된 경로")
        html = make_html(cards=invalid_card)
        goods, _ = parse_goods_page(html, BASE_URL)

        assert len(goods) == 0

    def test_상품명_없으면_제외(self):
        """
        상품명이 비어있으면 불완전한 데이터이므로 제외한다.
        """
        # name을 빈 문자열로 설정한다
        empty_name_card = make_card(name="")
        html = make_html(cards=empty_name_card)
        goods, _ = parse_goods_page(html, BASE_URL)

        assert len(goods) == 0

    def test_thumbnail_없는_카드도_수집(self):
        """
        썸네일이 없어도 다른 정보가 있으면 수집한다.
        thumbnailUrl은 None으로 저장된다.
        """
        card_no_img = f"""
        <li class="xans-record-">
          <div class="thumbnail">
            <a href="/product/item/999"></a>
          </div>
          <div class="description" ec-data-price="5000"></div>
          <div class="name">
            <a href="/product/item/999">
              <span>이미지 없는 상품</span>
            </a>
          </div>
        </li>
        """
        html = make_html(cards=card_no_img)
        goods, _ = parse_goods_page(html, BASE_URL)

        assert len(goods) == 1
        assert goods[0]["thumbnailUrl"] is None


class TestParseGoodsPagePrice:
    """가격 추출 테스트."""

    def test_가격_정상_추출(self):
        """ec-data-price 속성에서 가격을 추출한다."""
        html = make_html(cards=make_card(price="29000"))
        goods, _ = parse_goods_page(html, BASE_URL)

        assert goods[0]["priceWon"] == 29000

    def test_가격_속성_없으면_None(self):
        """
        ec-data-price 속성이 없는 div는 가격을 None으로 처리한다.
        품절 상품에는 가격 속성이 없을 수 있다.
        """
        card_no_price = f"""
        <li class="xans-record-">
          <div class="thumbnail">
            <a href="/product/item/100"><img src="img.jpg"/></a>
          </div>
          <div class="description">가격 없음</div>
          <div class="name">
            <a href="/product/item/100">
              <span>품절 상품</span>
            </a>
          </div>
        </li>
        """
        html = make_html(cards=card_no_price)
        goods, _ = parse_goods_page(html, BASE_URL)

        assert len(goods) == 1
        assert goods[0]["priceWon"] is None

    def test_가격_빈_문자열이면_None(self):
        """ec-data-price가 있지만 값이 비어있으면 None이다."""
        html = make_html(cards=make_card(price=""))
        goods, _ = parse_goods_page(html, BASE_URL)

        assert goods[0]["priceWon"] is None

    def test_가격_숫자_이외_문자_제거(self):
        """
        가격에 쉼표나 원화 기호가 있어도 숫자만 추출한다.
        예: "29,000" → 29000
        """
        html = make_html(cards=make_card(price="29,000"))
        goods, _ = parse_goods_page(html, BASE_URL)

        assert goods[0]["priceWon"] == 29000


class TestParseGoodsPageThumbnail:
    """썸네일 URL 추출 테스트."""

    def test_src_속성_사용(self):
        """img의 src 속성에서 썸네일 URL을 가져온다."""
        html = make_html(cards=make_card(img_src="https://img.example.com/thumb.jpg"))
        goods, _ = parse_goods_page(html, BASE_URL)

        assert goods[0]["thumbnailUrl"] == "https://img.example.com/thumb.jpg"

    def test_data_src_fallback(self):
        """
        src가 없으면 lazy loading을 위한 data-src를 사용한다.
        일부 상품 목록은 스크롤 시 이미지를 로드하는 lazy loading을 사용한다.
        """
        card_lazy = f"""
        <li class="xans-record-">
          <div class="thumbnail">
            <a href="/product/item/200">
              <img data-src="https://img.example.com/lazy.jpg"/>
            </a>
          </div>
          <div class="description" ec-data-price="10000"></div>
          <div class="name">
            <a href="/product/item/200">
              <span>레이지 상품</span>
            </a>
          </div>
        </li>
        """
        html = make_html(cards=card_lazy)
        goods, _ = parse_goods_page(html, BASE_URL)

        assert goods[0]["thumbnailUrl"] == "https://img.example.com/lazy.jpg"

    def test_프로토콜_상대_url_https_변환(self):
        """
        //로 시작하는 프로토콜 상대 URL을 https://로 변환한다.
        예: "//kbomarket.com/image.jpg" → "https://kbomarket.com/image.jpg"
        """
        html = make_html(cards=make_card(img_src="//kbomarket.com/image.jpg"))
        goods, _ = parse_goods_page(html, BASE_URL)

        assert goods[0]["thumbnailUrl"] == "https://kbomarket.com/image.jpg"


class TestParseGoodsPageProductUrl:
    """상품 URL 추출 테스트."""

    def test_상대_url을_절대_url로_변환(self):
        """
        /product/item/123 같은 상대 URL을
        https://kbomarket.com/product/item/123 으로 변환한다.
        """
        html = make_html(cards=make_card(product_path="/product/item/123"))
        goods, _ = parse_goods_page(html, BASE_URL)

        assert goods[0]["productUrl"] == "https://kbomarket.com/product/item/123"

    def test_sourceCategoryUrl_저장(self):
        """
        상품이 수집된 카테고리 URL을 sourceCategoryUrl에 저장한다.
        exporter.py의 infer_team_id()가 이 값을 사용해서 구단을 추론한다.
        """
        html = make_html(cards=make_card())
        goods, _ = parse_goods_page(html, BASE_URL)

        assert goods[0]["sourceCategoryUrl"] == BASE_URL


class TestParseGoodsPageDisplaynone:
    """displaynone 레이블 제거 테스트."""

    def test_displaynone_제거_후_상품명_추출(self):
        """
        div.name 안의 .displaynone 스팬을 제거하고 실제 상품명만 추출한다.
        KBO마켓은 "상품명 :", "제조사 :" 같은 레이블을 displaynone으로 숨긴다.
        """
        html = make_html(
            cards=make_card(name="KIA 응원 티셔츠", hidden_label="상품명 :")
        )
        goods, _ = parse_goods_page(html, BASE_URL)

        # "상품명 :"이 제거되고 실제 이름만 남아야 한다
        assert goods[0]["title"] == "KIA 응원 티셔츠"
        assert "상품명" not in goods[0]["title"]

    def test_여러_displaynone_모두_제거(self):
        """여러 개의 displaynone 요소가 있어도 모두 제거한다."""
        card_multi_hidden = f"""
        <li class="xans-record-">
          <div class="thumbnail">
            <a href="/product/item/300"><img src="img.jpg"/></a>
          </div>
          <div class="description" ec-data-price="15000"></div>
          <div class="name">
            <a href="/product/item/300">
              <span class="displaynone">상품명 :</span>
              <span class="displaynone">브랜드 :</span>
              <span>진짜 상품명</span>
            </a>
          </div>
        </li>
        """
        html = make_html(cards=card_multi_hidden)
        goods, _ = parse_goods_page(html, BASE_URL)

        assert goods[0]["title"] == "진짜 상품명"


class TestParseGoodsPagePagination:
    """페이지네이션 테스트."""

    def test_다음_페이지_url_추출_next_클래스(self):
        """a.next 클래스로 다음 페이지 URL을 추출한다."""
        pagination = '<a class="next" href="/category/kia/160/?page=2">다음</a>'
        html = make_html(cards=make_card(), pagination=pagination)
        goods, next_url = parse_goods_page(html, BASE_URL)

        assert next_url == "https://kbomarket.com/category/kia/160/?page=2"

    def test_다음_페이지_url_추출_li_next(self):
        """li.next > a 구조로 다음 페이지 URL을 추출한다."""
        pagination = (
            '<ul><li class="next"><a href="/category/kia/160/?page=3">▶</a></li></ul>'
        )
        html = make_html(cards=make_card(), pagination=pagination)
        _, next_url = parse_goods_page(html, BASE_URL)

        assert next_url == "https://kbomarket.com/category/kia/160/?page=3"

    def test_마지막_페이지는_next_url_None(self):
        """다음 페이지 링크가 없으면 None을 반환한다."""
        html = make_html(cards=make_card())
        _, next_url = parse_goods_page(html, BASE_URL)

        assert next_url is None

    def test_다음_페이지_상대_url을_절대_url로_변환(self):
        """다음 페이지 URL도 상대 URL이면 절대 URL로 변환한다."""
        pagination = '<a class="next" href="?page=2">다음</a>'
        html = make_html(cards=make_card(), pagination=pagination)
        _, next_url = parse_goods_page(html, BASE_URL)

        # BASE_URL 기반으로 절대 URL로 변환된다
        assert next_url is not None
        assert next_url.startswith("https://kbomarket.com")


class TestParseGoodsPageMixed:
    """정상 상품과 필터링 대상이 섞인 경우."""

    def test_정상_admin_혼합(self):
        """
        정상 상품과 admin 경로 상품이 섞여 있을 때
        정상 상품만 추출한다.
        """
        cards = (
            make_card("/product/item/1", "정상 상품 A")
            + make_card("/admin/product/2", "관리 상품")
            + make_card("/product/item/3", "정상 상품 B")
        )
        html = make_html(cards=cards)
        goods, _ = parse_goods_page(html, BASE_URL)

        assert len(goods) == 2
        titles = [g["title"] for g in goods]
        assert "정상 상품 A" in titles
        assert "정상 상품 B" in titles
        assert "관리 상품" not in titles
