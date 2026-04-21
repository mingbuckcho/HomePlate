# app/exporter.py
import json
import signal
import time
from datetime import datetime, timezone

from confluent_kafka import KafkaError

from .mongo_client import get_db, utc_now
from .mariadb_client import get_conn
from .minio_client import upload_thumbnail
from .kafka_client import make_consumer
from .config import KAFKA_TOPIC_CRAWL_RESULT

BATCH_SIZE = 100

# Consumer Group ID.
# 같은 group_id를 가진 Consumer들이 Partition을 나눠서 처리한다.
# replicas=2로 늘리면 두 파드가 각각 다른 Partition을 담당한다.
CONSUMER_GROUP_ID = "hp-exporter-group"

TEAM_KEYWORDS: list[tuple[str, str]] = [
    ("기아-타이거즈", "KIA"),
    ("기아타이거즈", "KIA"),
    ("기아", "KIA"),
    ("삼성-라이온즈", "SAMSUNG"),
    ("삼성라이온즈", "SAMSUNG"),
    ("삼성", "SAMSUNG"),
    ("lg-트윈스", "LG"),
    ("lg트윈스", "LG"),
    ("두산-베어스", "DOOSAN"),
    ("두산베어스", "DOOSAN"),
    ("두산", "DOOSAN"),
    ("kt-위즈", "KT"),
    ("kt위즈", "KT"),
    ("ssg-랜더스", "SSG"),
    ("ssg랜더스", "SSG"),
    ("롯데-자이언츠", "LOTTE"),
    ("롯데자이언츠", "LOTTE"),
    ("롯데", "LOTTE"),
    ("한화-이글스", "HANWHA"),
    ("한화이글스", "HANWHA"),
    ("한화", "HANWHA"),
    ("nc-다이노스", "NC"),
    ("nc다이노스", "NC"),
    ("키움-히어로즈", "KIWOOM"),
    ("키움히어로즈", "KIWOOM"),
    ("키움", "KIWOOM"),
]


def infer_team_id(category_url: str, goods_name: str) -> str | None:
    text = (category_url + " " + goods_name).lower()
    for keyword, team_id in TEAM_KEYWORDS:
        if keyword.lower() in text:
            return team_id
    return None


def get_watermark(db, name: str) -> datetime:
    doc = db.etl_state.find_one({"name": name})
    if doc and doc.get("watermark"):
        return doc["watermark"]
    return datetime(1970, 1, 1, tzinfo=timezone.utc)


def set_watermark(db, name: str, ts: datetime):
    db.etl_state.update_one(
        {"name": name},
        {"$set": {"watermark": ts, "updatedAt": utc_now()}},
        upsert=True,
    )


def export_news(db, conn) -> int:
    """뉴스 적재. 기존 로직 그대로."""
    wm = get_watermark(db, "news_exporter")
    rows = list(
        db.news_items_stg.find(
            {"updatedAt": {"$gt": wm}}, sort=[("updatedAt", 1)]
        ).limit(BATCH_SIZE)
    )
    if not rows:
        return 0

    with conn.cursor() as cur:
        for r in rows:
            thumbnail_path = upload_thumbnail(
                r.get("thumbnailUrl") or "", prefix="naver_news", source="naver"
            )
            cur.execute(
                """
                INSERT INTO news (news_title, news_url, news_thumbnail, news_press, published_at, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE
                    news_title=VALUES(news_title), news_thumbnail=VALUES(news_thumbnail),
                    news_press=VALUES(news_press), published_at=VALUES(published_at)
                """,
                (
                    r.get("title", ""),
                    r.get("url", ""),
                    thumbnail_path,
                    r.get("sourceName"),
                    r.get("publishedAt"),
                ),
            )
        conn.commit()

    set_watermark(db, "news_exporter", rows[-1]["updatedAt"])
    return len(rows)


