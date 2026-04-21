from ..base import BaseCrawler
from ...http_fetch import build_session, fetch_html
from .category_parser import parse_category_urls
from ...mongo_client import utc_now

SOURCE_TYPE = "KBOMARKET_GOODS"


class KbomarketGoodsDiscoverCrawler(BaseCrawler):
    """
    KBO마켓의 카테고리 목록을 탐색해서
    각 카테고리별로 CRAWL_KBOMARKET_GOODS 잡을 등록한다.

    Discover(탐색) 크롤러의 역할:
        실제 데이터를 수집하지 않는다.
        어떤 카테고리가 있는지 파악하고
        각 카테고리를 수집할 잡을 등록하는 것이 전부다.

    카테고리 변경 처리:
        새로 생긴 카테고리: CRAWL_KBOMARKET_GOODS 잡 추가
        없어진 카테고리:   기존 잡을 DISABLED로 변경 (soft delete)

        soft delete를 사용하는 이유:
            삭제하면 해당 카테고리가 언제 없어졌는지 이력이 사라진다.
            DISABLED 상태로 남겨두면:
            - 언제 비활성화됐는지 updatedAt으로 추적 가능
            - 나중에 다시 생기면 PENDING으로 복구 가능
            - 운영 중 실수로 비활성화된 경우 원인 파악 가능

    네이밍 규칙:
        Discover = 잡을 탐색해서 등록하는 역할
        Goods    = KBO마켓 굿즈 도메인
        나중에 다른 도메인을 추가할 때:
            KbomarketTicketDiscoverCrawler (티켓)
            LotteGoodsDiscoverCrawler (롯데자이언츠샵)
    """

    def run(self) -> int:
        source = self._load_source(SOURCE_TYPE)
        policy = source.get("policy", {})
        session = build_session()
        url = self.job["payload"]["url"]

        try:
            print(f"[kbomarket_goods_discover] 카테고리 탐색 시작: {url}")
            html = fetch_html(session, url, timeout=policy.get("httpTimeoutSec", 20))
            new_cat_urls = set(parse_category_urls(html, url))
            print(f"[kbomarket_goods_discover] {len(new_cat_urls)}개 카테고리 발견")

            # ── 없어진 카테고리 비활성화 ─────────────────────────────
            # 현재 DISABLED가 아닌 CRAWL_KBOMARKET_GOODS 잡의 URL 목록을 가져온다
            existing_docs = self.db.crawl_jobs.find(
                {
                    "type": "CRAWL_KBOMARKET_GOODS",
                    "status": {"$ne": "DISABLED"},  # DISABLED 제외
                },
                {"payload.url": 1},  # URL 필드만 가져온다 (네트워크 절약)
            )
            existing_urls = {
                doc["payload"]["url"]
                for doc in existing_docs
                if doc.get("payload", {}).get("url")
            }

            # 기존에 있었지만 이번 탐색에서 나타나지 않은 카테고리
            removed_urls = existing_urls - new_cat_urls
            for dead_url in removed_urls:
                self.db.crawl_jobs.update_one(
                    {"type": "CRAWL_KBOMARKET_GOODS", "payload.url": dead_url},
                    {
                        "$set": {
                            "status": "DISABLED",
                            "updatedAt": utc_now(),
                        }
                    },
                )
                print(f"[kbomarket_goods_discover] 카테고리 비활성화: {dead_url}")

            # ── 새로 생긴 카테고리 잡 등록 ──────────────────────────
            now = utc_now()
            added = 0
            for cat_url in new_cat_urls:
                # PENDING이나 RUNNING 상태의 같은 잡이 있으면 새로 등록하지 않는다
                # $setOnInsert: upsert=True일 때 새로 만들 때만 이 필드를 설정한다
                result = self.db.crawl_jobs.update_one(
                    {
                        "type": "CRAWL_KBOMARKET_GOODS",
                        "payload.url": cat_url,
                        "status": {"$in": ["PENDING", "RUNNING"]},
                    },
                    {
                        "$setOnInsert": {
                            "type": "CRAWL_KBOMARKET_GOODS",
                            "status": "PENDING",
                            # DISCOVER보다 낮은 우선순위 (DISCOVER가 먼저 완료돼야)
                            "priority": 80,
                            "payload": {"url": cat_url},
                            "attempts": 0,
                            "nextRunAt": now,
                            "createdAt": now,
                            "updatedAt": now,
                        }
                    },
                    upsert=True,
                )
                # upserted_id가 있으면 새로 만들어진 것이다
                if result.upserted_id:
                    added += 1
                    print(f"[kbomarket_goods_discover] 새 카테고리 잡 등록: {cat_url}")

            summary = (
                f"카테고리 탐색 완료 "
                f"(발견:{len(new_cat_urls)}, 추가:{added}, "
                f"비활성화:{len(removed_urls)})"
            )
            print(f"[kbomarket_goods_discover] {summary}")

            self._log_event(SOURCE_TYPE, "INFO", summary, item_count=len(new_cat_urls))
            return len(new_cat_urls)

        except Exception as e:
            self._log_event(SOURCE_TYPE, "ERROR", f"카테고리 탐색 실패: {str(e)[:500]}")
            self._check_and_alert(SOURCE_TYPE)
            raise
