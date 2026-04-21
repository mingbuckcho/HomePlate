import re
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse


def parse_goods_page(html: str, page_url: str) -> tuple[list[dict], str | None]:
    """
    KBO마켓 카테고리 페이지에서 굿즈 목록과 다음 페이지 URL을 추출한다.

    HTML 구조 (실제 KBO마켓 기반):
        <ul class="prdList">
          <li class="xans-record-">
            <div class="thumbnail">
              <a href="/product/item/123"><img src="..."/></a>
            </div>
            <div class="name">
              <a href="/product/item/123">
                <span class="displaynone">상품명 :</span>  ← 숨겨진 레이블
                <span>KIA 응원 티셔츠</span>              ← 실제 상품명
              </a>
            </div>
            <div class="description" ec-data-price="29000"> ← 가격은 속성값
              ...
            </div>
          </li>
        </ul>

    Args:
        html:     fetch_html()로 가져온 HTML 문자열
        page_url: 현재 페이지 URL (상대 URL → 절대 URL 변환에 필요)

    Returns:
        (굿즈 목록, 다음 페이지 URL)
        굿즈 목록의 각 항목:
            productUrl:        상품 상세 페이지 URL
            title:             상품명
            priceWon:          가격 (원화 정수, 없으면 None)
            thumbnailUrl:      썸네일 이미지 URL (없으면 None)
            sourceCategoryUrl: 수집한 카테고리 페이지 URL
                               (exporter.py의 TEAM_KEYWORDS 매핑에 사용)
    """
    soup = BeautifulSoup(html, "lxml")
    parsed = urlparse(page_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    goods = []

    # 상품 목록 컨테이너를 찾는다
    prd_list = soup.select_one("ul.prdList")
    if not prd_list:
        # 상품이 없는 카테고리이거나 HTML 구조가 바뀐 경우
        return [], None

    for card in prd_list.select("li.xans-record-"):
        # ── 상품 URL 추출 ────────────────────────────────────────────
        a_tag = card.select_one("div.thumbnail a[href]")
        if not a_tag:
            continue

        product_url = urljoin(base, a_tag.get("href", "").strip())

        # robots.txt 기반 제외 및 상품 URL 검증
        if "/admin" in product_url or "/api" in product_url:
            continue
        # /product/ 경로가 없으면 상품 URL이 아니다
        if "/product/" not in product_url:
            continue

        # 같은 상품이 여러 카테고리에 노출되면 URL이 달라진다.
        # 예: /product/kia유니폼/230/category/1/  → 카테고리1
        #     /product/kia유니폼/230/category/50/ → 카테고리50 (동일 상품)
        # category/ 이하를 제거해서 상품 고유 URL로 정규화한다.
        # MongoDB upsert 키가 동일해져서 중복 저장이 방지되고,
        # exporter의 가격변동 감지(SELECT FOR UPDATE)도 정확해진다.
        m = re.match(r"(https?://[^/]+/product/[^/]+/\d+/)", product_url)
        if m:
            product_url = m.group(1)

        # ── 상품명 추출 ──────────────────────────────────────────────
        # div.name 안에는 두 종류의 span이 있다:
        #   1. class="displaynone": "상품명 :" 같은 레이블 (화면에 안 보임)
        #   2. 일반 span: 실제 상품명
        # displaynone을 제거하고 나머지 텍스트만 가져온다
        title = None
        name_div = card.select_one("div.name")
        if name_div:
            # decompose(): DOM에서 완전히 제거한다
            for hidden in name_div.select(".displaynone"):
                hidden.decompose()
            title = name_div.get_text(strip=True)

        # 상품명이 없으면 불완전한 데이터이므로 건너뛴다
        if not title:
            continue

        # ── 가격 추출 ────────────────────────────────────────────────
        # 가격은 텍스트("29,000원")가 아닌 ec-data-price 속성값("29000")을 사용한다
        # 이유:
        #   텍스트는 "품절", "판매완료" 등 문자열이 섞일 수 있다
        #   속성값은 항상 숫자(또는 빈 문자열)이어서 더 신뢰할 수 있다
        price_won = None
        desc_div = card.select_one("div.description[ec-data-price]")
        if desc_div:
            raw = desc_div.get("ec-data-price", "").strip()
            # 숫자가 아닌 모든 문자를 제거한다 (쉼표, 원화 기호 등)
            digits = re.sub(r"[^\d]", "", raw)
            price_won = int(digits) if digits else None

        # ── 썸네일 URL 추출 ──────────────────────────────────────────
        thumbnail_url = None
        img = card.select_one("div.thumbnail img")
        if img:
            # src가 없으면 lazy loading을 위한 data-src를 사용한다
            src = img.get("src") or img.get("data-src") or ""
            # //로 시작하는 프로토콜 상대 URL을 https로 변환한다
            # 예: "//kbomarket.com/image.jpg" → "https://kbomarket.com/image.jpg"
            if src.startswith("//"):
                src = "https:" + src
            thumbnail_url = src or None

        goods.append(
            {
                "productUrl": product_url,
                "title": title,
                "priceWon": price_won,
                "thumbnailUrl": thumbnail_url,
                # exporter.py의 infer_team_id()가 이 URL에서 팀을 추론한다
                # 예: /category/기아타이거즈/160/ → "KIA"
                "sourceCategoryUrl": page_url,
            }
        )

    # ── 다음 페이지 URL 추출 ─────────────────────────────────────────
    next_url = None
    # 여러 가지 페이지네이션 HTML 구조를 처리한다
    next_tag = soup.select_one("a.next, li.next a, .pagination a[href*='page=']")
    if next_tag:
        href = next_tag.get("href", "").strip()
        next_url = urljoin(base, href) if href else None

    return goods, next_url
