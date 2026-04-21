import re
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse


def parse_category_urls(html: str, seed_url: str) -> list[str]:
    """
    KBO마켓 페이지에서 카테고리 URL 목록을 추출한다.

    추출 조건:
        1. /category/ 경로를 포함해야 한다
        2. /category/{이름}/{숫자}/ 형태로 끝나야 한다 (숫자 = 카테고리 ID)
        3. /admin, /api 경로는 제외한다 (robots.txt 기반)

    예시:
        포함: https://kbomarket.com/category/기아타이거즈/160/
        제외: https://kbomarket.com/admin/product/list
        제외: https://kbomarket.com/category/기아타이거즈/ (숫자 ID 없음)

    Returns:
        중복 제거된 카테고리 URL 목록 (정렬됨)
    """
    soup = BeautifulSoup(html, "lxml")
    # seed_url에서 도메인만 추출해서 상대 URL을 절대 URL로 변환할 때 사용한다
    parsed = urlparse(seed_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    out = set()  # 중복을 자동으로 제거하기 위해 set을 사용한다

    for a in soup.select("a[href]"):
        href = a.get("href", "").strip()
        if not href:
            continue

        # 상대 URL을 절대 URL로 변환한다
        # 예: "/category/kia/160/" → "https://kbomarket.com/category/kia/160/"
        abs_url = urljoin(base, href)

        # robots.txt 기반 제외 경로
        # KBO마켓 robots.txt: Disallow: /admin, /api
        if "/admin" in abs_url or "/api" in abs_url:
            continue

        # /category/ 경로가 없으면 카테고리가 아니다
        if "/category/" not in abs_url:
            continue

        # /category/{이름}/{숫자}/ 형태인지 확인한다
        # 예: /category/기아타이거즈/160/ ← 매칭
        # 예: /category/기아타이거즈/    ← 미매칭 (숫자 ID 없음)
        if not re.search(r"/category/.+/\d+/?$", abs_url):
            continue

        out.add(abs_url)

    # 정렬해서 반환한다
    # 정렬하면 테스트에서 순서가 일정해서 비교하기 쉽다
    return sorted(out)