def export_goods(db, conn) -> int:
    """
    굿즈 적재 — Outbox 패턴 적용.

    왜 Outbox 패턴이 필요한가:
        단순하게 생각하면 goods upsert 후 Kafka produce를 하면 될 것 같다.
        하지만 이렇게 하면 두 가지 문제가 생긴다.

        문제 1: "적재는 됐는데 이벤트 없음"
            goods upsert 성공 → Kafka produce 실패 → 슬랙 알림 없음
        문제 2: "이벤트는 있는데 적재 안 됨"
            Kafka produce 성공 → MariaDB commit 실패 → 슬랙은 울렸는데 DB에는 없음

        Outbox 패턴은 이렇게 해결한다:
            goods upsert + outbox INSERT를 하나의 트랜잭션으로 묶는다.
            둘 다 성공하거나 둘 다 실패한다 (원자성).
            Outbox Relay가 별도로 outbox를 읽어서 Kafka에 produce한다.
            이렇게 하면 "적재는 됐는데 이벤트 없음" 케이스가 원천 차단된다.

    FOR UPDATE를 쓰는 이유:
        Exporter를 replicas=2로 늘리면 두 파드가 같은 product_url을
        동시에 처리할 수 있다.
        SELECT ... FOR UPDATE로 행 락을 걸면 한 파드가 처리하는 동안
        다른 파드는 락이 풀릴 때까지 대기한다.
        이렇게 하면 두 파드가 동시에 가격변동을 감지해서 outbox에 두 번
        INSERT하는 상황을 막는다.

    product_id를 Kafka key로 쓰는 이유:
        같은 key의 메시지는 항상 같은 Partition으로 간다.
        같은 Partition은 같은 Consumer가 처리한다.
        즉, 같은 상품의 가격변동 이벤트는 순서대로 처리된다.
        product_url이 아닌 product_id(내부 PK)를 쓰는 이유:
            URL은 외부 사이트 정책에 따라 바뀔 수 있다.
            PK는 INSERT 시 부여되고 절대 바뀌지 않는다.
    """
    wm = get_watermark(db, "goods_exporter")
    rows = list(
        db.goods_items_stg.find(
            {"updatedAt": {"$gt": wm}}, sort=[("updatedAt", 1)]
        ).limit(BATCH_SIZE)
    )
    if not rows:
        return 0

    with conn.cursor() as cur:
        for r in rows:
            team_id = infer_team_id(r.get("sourceCategoryUrl", ""), r.get("title", ""))
            if team_id is None:
                continue

            thumbnail_path = upload_thumbnail(
                r.get("thumbnailUrl") or "",
                prefix="kbomarket_goods",
                source="kbomarket",
            )
            product_url = r.get("productUrl", "")
            new_price = r.get("priceWon")

            try:
                conn.begin()

                # 1단계: 현재 가격 조회 + 행 락 획득
                # FOR UPDATE: 이 행을 다른 트랜잭션이 수정하지 못하도록 락을 건다.
                # 트랜잭션이 끝나면(commit/rollback) 자동으로 락이 풀린다.
                cur.execute(
                    "SELECT goods_id, goods_price FROM goods WHERE goods_url = %s FOR UPDATE",
                    (product_url,),
                )
                existing = cur.fetchone()
                old_price = existing["goods_price"] if existing else None

                # 2단계: goods upsert
                cur.execute(
                    """
                    INSERT INTO goods (team_id, goods_name, goods_price, goods_thumbnail, goods_url, created_at)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                    ON DUPLICATE KEY UPDATE
                        team_id=VALUES(team_id), goods_name=VALUES(goods_name),
                        goods_price=VALUES(goods_price), goods_thumbnail=VALUES(goods_thumbnail)
                    """,
                    (
                        team_id,
                        r.get("title", ""),
                        new_price,
                        thumbnail_path,
                        product_url,
                    ),
                )

                # upsert 후 product_id 확보
                # INSERT면 lastrowid, UPDATE면 기존 goods_id 사용
                product_id = existing["goods_id"] if existing else cur.lastrowid

                # 3단계: 가격변동이면 outbox INSERT
                # old_price가 None이면 신규 상품 → 알림 불필요
                if (
                    old_price is not None
                    and new_price is not None
                    and int(old_price) != int(new_price)
                ):
                    cur.execute(
                        "INSERT INTO goods_outbox (event_type, product_id, payload) VALUES (%s, %s, %s)",
                        (
                            "PRICE_CHANGE",
                            product_id,
                            json.dumps(
                                {
                                    "product_id": product_id,
                                    "product_url": product_url,
                                    "product_name": r.get("title", ""),
                                    "team_id": team_id,
                                    "old_price": int(old_price),
                                    "new_price": int(new_price),
                                },
                                ensure_ascii=False,
                            ),
                        ),
                    )

                # 4단계: goods upsert + outbox INSERT 원자적 완료
                conn.commit()

            except Exception:
                conn.rollback()
                raise

    set_watermark(db, "goods_exporter", rows[-1]["updatedAt"])
    return len(rows)


