from bs4 import BeautifulSoup

from ..kbo_games.parser import normalize_team_id


def parse_team_rank_page(html: str) -> tuple[str, list[dict]]:
    """
    KBO 팀 순위 HTML을 파싱한다.

    Returns:
        (date_str, rows)
        date_str: "2025-10-04" 형식
        rows: 팀별 순위 데이터 리스트
    """
    soup = BeautifulSoup(html, "lxml")

    # 기준 날짜 추출 (예: "2025.10.04" → "2025-10-04")
    date_span = soup.find(
        id="cphContents_cphContents_cphContents_lblSearchDateTitle"
    )
    date_str = ""
    if date_span:
        date_str = date_span.get_text(strip=True).replace(".", "-")

    # 순위 테이블: summary 속성으로 식별
    table = soup.find(
        "table",
        attrs={"summary": lambda s: s and "순위" in s and "팀명" in s},
    )
    if not table:
        return date_str, []

    rows = []
    for tr in table.select("tbody tr"):
        tds = [td.get_text(strip=True) for td in tr.find_all("td")]
        if len(tds) < 12:
            continue

        try:
            games_behind = float(tds[7])
        except ValueError:
            games_behind = 0.0

        team_raw = tds[1]
        rows.append(
            {
                "rank": int(tds[0]),
                "teamId": normalize_team_id(team_raw) or team_raw,
                "games": int(tds[2]),
                "wins": int(tds[3]),
                "losses": int(tds[4]),
                "draws": int(tds[5]),
                "winRate": float(tds[6]),
                "gamesBehind": games_behind,
                "last10": tds[8],
                "streak": tds[9],
                "home": tds[10],
                "away": tds[11],
            }
        )

    return date_str, rows
