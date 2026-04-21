from ..base import BaseCrawler
from ...http_fetch import build_session
from ...config import KBO_TEAM_RANK_URL
from ...mongo_client import utc_now
from .parser import parse_team_rank_page


SOURCE_TYPE = "KBO_TEAM_RANK"


class KboTeamRankCrawler(BaseCrawler):
    def run(self) -> int:
        source = self._load_source(SOURCE_TYPE)
        policy = source.get("policy", {})
        session = build_session()

        url = self.job["payload"].get("url") or KBO_TEAM_RANK_URL
        timeout = int(policy.get("httpTimeoutSec", 20))

        try:
            print(f"[kbo_team_rank] 팀 순위 요청: {url}")
            resp = session.get(url, timeout=timeout)
            resp.raise_for_status()

            date_str, rows = parse_team_rank_page(resp.text)

            if not rows:
                self._log_event(SOURCE_TYPE, "INFO", "팀 순위 데이터 없음", item_count=0)
                return 0

            now = utc_now()
            for row in rows:
                doc = {**row, "date": date_str}
                self.db.team_rank_items_stg.update_one(
                    {"date": date_str, "teamId": row["teamId"]},
                    {
                        "$set": {**doc, "updatedAt": now},
                        "$setOnInsert": {"createdAt": now},
                    },
                    upsert=True,
                )

            count = len(rows)
            self._log_event(
                SOURCE_TYPE,
                "INFO",
                f"KBO 팀 순위 {count}건 수집 완료 (date={date_str})",
                item_count=count,
            )
            return count

        except Exception as e:
            self._log_event(SOURCE_TYPE, "ERROR", f"KBO 팀 순위 수집 실패: {str(e)[:500]}")
            self._check_and_alert(SOURCE_TYPE)
            raise
