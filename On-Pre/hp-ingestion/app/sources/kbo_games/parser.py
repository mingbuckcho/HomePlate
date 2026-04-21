import re
import hashlib
from datetime import datetime, timedelta
from bs4 import BeautifulSoup


DAY_RE = re.compile(r"(\d{2})\.(\d{2})")
TIME_RE = re.compile(r"(\d{2}):(\d{2})")
TAG_RE = re.compile(r"<[^>]+>")
TEAM_ID_MAP = {
    # 긴 별칭을 먼저 배치해 가독성을 맞춘다.
    # (현재 구현은 dict 정확 매칭이라 실제 동작은 순서와 무관)
    "DOOSAN": "DOOSAN",
    "두산베어스": "DOOSAN",
    "두산": "DOOSAN",
    "HANWHA": "HANWHA",
    "한화이글스": "HANWHA",
    "한화": "HANWHA",
    "KIA": "KIA",
    "KIA타이거즈": "KIA",
    "기아타이거즈": "KIA",
    "기아": "KIA",
    "KIWOOM": "KIWOOM",
    "키움히어로즈": "KIWOOM",
    "키움": "KIWOOM",
    "KT": "KT",
    "KT위즈": "KT",
    "LG": "LG",
    "LG트윈스": "LG",
    "LOTTE": "LOTTE",
    "롯데자이언츠": "LOTTE",
    "롯데": "LOTTE",
    "NC": "NC",
    "NC다이노스": "NC",
    "SAMSUNG": "SAMSUNG",
    "삼성라이온즈": "SAMSUNG",
    "삼성": "SAMSUNG",
    "SSG": "SSG",
    "SSG랜더스": "SSG",
}


def _strip_html(text: str) -> str:
    return TAG_RE.sub("", text or "").strip()


def _extract_teams(play_html: str) -> tuple[str, str]:
    soup = BeautifulSoup(play_html or "", "lxml")
    spans = [s.get_text(strip=True) for s in soup.find_all("span")]
    spans = [s for s in spans if s and s.lower() != "vs"]
    if len(spans) >= 2:
        return spans[0], spans[-1]
    plain = _strip_html(play_html)
    if "vs" in plain:
        left, right = plain.split("vs", 1)
        return left.strip(), right.strip()
    return "", ""


def normalize_team_id(team_name: str) -> str:
    text = (team_name or "").strip()
    if not text:
        return ""
    key = text.upper().replace(" ", "")
    return TEAM_ID_MAP.get(text) or TEAM_ID_MAP.get(key, "")


def _build_game_id(
    game_start_at: datetime, away_team: str, home_team: str, stadium_id: str
) -> int:
    key = f"{game_start_at:%Y%m%d%H%M}|{away_team}|{home_team}|{stadium_id}"
    # signed BIGINT 범위(63-bit) 안에서 안정적인 식별자를 만든다.
    return int(hashlib.sha1(key.encode("utf-8")).hexdigest()[:15], 16)


def normalize_stadium_id(stadium: str) -> str:
    text = (stadium or "").strip()
    if not text:
        return "UNKNOWN"
    text = text.replace(" ", "")
    if "(" in text:
        text = text.split("(", 1)[0]
    mapping = {
        # common aliases from schedule responses
        "창원": "CHANGWON",
        "대구": "DAEGU",
        "대전": "DAEJEON",
        "고척": "GOCHEOCK",
        "광주": "GWANGJU",
        "문학": "INCHEON",
        "인천": "INCHEON",
        "사직": "SAJIK",
        "잠실": "SEOUL",
        "서울": "SEOUL",
        "수원": "SUWON",
    }
    return mapping.get(text, text[:10].upper())


def parse_schedule_page(data: dict, season_id: int, fallback_month: str) -> list[dict]:
    # 일정이 없는 달은 KBO 응답이 {"rows": []} 형태로 온다.
    # 이 경우 아래 루프가 실행되지 않고 빈 리스트를 반환한다.
    rows = data.get("rows", [])
    items: list[dict] = []
    current_month = int(fallback_month)
    current_day = None

    for row_wrap in rows:
        cells = row_wrap.get("row", [])
        day_text = None
        time_text = None
        play_html = None
        stadium_text = ""

        extras: list[str] = []
        for cell in cells:
            cls = cell.get("Class")
            text = (cell.get("Text") or "").strip()
            if cls == "day":
                day_text = text
            elif cls == "time":
                time_text = text
            elif cls == "play":
                play_html = text
            elif cls in ("relay",):
                continue
            else:
                plain = _strip_html(text)
                if plain and plain != "-":
                    extras.append(plain)

        if day_text:
            m = DAY_RE.search(day_text)
            if m:
                current_month = int(m.group(1))
                current_day = int(m.group(2))

        if current_day is None or not time_text or not play_html:
            continue

        t = TIME_RE.search(_strip_html(time_text))
        if not t:
            continue

        hour = int(t.group(1))
        minute = int(t.group(2))
        game_start_at = datetime(season_id, current_month, current_day, hour, minute)
        ticket_open_at = (game_start_at - timedelta(days=7)).strftime("%Y-%m-%d")

        away_team_raw, home_team_raw = _extract_teams(play_html)
        away_team = normalize_team_id(away_team_raw)
        home_team = normalize_team_id(home_team_raw)
        # teams 테이블의 team_id로 저장하기 위해 매핑 실패 행은 건너뛴다.
        if not away_team or not home_team:
            continue

        if extras:
            stadium_text = extras[-1]
        stadium_id = normalize_stadium_id(stadium_text)

        items.append(
            {
                # gameId는 Mongo staging(games_items_stg)에서 upsert 키로만 사용한다.
                # MariaDB games.game_id는 AUTO_INCREMENT PK라 별개로 관리된다.
                "gameId": _build_game_id(
                    game_start_at, away_team, home_team, stadium_id
                ),
                "gameStartAt": game_start_at,
                "gameStatus": "SCHEDULED",
                # 요구사항: max_seats는 항상 19200
                "maxSeats": 19200,
                "ticketOpenAt": ticket_open_at,
                "awayTeam": away_team,
                "homeTeam": home_team,
                "stadiumId": stadium_id,
            }
        )

    return items