def export_games(db, conn) -> int:
    """경기 일정 적재. 기존 로직 그대로."""
    wm = get_watermark(db, "games_exporter")
    rows = list(
        db.games_items_stg.find(
            {"updatedAt": {"$gt": wm}}, sort=[("updatedAt", 1)]
        ).limit(BATCH_SIZE)
    )
    if not rows:
        return 0

    with conn.cursor() as cur:
        for r in rows:
            cur.execute(
                """
                INSERT INTO games
                    (game_start_at, game_status, max_seats, ticket_open_at, away_team, home_team, stadium_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    game_start_at=VALUES(game_start_at), game_status=VALUES(game_status),
                    max_seats=VALUES(max_seats), ticket_open_at=VALUES(ticket_open_at),
                    away_team=VALUES(away_team), home_team=VALUES(home_team), stadium_id=VALUES(stadium_id)
                """,
                (
                    r.get("gameStartAt"),
                    r.get("gameStatus"),
                    r.get("maxSeats") or 19200,
                    r.get("ticketOpenAt"),
                    r.get("awayTeam"),
                    r.get("homeTeam"),
                    r.get("stadiumId"),
                ),
            )
        conn.commit()

    set_watermark(db, "games_exporter", rows[-1]["updatedAt"])
    return len(rows)


# ── Kafka Consumer 루프 ────────────────────────────────────────────────
shutdown_flag = False


def handle_signal(signum, frame):
    global shutdown_flag
    print(f"\n[exporter] 종료 요청 (signal={signum}). 현재 처리 완료 후 종료합니다...")
    shutdown_flag = True


signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)


def run():
    """
    Exporter 메인 루프.

    기존 CronJob 방식과의 차이:
        CronJob: 5분마다 컨테이너가 시작 → 적재 → 종료를 반복
        Consumer: 항상 실행 중이고 Kafka 메시지를 받을 때마다 즉시 적재

    at-least-once 보장 순서가 중요하다:
        (올바른 순서) MariaDB commit → Kafka offset commit
        (잘못된 순서) Kafka offset commit → MariaDB commit 실패
                      → 메시지는 처리된 것으로 표시됐는데 실제 적재는 안 된 상태
        MariaDB commit이 성공한 후에만 Kafka offset을 commit해야
        실패 시 재처리가 보장된다.
    """
    db = get_db()
    consumer = make_consumer(CONSUMER_GROUP_ID)
    consumer.subscribe([KAFKA_TOPIC_CRAWL_RESULT])
    print(f"[exporter] 시작 (group={CONSUMER_GROUP_ID})")

    try:
        while not shutdown_flag:
            # timeout=1.0: 1초 동안 메시지를 기다린다.
            # 메시지가 없으면 None을 반환하고 루프를 다시 돈다.
            msg = consumer.poll(timeout=1.0)

            if msg is None:
                continue

            if msg.error():
                # _PARTITION_EOF: 파티션 끝에 도달. 새 메시지가 올 때까지 대기. 정상.
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                print(f"[exporter] Kafka 에러: {msg.error()}")
                continue

            try:
                event = json.loads(msg.value().decode("utf-8"))
            except Exception as e:
                print(f"[exporter] 메시지 파싱 실패 (skip): {e}")
                consumer.commit(asynchronous=False)
                continue

            job_type = event.get("job_type", "")
            print(f"[exporter] 메시지 수신: {job_type} ({event.get('item_count')}건)")

            conn = get_conn()
            try:
                if job_type == "CRAWL_NAVER_NEWS":
                    n = export_news(db, conn)
                elif job_type == "CRAWL_KBOMARKET_GOODS":
                    n = export_goods(db, conn)
                elif job_type == "CRAWL_KBO_GAMES":
                    n = export_games(db, conn)
                else:
                    print(f"[exporter] 알 수 없는 job_type: {job_type} (skip)")
                    consumer.commit(asynchronous=False)
                    conn.close()
                    continue

                print(f"[exporter] {job_type} {n}건 적재 완료")

            except Exception as e:
                print(f"[exporter] 적재 실패: {e}")
                # commit하지 않으면 다음 poll 시 같은 메시지를 다시 받아 재처리한다
                conn.close()
                continue
            finally:
                conn.close()

            # MariaDB commit 성공 후에만 Kafka offset commit
            consumer.commit(asynchronous=False)

    finally:
        consumer.close()
        print("[exporter] 정상 종료")


if __name__ == "__main__":
    run()
