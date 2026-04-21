# app/slack_notifier.py
import json
import signal

import requests
from confluent_kafka import KafkaError

from .kafka_client import make_consumer
from .config import KAFKA_TOPIC_CRAWL_EXPORTED, SLACK_WEBHOOK_URL

CONSUMER_GROUP_ID = "hp-slack-notifier-group"

shutdown_flag = False


def handle_signal(signum, frame):
    global shutdown_flag
    print(f"\n[slack_notifier] 종료 요청 (signal={signum}).")
    shutdown_flag = True


signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)


def format_price_change(event: dict) -> str:
    old_price = event.get("old_price", 0)
    new_price = event.get("new_price", 0)
    diff = new_price - old_price
    arrow = "▲" if diff > 0 else "▼"
    emoji = "📈" if diff > 0 else "💰"
    return (
        f"{emoji} *가격 변동 알림*\n"
        f"구단: {event.get('team_id', '-')}\n"
        f"상품: {event.get('product_name', '-')}\n"
        f"변동: {old_price:,}원 → {new_price:,}원 ({arrow}{abs(diff):,}원)\n"
        f"URL: {event.get('product_url', '-')}"
    )


def send_slack(text: str) -> bool:
    """
    SLACK_WEBHOOK_URL이 없으면 로그만 출력하고 True를 반환한다.
    로컬 개발 시 슬랙 없이도 동작하도록 하기 위해서다.
    """
    if not SLACK_WEBHOOK_URL:
        print(f"[slack_notifier] (웹훅 없음, 로그 출력)\n{text}")
        return True

    try:
        resp = requests.post(SLACK_WEBHOOK_URL, json={"text": text}, timeout=10)
        if resp.status_code == 200:
            return True
        print(f"[slack_notifier] 웹훅 오류: {resp.status_code} {resp.text}")
        return False
    except Exception as e:
        print(f"[slack_notifier] 웹훅 전송 실패: {e}")
        return False


def run():
    """
    Slack 알림 Consumer 메인 루프.

    key=str(product_id) 덕분에 replicas를 늘려도 순서가 보장된다.
    같은 상품의 이벤트는 항상 같은 Partition → 같은 Consumer 인스턴스가 처리.
    최대 Partition 수(10개)까지 scale-out 가능하다.
    """
    consumer = make_consumer(CONSUMER_GROUP_ID)
    consumer.subscribe([KAFKA_TOPIC_CRAWL_EXPORTED])
    print(f"[slack_notifier] 시작 (group={CONSUMER_GROUP_ID})")

    try:
        while not shutdown_flag:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                print(f"[slack_notifier] Kafka 에러: {msg.error()}")
                continue

            try:
                event = json.loads(msg.value().decode("utf-8"))
            except Exception as e:
                print(f"[slack_notifier] 파싱 실패 (skip): {e}")
                consumer.commit(asynchronous=False)
                continue

            if event.get("type") == "PRICE_CHANGE":
                text = format_price_change(event)
                if not send_slack(text):
                    # 슬랙 전송 실패 시 commit하지 않고 재처리
                    # 주의: 슬랙이 장기간 다운되면 같은 메시지를 계속 재시도한다.
                    # 운영에서는 재시도 횟수 제한 + DLQ(Dead Letter Queue) 도입 권장.
                    continue
            else:
                print(f"[slack_notifier] 알 수 없는 type: {event.get('type')} (skip)")

            consumer.commit(asynchronous=False)

    finally:
        consumer.close()
        print("[slack_notifier] 정상 종료")


if __name__ == "__main__":
    run()
