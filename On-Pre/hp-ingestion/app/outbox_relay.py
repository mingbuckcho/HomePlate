# app/outbox_relay.py
"""
Outbox Relay: MariaDB outbox 테이블 polling → Kafka produce.

왜 Exporter가 직접 produce하지 않고 별도 프로세스를 두는가:
    Exporter가 goods upsert + Kafka produce를 같이 하면 이런 문제가 생긴다.
    - MariaDB commit 성공 + Kafka produce 실패 → 이벤트 유실
    - Kafka produce 성공 + MariaDB 이상 발생 → 유령 이벤트

    Outbox 패턴은 "적재"와 "이벤트 발행"을 분리한다.
    1. Exporter: goods upsert + outbox INSERT를 하나의 트랜잭션으로 처리
    2. Relay: outbox를 polling해서 Kafka produce
    outbox에 INSERT됐다는 건 goods도 확실히 저장됐다는 뜻이다.
    Relay는 outbox를 보고 produce하면 되니 실패해도 재처리하기 쉽다.
"""

import json
import signal
import time

from .mariadb_client import get_conn
from .kafka_client import make_producer, produce, flush
from .config import KAFKA_TOPIC_CRAWL_EXPORTED

RELAY_SLEEP_SEC = 3  # polling 간격 (초)
RELAY_BATCH_SIZE = 100  # 한 번에 처리할 최대 건수

shutdown_flag = False


def handle_signal(signum, frame):
    global shutdown_flag
    print(
        f"\n[outbox_relay] 종료 요청 (signal={signum}). 현재 배치 완료 후 종료합니다..."
    )
    shutdown_flag = True


signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)


def process_outbox(conn, producer) -> int:
    """
    outbox에서 미처리 이벤트를 가져와서 Kafka produce 후 processed=true로 업데이트.

    SELECT FOR UPDATE SKIP LOCKED:
        Relay를 replicas=2로 늘렸을 때 두 파드가 동시에 실행된다고 가정한다.
        FOR UPDATE: 선택한 행에 락을 건다
        SKIP LOCKED: 이미 다른 트랜잭션이 락을 건 행은 건너뛴다
        → 두 Relay가 절대 같은 outbox 행을 중복 처리하지 않는다.

    flush() 후 commit() 순서가 중요한 이유:
        produce()는 비동기라서 flush() 전까지는 메시지가 아직 브로커에 없다.
        flush() 전에 commit()하면 outbox는 processed=true인데 메시지는 아직 안 간 상태.
        이 순간 Relay가 죽으면 이벤트가 유실된다.
        flush() 후 commit()하면:
        - flush 성공 → commit 성공: 정상
        - flush 성공 → commit 실패: Relay 재시작 시 같은 행을 다시 produce (중복 가능, 허용)
        - flush 실패: commit하지 않으므로 outbox 행은 그대로 → 재처리
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, event_type, product_id, payload
            FROM goods_outbox
            WHERE processed = false
            ORDER BY created_at
            LIMIT %s
            FOR UPDATE SKIP LOCKED
            """,
            (RELAY_BATCH_SIZE,),
        )
        rows = cur.fetchall()

        if not rows:
            conn.rollback()
            return 0

        for row in rows:
            payload = json.loads(row["payload"])

            produce(
                producer,
                KAFKA_TOPIC_CRAWL_EXPORTED,
                {
                    "type": row["event_type"],
                    "product_id": row["product_id"],
                    "product_url": payload.get("product_url"),
                    "product_name": payload.get("product_name"),
                    "team_id": payload.get("team_id"),
                    "old_price": payload.get("old_price"),
                    "new_price": payload.get("new_price"),
                },
                # key=str(product_id): 같은 상품의 이벤트는 같은 Partition → 순서 보장
                key=str(row["product_id"]) if row["product_id"] else None,
            )

            cur.execute(
                "UPDATE goods_outbox SET processed = true, processed_at = NOW() WHERE id = %s",
                (row["id"],),
            )

        # flush 먼저: 모든 메시지가 브로커에 도달했음을 보장
        # commit 후: outbox를 processed=true로 확정
        flush(producer)
        conn.commit()

        return len(rows)


def run():
    producer = make_producer()
    print(f"[outbox_relay] 시작 (interval={RELAY_SLEEP_SEC}s)")

    while not shutdown_flag:
        conn = get_conn()
        try:
            conn.begin()
            n = process_outbox(conn, producer)
            if n > 0:
                print(f"[outbox_relay] {n}건 produce 완료")
        except Exception as e:
            print(f"[outbox_relay] 에러: {e}")
            try:
                conn.rollback()
            except Exception:
                pass
        finally:
            conn.close()

        if not shutdown_flag:
            time.sleep(RELAY_SLEEP_SEC)

    print("[outbox_relay] 정상 종료")


if __name__ == "__main__":
    run()
