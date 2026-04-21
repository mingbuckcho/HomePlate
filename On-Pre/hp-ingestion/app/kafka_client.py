# app/kafka_client.py
import json
from confluent_kafka import Producer, Consumer, KafkaError
from .config import (
    KAFKA_BOOTSTRAP_SERVERS,
    KAFKA_SECURITY_PROTOCOL,
    KAFKA_SSL_CA_LOCATION,
    KAFKA_SSL_CERT_LOCATION,
    KAFKA_SSL_KEY_LOCATION,
)


def _ssl_config() -> dict:
    """
    KAFKA_SECURITY_PROTOCOL에 따라 SSL 설정을 반환한다.

    PLAINTEXT (로컬/docker-compose): 빈 dict → 기존 동작 유지
    SSL (K8s/Strimzi): 볼륨마운트된 인증서 경로를 librdkafka 옵션으로 전달
        ssl.ca.location        → Strimzi 클러스터 CA (브로커 인증서 검증)
        ssl.certificate.location → KafkaUser 클라이언트 인증서 (클라이언트 인증)
        ssl.key.location       → KafkaUser 클라이언트 private key
    """
    cfg: dict = {"security.protocol": KAFKA_SECURITY_PROTOCOL}
    if KAFKA_SECURITY_PROTOCOL == "SSL":
        if KAFKA_SSL_CA_LOCATION:
            cfg["ssl.ca.location"] = KAFKA_SSL_CA_LOCATION
        if KAFKA_SSL_CERT_LOCATION:
            cfg["ssl.certificate.location"] = KAFKA_SSL_CERT_LOCATION
        if KAFKA_SSL_KEY_LOCATION:
            cfg["ssl.key.location"] = KAFKA_SSL_KEY_LOCATION
    return cfg


def make_producer() -> Producer:
    """
    Kafka Producer를 생성한다.

    acks=all:
        메시지를 produce할 때 ISR(In-Sync Replica) 전체에 복제가 완료된
        후에야 "성공"으로 응답한다.
        리더 브로커가 죽어도 다른 replica에 이미 복제됐으므로 메시지를 잃지 않는다.
        acks=1(리더만)이나 acks=0(응답 없음)보다 느리지만 안전하다.

    enable.idempotence=True:
        네트워크 오류로 produce를 재시도할 때 중복 메시지를 방지한다.
        예) 브로커가 저장 후 응답하기 직전에 네트워크가 끊기면
            Producer는 실패로 알고 재시도한다.
            idempotence가 없으면 같은 메시지가 두 번 저장된다.
            idempotence가 있으면 브로커가 중복을 감지하고 한 번만 저장한다.
        acks=all이 설정돼 있어야 활성화할 수 있다.
    """
    return Producer(
        {
            "bootstrap.servers": KAFKA_BOOTSTRAP_SERVERS,
            "acks": "all",
            "enable.idempotence": True,
            **_ssl_config(),
        }
    )


def make_consumer(group_id: str) -> Consumer:
    """
    Kafka Consumer를 생성한다.

    group_id:
        같은 group_id를 가진 Consumer들은 하나의 Consumer Group을 형성한다.
        Kafka가 토픽의 Partition을 Consumer들에게 자동으로 분배한다.
        예) Partition 10개, Consumer 2개 → Consumer당 5개씩 담당
        이렇게 하면 Consumer를 늘리는 것만으로 처리량을 높일 수 있다 (scale-out).

    enable.auto.commit=False:
        메시지를 처리한 후 직접 commit()을 호출해야 오프셋이 저장된다.
        True로 하면 처리 도중 크래시 시 메시지를 잃을 수 있다.
        False로 하면 "처리 완료 후 commit" 패턴으로 at-least-once를 보장한다.
        at-least-once: 메시지를 한 번 이상 처리한다 (중복 가능, 유실 없음).

    auto.offset.reset=earliest:
        Consumer Group이 처음 시작할 때 또는 저장된 오프셋이 만료됐을 때
        토픽의 맨 처음부터 읽는다.
        latest로 하면 Consumer가 시작된 이후의 메시지만 읽는다.
        earliest가 더 안전하다 (메시지 유실 방지).

    max.poll.interval.ms=300000:
        poll() 호출 간격 최대 허용 시간. 5분.
        이 시간 안에 poll()을 호출하지 않으면 Kafka가 해당 Consumer를 죽었다고
        판단하고 다른 Consumer에게 Partition을 재할당(rebalance)한다.
        Exporter는 MariaDB 적재가 오래 걸릴 수 있으므로 넉넉하게 설정한다.
    """
    return Consumer(
        {
            "bootstrap.servers": KAFKA_BOOTSTRAP_SERVERS,
            "group.id": group_id,
            "enable.auto.commit": False,
            "auto.offset.reset": "earliest",
            "max.poll.interval.ms": 300000,
            **_ssl_config(),
        }
    )


def produce(producer: Producer, topic: str, value: dict, key: str | None = None):
    """
    메시지를 Kafka 토픽에 produce한다.

    key가 중요한 이유:
        Kafka는 같은 key를 가진 메시지를 항상 같은 Partition으로 보낸다.
        같은 Partition은 항상 같은 Consumer가 담당한다.
        따라서 key=str(product_id)로 설정하면,
        같은 상품의 가격변동 이벤트가 항상 같은 Consumer에서 순서대로 처리된다.
        key=None이면 Partition을 라운드로빈으로 선택해서 순서를 보장할 수 없다.

    on_delivery 콜백:
        produce()는 즉시 반환된다 (비동기).
        실제 전송 성공/실패는 나중에 poll() 또는 flush() 시점에 콜백으로 알 수 있다.
    """

    def _on_delivery(err, msg):
        if err:
            print(f"[kafka] produce 실패: topic={topic}, err={err}")
        else:
            print(
                f"[kafka] produce 성공: topic={msg.topic()}, "
                f"partition={msg.partition()}, offset={msg.offset()}"
            )

    producer.produce(
        topic=topic,
        key=key.encode("utf-8") if key else None,
        value=json.dumps(value, ensure_ascii=False).encode("utf-8"),
        on_delivery=_on_delivery,
    )


def flush(producer: Producer, timeout: float = 10.0):
    """
    버퍼에 남아 있는 메시지를 모두 브로커에 전송하고 완료를 기다린다.

    produce()는 비동기라서 호출 직후에는 메시지가 아직 전송 중일 수 있다.
    flush()를 호출해야 버퍼의 모든 메시지가 브로커에 도달했음이 보장된다.
    함수가 끝나기 전에 반드시 호출해야 메시지 유실이 없다.

    remaining > 0:
        timeout 안에 전송하지 못한 메시지가 있다는 뜻이다.
        운영에서는 알람을 띄우거나 재시도 로직을 추가해야 한다.
    """
    remaining = producer.flush(timeout=timeout)
    if remaining > 0:
        print(f"[kafka] flush 후 미전송 메시지: {remaining}개 (timeout={timeout}s)")
