from datetime import datetime

from app.sources.kbo_games.parser import (
    parse_schedule_page,
    normalize_stadium_id,
    normalize_team_id,
)


class TestKboGamesParser:
    def test_행_파싱_및_7일전_티켓오픈일_계산(self):
        data = {
            "rows": [
                {
                    "row": [
                        {"Text": "03.12(목)", "Class": "day"},
                        {"Text": "<b>13:00</b>", "Class": "time"},
                        {
                            "Text": "<span>LG</span><em><span>vs</span></em><span>NC</span>",
                            "Class": "play",
                        },
                        {"Text": "", "Class": "relay"},
                        {"Text": "창원", "Class": None},
                        {"Text": "-", "Class": None},
                    ]
                }
            ]
        }

        items = parse_schedule_page(data, season_id=2026, fallback_month="03")
        assert len(items) == 1
        assert items[0]["gameStartAt"] == datetime(2026, 3, 12, 13, 0)
        assert items[0]["ticketOpenAt"] == "2026-03-05"
        assert items[0]["awayTeam"] == "LG"
        assert items[0]["homeTeam"] == "NC"
        assert items[0]["stadiumId"] == "CHANGWON"

    def test_day_셀_생략된_행은_이전_날짜_재사용(self):
        data = {
            "rows": [
                {
                    "row": [
                        {"Text": "03.12(목)", "Class": "day"},
                        {"Text": "<b>13:00</b>", "Class": "time"},
                        {
                            "Text": "<span>LG</span><em><span>vs</span></em><span>NC</span>",
                            "Class": "play",
                        },
                        {"Text": "마산", "Class": None},
                    ]
                },
                {
                    "row": [
                        {"Text": "<b>18:00</b>", "Class": "time"},
                        {
                            "Text": "<span>키움</span><em><span>vs</span></em><span>두산</span>",
                            "Class": "play",
                        },
                        {"Text": "잠실", "Class": None},
                    ]
                },
            ]
        }

        items = parse_schedule_page(data, season_id=2026, fallback_month="03")
        assert len(items) == 2
        assert items[1]["gameStartAt"] == datetime(2026, 3, 12, 18, 0)
        assert items[1]["awayTeam"] == "KIWOOM"
        assert items[1]["homeTeam"] == "DOOSAN"
        assert items[1]["stadiumId"] == "SEOUL"

    def test_stadium_id_정규화(self):
        assert normalize_stadium_id("창원") == "CHANGWON"
        assert normalize_stadium_id("문학") == "INCHEON"
        assert normalize_stadium_id("잠실 ") == "SEOUL"

    def test_team_id_정규화(self):
        assert normalize_team_id("한화") == "HANWHA"
        assert normalize_team_id("KIA타이거즈") == "KIA"
        assert normalize_team_id("롯데자이언츠") == "LOTTE"
