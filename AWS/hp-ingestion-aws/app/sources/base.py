from abc import ABC, abstractmethod
from ..mongo_client import utc_now


class BaseCrawler(ABC):
    """
    모든 크롤러의 공통 인터페이스를 정의하는 추상 클래스.

    ABC(Abstract Base Class):
        이 클래스를 상속받으면 run()을 반드시 구현해야 한다.
        구현하지 않으면 인스턴스 생성 시 TypeError가 발생한다.
        이렇게 하면 새 크롤러를 추가할 때 run()을 빠뜨리는 실수를 방지한다.

    설계 원칙 (OCP: 개방-폐쇄 원칙):
        확장에는 열려있다: 새 크롤러를 추가할 때 CRAWLER_MAP에만 한 줄 추가
        수정에는 닫혀있다: worker.py의 실행 로직을 수정할 필요 없음

    이벤트 로깅 전략:
        crawl_sources.stats 대신 events 컬렉션을 사용한다.
        이유:
            crawl_sources는 "설정 문서"다.
            설정(minDelaySec 등)과 운영 데이터(lastRunAt 등)를 섞으면
            역할이 불명확해지고 문서가 점점 커진다.
            events는 이미 TTL 인덱스가 있어서 자동 정리된다.
            집계 쿼리(aggregation)로 언제든지 통계를 낼 수 있다.

        예: 최근 7일간 소스별 수집 건수 조회
            db.events.aggregate([
              {$match: {
                level: "INFO",
                createdAt: {$gt: new Date(Date.now() - 7*24*60*60*1000)}
              }},
              {$group: {_id: "$sourceType", total: {$sum: "$itemCount"}}}
            ])
    """

    def __init__(self, db, job: dict):
        # db: get_db()로 가져온 MongoDB 데이터베이스 핸들
        # job: acquire_job()이 반환한 잡 문서 (type, payload, _id 등 포함)
        self.db = db
        self.job = job

    @abstractmethod
    def run(self) -> int:
        """
        크롤링을 실행하고 수집된 건수를 반환한다.
        모든 하위 크롤러는 이 메서드를 반드시 구현해야 한다.
        """
        raise NotImplementedError

    def _load_source(self, source_type: str) -> dict:
        """
        crawl_sources에서 수집 정책을 읽어온다.

        반환값 예시:
            {
              "type": "KBOMARKET_GOODS",
              "enabled": True,
              "policy": {
                "minDelaySec": 1.5,
                "maxDelaySec": 3.0,
                "httpTimeoutSec": 20,
                "maxRetries": 3,
                "maxPagesPerRun": 50,
                "maxItemsPerRun": 500
              },
              "alert": {
                "consecutiveFailThreshold": 5
              }
            }

        enabled=False인 소스는 None이 반환되어 {}이 사용된다.
        이렇게 하면 DB에서 소스를 비활성화하는 것만으로
        해당 소스의 수집을 중단할 수 있다.
        """
        doc = self.db.crawl_sources.find_one({"type": source_type, "enabled": True})
        return doc or {}

    def _log_event(
        self,
        source_type: str,
        level: str,
        message: str,
        item_count: int = 0,
        job_id=None,
    ):
        """
        수집 결과를 events 컬렉션에 기록한다.

        Args:
            source_type: 수집 소스 식별자 (예: "NAVER_KBO_NEWS")
            level:       로그 레벨 ("INFO", "ERROR", "ALERT")
            message:     로그 메시지
            item_count:  수집 건수 (성공 시에만 의미 있음)
            job_id:      관련 잡의 MongoDB _id (선택)

        TTL 인덱스에 의해 30일 후 자동 삭제된다.

        itemCount를 events에 기록하는 이유:
            나중에 집계 쿼리로 통계를 낼 수 있다.
            예: 소스별 일별 수집 건수 차트
        """
        try:
            self.db.events.insert_one(
                {
                    "level": level,
                    "sourceType": source_type,
                    "jobId": job_id or self.job.get("_id"),
                    "message": message[:2000],  # 너무 긴 메시지는 자른다
                    "itemCount": item_count,
                    "createdAt": utc_now(),
                }
            )
        except Exception as e:
            # 로그 저장 실패는 수집을 멈출 만큼 치명적이지 않다
            print(f"[base] 이벤트 저장 실패: {e}")

    def _check_and_alert(self, source_type: str):
        """
        연속 실패 횟수가 임계값을 초과했는지 확인하고
        초과했으면 ALERT 이벤트를 기록한다.

        어떻게 연속 실패 횟수를 아는가:
            events 컬렉션에서 해당 소스의 최근 이벤트를 조회한다.
            최근 N개 이벤트에서 ERROR가 연속으로 나타나는 횟수를 센다.

        왜 crawl_sources에 저장하지 않는가:
            crawl_sources는 설정 문서다.
            운영 데이터(연속 실패 횟수)를 설정 문서에 넣으면
            역할이 불명확해진다.
            events에서 집계하는 방식이 더 깔끔하다.
        """
        source = self.db.crawl_sources.find_one({"type": source_type})
        if not source:
            return

        threshold = source.get("alert", {}).get("consecutiveFailThreshold", 5)

        # 최근 threshold개 이벤트를 가져와서 모두 ERROR인지 확인한다
        recent_events = list(
            self.db.events.find(
                {"sourceType": source_type, "level": {"$in": ["INFO", "ERROR"]}},
                sort=[("createdAt", -1)],
                limit=threshold,
            )
        )

        # threshold개가 쌓이지 않았으면 아직 판단하지 않는다
        if len(recent_events) < threshold:
            return

        # 최근 threshold개가 모두 ERROR이면 ALERT를 발생시킨다
        all_error = all(e["level"] == "ERROR" for e in recent_events)
        if all_error:
            alert_msg = (
                f"[ALERT] {source_type} 연속 {threshold}회 실패. "
                f"수집이 중단됐을 수 있습니다."
            )
            print(alert_msg)
            # TODO: 슬랙/이메일 알림 연동 포인트
            # 지금은 ALERT 레벨 이벤트로 기록하고
            # 모니터링 도구에서 ALERT 레벨을 감지해서 알림을 보낸다
            self._log_event(source_type, "ALERT", alert_msg)
