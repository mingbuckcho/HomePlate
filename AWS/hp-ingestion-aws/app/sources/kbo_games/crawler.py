from datetime import datetime
from zoneinfo import ZoneInfo

from ..base import BaseCrawler
from ...http_fetch import build_session, polite_sleep
from ...config import KBO_SCHEDULE_API_URL, KBO_SCHEDULE_SEASON
from ...mongo_client import utc_now
from .parser import parse_schedule_page


SOURCE_TYPE = "KBO_GAMES"


def fetch_schedule_json(
    session,
    url: str,
    form: dict,
    timeout: int = 20,
    retries: int = 2,
) -> dict:
    last_err = None
    for attempt in range(retries + 1):
        try:
            resp = session.post(url, data=form, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            last_err = e
            if attempt < retries:
                print(
                    f"[kbo_games] 재시도 {attempt + 1}/{retries}: month={form.get('gameMonth')}"
                )
                polite_sleep()

    raise RuntimeError(
        f"KBO 일정 JSON 가져오기 실패 (시도 {retries + 1}회): "
        f"url={url}, month={form.get('gameMonth')} / {last_err}"
    )


class KboGamesCrawler(BaseCrawler):
    def run(self) -> int:
        source = self._load_source(SOURCE_TYPE)
        policy = source.get("policy", {})
        session = build_session()

        api_url = self.job["payload"].get("url") or KBO_SCHEDULE_API_URL
        season_id = int(
            self.job["payload"].get("seasonId")
            or policy.get("seasonId")
            or KBO_SCHEDULE_SEASON
        )
        months = policy.get("months") or [f"{m:02d}" for m in range(1, 13)]
        team_id = str(policy.get("teamId", ""))
        timeout = int(policy.get("httpTimeoutSec", 20))
        retries = int(policy.get("maxRetries", 2))
        min_delay = policy.get("minDelaySec")
        max_delay = policy.get("maxDelaySec")

        count = 0
        now_kst = datetime.now(ZoneInfo("Asia/Seoul")).replace(tzinfo=None)

        try:
            for idx, month in enumerate(months):
                form = {
                    "leId": "1",
                    "srIdList": "0,9,6",
                    "seasonId": str(season_id),
                    "gameMonth": str(month).zfill(2),
                    "teamId": team_id,
                }
                print(f"[kbo_games] {season_id}-{form['gameMonth']} 일정 요청")
                data = fetch_schedule_json(
                    session,
                    api_url,
                    form,
                    timeout=timeout,
                    retries=retries,
                )
                # 일정이 없는 달은 KBO 응답이 rows=[]로 오고,
                # parse_schedule_page가 빈 리스트를 반환한다.
                # 이 경우 예외 없이 다음 월을 계속 수집한다.
                games = parse_schedule_page(
                    data, season_id=season_id, fallback_month=form["gameMonth"]
                )
                print(
                    f"[kbo_games] {season_id}-{form['gameMonth']} 파싱 완료: {len(games)}건"
                )

                now = utc_now()
                for g in games:
                    if now_kst >= g["gameStartAt"]:
                        g["gameStatus"] = "ENDED"
                    elif now_kst >= datetime.strptime(g["ticketOpenAt"], "%Y-%m-%d"):
                        g["gameStatus"] = "OPEN"
                    else:
                        g["gameStatus"] = "SCHEDULED"

                    self.db.games_items_stg.update_one(
                        # Mongo staging은 gameId(해시) 기준으로 upsert한다.
                        {"gameId": g["gameId"]},
                        {
                            "$set": {**g, "updatedAt": now},
                            "$setOnInsert": {"createdAt": now},
                        },
                        upsert=True,
                    )
                    count += 1

                if idx < len(months) - 1:
                    polite_sleep(min_delay, max_delay)

            self._log_event(
                SOURCE_TYPE,
                "INFO",
                f"KBO 경기 일정 {count}건 수집 완료 (season={season_id})",
                item_count=count,
            )
            return count

        except Exception as e:
            self._log_event(SOURCE_TYPE, "ERROR", f"KBO 일정 수집 실패: {str(e)[:500]}")
            self._check_and_alert(SOURCE_TYPE)
            raise
