from datetime import date
from ..base import BaseCrawler
from ...http_fetch import build_session, fetch_json, polite_sleep
from .parser import NAVER_NEWS_API, parse_news_page
from ...mongo_client import utc_now

# 이 크롤러가 담당하는 소스 타입
# crawl_sources의 type 필드와 일치해야 한다
SOURCE_TYPE = "NAVER_KBO_NEWS"


class NaverNewsCrawler(BaseCrawler):
    """
    네이버 스포츠 KBO 뉴스 API에서 뉴스를 수집해서
    news_items_stg 컬렉션에 저장한다.

    수집 방식:
        오늘 날짜의 뉴스를 페이지별로 가져온다.
        has_next가 False가 될 때까지 반복한다.

    멱등성:
        같은 URL의 뉴스가 이미 있으면 UPDATE한다 (upsert).
        중복 수집해도 데이터가 늘어나지 않는다.
        이 특성을 멱등성(idempotent)이라고 한다.
        멱등성이 있으면 장애 후 재수집해도 안전하다.
    """

    def run(self) -> int:
        source = self._load_source(SOURCE_TYPE)
        policy = source.get("policy", {})
        session = build_session()
        page = 1
        count = 0
        today_str = date.today().strftime("%Y%m%d")

        # 뉴스는 오늘 날짜 기준이라 페이지가 많지 않다
        # 무한 루프 방지를 위한 안전장치로만 사용한다
        max_pages = policy.get("maxPagesPerRun", 200)

        try:
            while True:
                if page > max_pages:
                    print(f"[naver_news] 최대 페이지 도달 ({max_pages}), 종료")
                    break

                print(f"[naver_news] {page}페이지 요청 중... (날짜: {today_str})")

                url = NAVER_NEWS_API.format(
                    sort="latest", date=today_str, page=page, pageSize=40, isPhoto="N"
                )
                data = fetch_json(
                    session, url, timeout=policy.get("httpTimeoutSec", 25)
                )
                items, has_next = parse_news_page(data)

                print(f"[naver_news] {page}페이지 파싱 완료: {len(items)}건")

                now = utc_now()
                for item in items:
                    # url 기준으로 upsert한다
                    # 이미 있으면: $set으로 덮어쓴다 (제목, 썸네일 등 최신화)
                    # 없으면: $setOnInsert로 createdAt을 설정하고 새로 만든다
                    self.db.news_items_stg.update_one(
                        {"url": item["url"]},
                        {
                            "$set": {**item, "updatedAt": now},
                            "$setOnInsert": {"createdAt": now},
                        },
                        upsert=True,
                    )
                    count += 1

                if not has_next:
                    print(f"[naver_news] 마지막 페이지 도달, 수집 완료")
                    break

                page += 1
                polite_sleep(policy.get("minDelaySec"), policy.get("maxDelaySec"))

            # 성공 이벤트를 기록한다
            # events 컬렉션에서 집계 쿼리로 통계를 낼 수 있다
            self._log_event(
                SOURCE_TYPE,
                "INFO",
                f"뉴스 {count}건 수집 완료 (날짜: {today_str})",
                item_count=count,
            )
            return count

        except Exception as e:
            # 실패 이벤트를 기록하고 알림 여부를 확인한다
            self._log_event(SOURCE_TYPE, "ERROR", f"수집 실패: {str(e)[:500]}")
            self._check_and_alert(SOURCE_TYPE)
            # 예외를 다시 발생시켜서 worker.py의 fail_job이 처리하게 한다
            raise
