# ────────────────────────────────────────────────────────────────────
# 네이버 스포츠 KBO 뉴스 API 파서
#
# API 엔드포인트 형식:
#   https://api-gw.sports.naver.com/news/articles/kbaseball
#   ?sort=latest&date=20260219&page=1&pageSize=40&isPhoto=N
#
# 응답 구조:
#   {
#     "result": {
#       "newsList": [...],
#       "totalCount": 258,
#       "page": 1
#     }
#   }
# ────────────────────────────────────────────────────────────────────

NAVER_NEWS_API = (
    "https://api-gw.sports.naver.com/news/articles/kbaseball"
    "?sort={sort}&date={date}&page={page}&pageSize={pageSize}&isPhoto={isPhoto}"
)


def build_news_url(oid: str, aid: str) -> str:
    """
    oid(언론사 코드)와 aid(기사 ID)로 네이버 뉴스 URL을 만든다.
    예: oid="109", aid="0005480274"
     → "https://n.news.naver.com/mnews/article/109/0005480274"
    """
    return f"https://n.news.naver.com/mnews/article/{oid}/{aid}"


def parse_news_page(data: dict) -> tuple[list[dict], bool]:
    """
    API 응답 JSON에서 뉴스 목록을 추출하고 다음 페이지 여부를 반환한다.

    Args:
        data: fetch_json()으로 가져온 API 응답 딕셔너리

    Returns:
        (뉴스 목록, 다음 페이지 존재 여부)
        뉴스 목록의 각 항목:
            url:          네이버 뉴스 URL
            title:        기사 제목
            thumbnailUrl: 썸네일 URL (없으면 None)
            image: Image URL (없으면 None)
            publishedAt:  발행 일시
            sourceName:   언론사명 (예: OSEN, 스포츠조선)
            source:       수집 소스 식별자 (항상 "NAVER_KBO")

    다음 페이지 판단 로직:
        현재 페이지에서 받은 아이템 수 > 0
        AND (현재 페이지 번호 × 아이템 수) < 전체 수
    """
    result = data.get("result", {})
    news_list = result.get("newsList", [])
    total = result.get("totalCount", 0)
    page = result.get("page", 1)
    page_size = len(news_list)

    items = []
    for news in news_list:
        oid = news.get("oid", "")
        aid = news.get("aid", "")

        # oid나 aid가 없으면 올바른 URL을 만들 수 없으므로 건너뛴다
        if not oid or not aid:
            continue

        # image 필드가 비어있으면 thumbnail 필드로 대체한다
        # API에 따라 어떤 기사는 thumbnail만, 어떤 기사는 image만 있다
        thumbnail = news.get("image") or news.get("thumbnail") or None

        items.append(
            {
                "url": build_news_url(oid, aid),
                "title": news.get("title", ""),
                "thumbnailUrl": thumbnail,
                "publishedAt": news.get("dateTime"),
                "sourceName": news.get("sourceName", ""),
                # 나중에 다른 소스(스포츠조선 자체 API 등)와 구분하기 위한 식별자
                "source": "NAVER_KBO",
            }
        )

    # 다음 페이지가 있는지 판단한다
    # page_size > 0: 현재 페이지에 아이템이 있고
    # (page * page_size) < total: 아직 가져오지 않은 아이템이 있다
    has_next = page_size > 0 and (page * page_size) < total
    return items, has_next
