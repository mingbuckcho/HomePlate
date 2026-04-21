from ..base import BaseCrawler
from ...http_fetch import build_session, fetch_html, polite_sleep
from .goods_parser import parse_goods_page
from ...mongo_client import utc_now

SOURCE_TYPE = "KBOMARKET_GOODS"


class KbomarketGoodsCrawler(BaseCrawler):
    """
    KBO마켓 카테고리 페이지에서 굿즈 상품을 수집해서
    goods_items_stg 컬렉션에 저장한다.

    중단점(Checkpoint) 메커니즘:
        maxPagesPerRun이나 maxItemsPerRun에 도달하면
        현재 페이지 URL을 payload.lastPageUrl에 저장하고
        즉시 PENDING으로 돌아가서 재시도를 예약한다.
        다음 실행 때 lastPageUrl부터 재개한다.

        이렇게 하는 이유:
            한 잡이 너무 오래 걸리면 다른 잡(뉴스 수집 등)을 처리할 수 없다.
            페이지를 나눠서 처리하면 워커가 여러 잡을 골고루 처리할 수 있다.

        중단점 초기화:
            모든 페이지를 다 수집하면 lastPageUrl을 제거한다.
            다음 번 카테고리 탐색(Discover) 때 다시 처음부터 수집한다.

    멱등성:
        productUrl 기준으로 upsert하므로
        같은 상품을 다시 수집해도 중복 저장되지 않는다.
    """

    def run(self) -> int:
        source = self._load_source(SOURCE_TYPE)
        policy = source.get("policy", {})
        session = build_session()

        max_pages = policy.get("maxPagesPerRun", 50)
        max_items = policy.get("maxItemsPerRun", 500)

        # payload.lastPageUrl이 있으면 이전에 중단된 지점부터 재개한다
        # 없으면 카테고리 첫 페이지(payload.url)부터 시작한다
        page_url = self.job["payload"].get("lastPageUrl") or self.job["payload"]["url"]
        count = 0
        page_num = 1

        try:
            while page_url:
                # 제한 도달 시 중단점을 저장하고 즉시 재시도를 예약한다
                if page_num > max_pages or count >= max_items:
                    print(
                        f"[kbomarket_goods] 제한 도달 "
                        f"(페이지:{page_num}/{max_pages}, "
                        f"건수:{count}/{max_items}), "
                        f"중단점 저장 후 재시도 예약"
                    )
                    self._save_checkpoint(page_url)
                    self._log_event(
                        SOURCE_TYPE,
                        "INFO",
                        f"중단점 저장 후 재시도 예약 "
                        f"(url={self.job['payload']['url']}, "
                        f"page={page_num}, count={count})",
                        item_count=count,
                    )
                    return count

                print(f"[kbomarket_goods] {page_num}페이지 요청: {page_url}")
                html = fetch_html(
                    session, page_url, timeout=policy.get("httpTimeoutSec", 20)
                )
                goods, next_url = parse_goods_page(html, page_url)

                now = utc_now()
                for g in goods:
                    # productUrl 기준으로 upsert한다 (멱등성)
                    self.db.goods_items_stg.update_one(
                        {"productUrl": g["productUrl"]},
                        {
                            "$set": {**g, "updatedAt": now},
                            "$setOnInsert": {"createdAt": now},
                        },
                        upsert=True,
                    )
                    count += 1

                print(
                    f"[kbomarket_goods] {page_num}페이지 완료: "
                    f"{len(goods)}건 (누적 {count}건)"
                )

                page_url = next_url
                page_num += 1
                if page_url:
                    polite_sleep(policy.get("minDelaySec"), policy.get("maxDelaySec"))

            # 모든 페이지 수집 완료
            # lastPageUrl을 제거해서 다음 실행 때 처음부터 수집하게 한다
            self._clear_checkpoint()

            cat_url = self.job["payload"]["url"]
            self._log_event(
                SOURCE_TYPE,
                "INFO",
                f"굿즈 수집 완료 (카테고리: {cat_url}, 총 {count}건)",
                item_count=count,
            )
            return count

        except Exception as e:
            self._log_event(
                SOURCE_TYPE, "ERROR", f"굿즈 수집 실패 (url={page_url}): {str(e)[:500]}"
            )
            self._check_and_alert(SOURCE_TYPE)
            raise

    def _save_checkpoint(self, page_url: str):
        """
        현재 페이지 URL을 중단점으로 저장하고
        즉시 재시도되도록 PENDING으로 돌린다.

        complete_job이나 fail_job을 호출하지 않는다.
        잡이 "실패"한 게 아니라 "나눠서 처리 중"이기 때문이다.
        attempts가 증가하지 않는다.
        """
        now = utc_now()
        self.db.crawl_jobs.update_one(
            {"_id": self.job["_id"]},
            {
                "$set": {
                    "payload.lastPageUrl": page_url,  # 다음 실행 때 여기서 재개
                    "status": "PENDING",  # 즉시 재시도 가능 상태
                    "nextRunAt": now,  # 즉시 실행 (지연 없음)
                    "updatedAt": now,
                }
            },
        )

    def _clear_checkpoint(self):
        """
        중단점을 제거한다.
        모든 페이지 수집 완료 시 호출한다.
        다음 실행 때 처음 페이지(payload.url)부터 다시 시작한다.
        """
        self.db.crawl_jobs.update_one(
            {"_id": self.job["_id"]},
            # $unset: 필드를 완전히 제거한다
            {"$unset": {"payload.lastPageUrl": ""}},
        )
