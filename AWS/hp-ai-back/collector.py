"""Collector: Prometheus, Loki, Tempo 데이터 수집. Snapshot 생성 시 호출."""
import json
import logging
from datetime import datetime
from typing import Any
import httpx

from config import settings

logger = logging.getLogger(__name__)

COLLECT_TIMEOUT = 15.0


def _loki_headers() -> dict[str, str]:
    """LOKI_TENANT_ID가 설정되면 X-Scope-OrgID 헤더 반환, 없으면 빈 dict."""
    tid = (settings.loki_tenant_id or "").strip()
    if tid:
        return {"X-Scope-OrgID": tid}
    return {}


def _ts_ns(dt: datetime) -> int:
    return int(dt.timestamp() * 1_000_000_000)


def _ts_s(dt: datetime) -> int:
    return int(dt.timestamp())


def _scalar_from_result(res: list[Any]) -> float | None:
    """Prometheus instant result: first value from first series, or None."""
    if not res or not isinstance(res[0], dict):
        return None
    val = res[0].get("value")
    if isinstance(val, (list, tuple)) and len(val) >= 2:
        try:
            return float(val[1])
        except (TypeError, ValueError):
            return None
    return None


async def collect_prom(
    base_url: str,
    namespace: str,
    service: str,
    window_from: datetime,
    window_to: datetime,
) -> tuple[str, str | None, dict[str, Any]]:
    """Returns (prom_status, prom_error, prom_dict). stats: 단일값들, series: 시계열. stats/series 중 하나라도 있으면 ok."""
    if not base_url.strip():
        return "empty", None, {}
    ns = namespace or ""
    svc = service or ""
    base = base_url.rstrip("/")
    window_s = _ts_s(window_from)
    window_e = _ts_s(window_to)
    stats_named: list[dict[str, Any]] = []
    series_list: list[Any] = []

    def has_result(data: dict) -> list[Any]:
        if data.get("status") != "success" or "data" not in data:
            return []
        return data["data"].get("result") or []

    try:
        async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
            async def query(q: str) -> list[Any]:
                r = await client.get(f"{base}/api/v1/query", params={"query": q})
                r.raise_for_status()
                return has_result(r.json())

            async def query_range(q: str) -> list[Any]:
                r = await client.get(
                    f"{base}/api/v1/query_range",
                    params={"query": q, "start": window_s, "end": window_e, "step": "60"},
                )
                r.raise_for_status()
                return has_result(r.json())

            # (a) UP: service 우선, label_app fallback
            up_res: list[Any] = []
            for label_key in ("service", "label_app"):
                up_res = await query(f'sum(up{{namespace="{ns}", {label_key}="{svc}"}})')
                if up_res:
                    break
            stats_named.append({"name": "up", "value": _scalar_from_result(up_res)})

            # (b) Ready Pods (label_app 사용; kube_pod_labels 보통 label_app)
            ready_q = f'sum(kube_pod_status_ready{{namespace="{ns}", condition="true"}} * on(namespace,pod) group_left(label_app) kube_pod_labels{{namespace="{ns}", label_app="{svc}"}})'
            ready_res = await query(ready_q)
            stats_named.append({"name": "ready_pods", "value": _scalar_from_result(ready_res)})

            # (c) NotReady (or vector(0))
            notready_q = f'sum(kube_pod_status_ready{{namespace="{ns}", condition="false"}} * on(namespace,pod) group_left(label_app) kube_pod_labels{{namespace="{ns}", label_app="{svc}"}}) or vector(0)'
            notready_res = await query(notready_q)
            stats_named.append({"name": "not_ready", "value": _scalar_from_result(notready_res)})

            # (d) Restarts 30m (서비스 기준: label_app join)
            restarts_q = f'sum(increase(kube_pod_container_status_restarts_total{{namespace="{ns}"}}[30m]) * on(namespace, pod) group_left(label_app) kube_pod_labels{{namespace="{ns}", label_app="{svc}"}}) or vector(0)'
            restarts_res = await query(restarts_q)
            stats_named.append({"name": "restarts_30m", "value": _scalar_from_result(restarts_res)})

            # (d2) Deployment replicas (label_app=service 기준, 해당 deployment만; 없으면 stat 미추가)
            desired_q = f'sum(kube_deployment_spec_replicas{{namespace="{ns}"}} * on(namespace, deployment) group_left(label_app) kube_deployment_labels{{namespace="{ns}", label_app="{svc}"}})'
            available_q = f'sum(kube_deployment_status_replicas_available{{namespace="{ns}"}} * on(namespace, deployment) group_left(label_app) kube_deployment_labels{{namespace="{ns}", label_app="{svc}"}})'
            desired_res = await query(desired_q)
            available_res = await query(available_q)
            desired_val = _scalar_from_result(desired_res)
            available_val = _scalar_from_result(available_res)
            if desired_val is not None:
                stats_named.append({"name": "deployment_desired", "value": desired_val})
            if available_val is not None:
                stats_named.append({"name": "deployment_available", "value": available_val})

            # (e) CPU series (서비스 기준: label_app join, 해당 서비스 파드만)
            cpu_q = f'sum(rate(container_cpu_usage_seconds_total{{namespace="{ns}", container!="", image!=""}}[5m]) * on(namespace, pod) group_left(label_app) kube_pod_labels{{namespace="{ns}", label_app="{svc}"}})'
            cpu_series = await query_range(cpu_q)
            if cpu_series:
                for s in cpu_series:
                    s["_metric_name"] = "cpu"
                series_list.extend(cpu_series)

            # (f) Memory series (서비스 기준: label_app join)
            mem_q = f'sum(container_memory_working_set_bytes{{namespace="{ns}", container!="", image!=""}} * on(namespace, pod) group_left(label_app) kube_pod_labels{{namespace="{ns}", label_app="{svc}"}})'
            mem_res = await query_range(mem_q)
            if mem_res:
                for s in mem_res:
                    s["_metric_name"] = "memory"
                series_list.extend(mem_res)
    except httpx.HTTPStatusError as e:
        return "error", f"HTTP {e.response.status_code}", {}
    except (httpx.RequestError, Exception) as e:
        return "error", str(e)[:200], {}

    has_stats = any(s.get("value") is not None for s in stats_named)
    if not has_stats and not series_list:
        return "empty", None, {"stats": stats_named, "series": series_list}
    return "ok", None, {"stats": stats_named, "series": series_list}


def _loki_log_query(base: str, query: str, params: dict[str, Any]) -> None:
    """Loki 요청 URL과 셀렉터를 한 줄 로그."""
    url = f"{base}/loki/api/v1/query_range"
    logger.info("Loki request: %s query=%s", url, params.get("query", query))


async def collect_loki(
    base_url: str,
    namespace: str,
    service: str,
    window_from: datetime,
    window_to: datetime,
) -> tuple[str, str | None, dict[str, Any]]:
    """namespace/service_name 우선, 없으면 app/namespace fallback. error/warn 우선, 0개면 전체 최근 50줄."""
    if not base_url.strip():
        return "empty", None, {}
    ns = namespace or ""
    svc = service or ""
    start_ns = _ts_ns(window_from)
    end_ns = _ts_ns(window_to)
    base = base_url.rstrip("/")
    limit = 50
    loki_headers = _loki_headers()

    async def run_query(client: httpx.AsyncClient, query: str) -> tuple[bool, list[dict[str, Any]]]:
        params = {"query": query, "start": start_ns, "end": end_ns, "limit": limit}
        _loki_log_query(base, query, params)
        r = await client.get(f"{base}/loki/api/v1/query_range", params=params, headers=loki_headers)
        r.raise_for_status()
        data = r.json()
        streams = data.get("data", {}).get("result") or []
        logs: list[dict[str, Any]] = []
        for s in streams:
            for e in s.get("values", []):
                if len(e) >= 2:
                    logs.append({"ts": e[0], "line": e[1]})
        return bool(logs), logs

    # 셀렉터 후보: 1) namespace + service_name, 2) namespace + app (fallback)
    selectors = [
        f'{{namespace="{ns}", service_name="{svc}"}}',
        f'{{namespace="{ns}", app="{svc}"}}' if svc else "",
    ]
    selectors = [s for s in selectors if s]

    async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
        # 1) error/warn 우선 (첫 번째 셀렉터)
        if selectors:
            query_err = f'{selectors[0]} | json | level=~"(?i)error|warn"'
            try:
                has_logs, logs = await run_query(client, query_err)
                if has_logs:
                    return "ok", None, {"recent_logs": logs[:limit]}
            except (httpx.HTTPStatusError, httpx.RequestError, Exception):
                pass

        # 2) selector만 (순서대로 시도: service_name → app fallback)
        for sel in selectors:
            try:
                has_logs, logs = await run_query(client, sel)
                if has_logs:
                    return "ok", None, {"recent_logs": logs[:limit]}
            except (httpx.HTTPStatusError, httpx.RequestError, Exception):
                continue

        # 3) 마지막 fallback: namespace만
        if ns:
            try:
                fallback_sel = f'{{namespace="{ns}"}}'
                has_logs, logs = await run_query(client, fallback_sel)
                if has_logs:
                    return "ok", None, {"recent_logs": logs[:limit]}
                return "empty", None, {"recent_logs": []}
            except httpx.HTTPStatusError as e:
                return "error", f"HTTP {e.response.status_code}", {}
            except (httpx.RequestError, Exception) as e:
                return "error", str(e)[:200], {}
        return "empty", None, {"recent_logs": []}


async def collect_tempo(
    base_url: str,
    service: str,
    window_from: datetime,
    window_to: datetime,
) -> tuple[str, str | None, dict[str, Any]]:
    """service.name으로 최근 traces 20개. 실패/애매하면 empty, 에러 메시지 없음."""
    if not base_url.strip() or not (service or "").strip():
        return "empty", None, {}
    base = base_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
            r = await client.get(
                f"{base}/api/search",
                params={
                    "tags": f"service.name={service}",
                    "start": _ts_s(window_from),
                    "end": _ts_s(window_to),
                    "limit": 20,
                },
            )
            r.raise_for_status()
            data = r.json()
            traces = data.get("traces") or []
            if not traces:
                return "empty", None, {"traces": []}
            return "ok", None, {"traces": traces[:20]}
    except Exception:
        return "empty", None, {"traces": []}


async def run_collector(
    prom_url: str,
    loki_url: str,
    tempo_url: str,
    namespace: str,
    service: str,
    window_from: datetime,
    window_to: datetime,
) -> dict[str, Any]:
    """한 번에 Prom/Loki/Tempo 수집. 반환값을 snapshot INSERT/UPDATE에 그대로 사용."""
    prom_status, prom_error, prom = await collect_prom(
        prom_url, namespace, service, window_from, window_to
    )
    loki_status, loki_error, loki = await collect_loki(
        loki_url, namespace, service, window_from, window_to
    )
    tempo_status, tempo_error, tempo = await collect_tempo(
        tempo_url, service, window_from, window_to
    )
    return {
        "prom_status": prom_status,
        "prom_error": prom_error,
        "prom": prom,
        "loki_status": loki_status,
        "loki_error": loki_error,
        "loki": loki,
        "tempo_status": tempo_status,
        "tempo_error": tempo_error,
        "tempo": tempo,
    }


# ----- Home snapshot: 인프라/관측성 대표 지표 + health -----

async def collect_prom_home(base_url: str) -> tuple[str, str | None, dict[str, Any]]:
    """홈용: node_not_ready, pod_not_ready, target_down, prom_up. 반환 (status, error, { stats, series })."""
    if not base_url.strip():
        return "empty", None, {"stats": [], "series": []}
    base = base_url.rstrip("/")
    stats_named: list[dict[str, Any]] = []
    series_list: list[Any] = []

    def has_result(data: dict) -> list[Any]:
        if data.get("status") != "success" or "data" not in data:
            return []
        return data["data"].get("result") or []

    try:
        async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
            async def query(q: str) -> list[Any]:
                r = await client.get(f"{base}/api/v1/query", params={"query": q})
                r.raise_for_status()
                return has_result(r.json())

            # 인프라 stats (cluster 필터 없음). 노드 NotReady는 ==1 필수, Pods는 dedupe(파드 기준)
            node_q = 'count(kube_node_status_condition{condition="Ready", status="false"} == 1) or vector(0)'
            node_res = await query(node_q)
            stats_named.append({"name": "node_not_ready", "value": _scalar_from_result(node_res) or 0})

            total_pods = _scalar_from_result(await query("count(kube_pod_info) or vector(0)")) or 0
            pod_not_ready = _scalar_from_result(
                await query('count(max by (namespace, pod) (kube_pod_status_ready{condition="false"} == 1)) or vector(0)')
            ) or 0
            stats_named.append({"name": "total_pods", "value": total_pods})
            stats_named.append({"name": "pod_not_ready", "value": pod_not_ready})

            down_targets = _scalar_from_result(await query("count(up == 0) or vector(0)")) or 0
            total_targets = _scalar_from_result(await query("count(up) or vector(0)")) or 0
            stats_named.append({"name": "down_targets", "value": down_targets})
            stats_named.append({"name": "total_targets", "value": total_targets})
            stats_named.append({"name": "target_down_ratio", "value": down_targets / max(total_targets, 1)})

            # Prometheus 자체 health: /-/ready
            try:
                r = await client.get(f"{base}/-/ready")
                prom_up = 1 if r.status_code == 200 else 0
            except Exception:
                prom_up = 0
            stats_named.append({"name": "prom_up", "value": prom_up})

        return "ok", None, {"stats": stats_named, "series": series_list}
    except httpx.HTTPStatusError as e:
        return "error", f"HTTP {e.response.status_code}", {"stats": stats_named, "series": series_list}
    except (httpx.RequestError, Exception) as e:
        return "error", str(e)[:200], {"stats": stats_named, "series": series_list}


async def collect_loki_health(base_url: str) -> tuple[str, str | None, dict[str, Any]]:
    """Loki health: GET /loki/api/v1/labels (gateway는 /ready 404). 200이면 ok, body 파싱 안 함."""
    if not base_url.strip():
        return "empty", None, {}
    base = base_url.rstrip("/")
    url = f"{base}/loki/api/v1/labels"
    logger.info("Loki health: GET %s", url)
    try:
        async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
            r = await client.get(url, headers=_loki_headers())
            if r.status_code == 200:
                return "ok", None, {"health": "ok"}
            return "error", f"HTTP {r.status_code}", {}
    except httpx.HTTPStatusError as e:
        return "error", f"HTTP {e.response.status_code}", {}
    except (httpx.RequestError, Exception) as e:
        return "error", str(e)[:200], {}


async def collect_tempo_health(base_url: str) -> tuple[str, str | None, dict[str, Any]]:
    """Tempo ready 체크. GET /ready 또는 /metrics 200이면 ok."""
    if not base_url.strip():
        return "empty", None, {}
    base = base_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
            for path in ("/ready", "/metrics"):
                try:
                    r = await client.get(f"{base}{path}")
                    if r.status_code == 200:
                        return "ok", None, {"health": "ok"}
                except Exception:
                    continue
            return "error", "ready/metrics unreachable", {}
    except httpx.HTTPStatusError as e:
        return "error", f"HTTP {e.response.status_code}", {}
    except (httpx.RequestError, Exception) as e:
        return "error", str(e)[:200], {}


async def run_home_collector(
    prom_url: str,
    loki_url: str,
    tempo_url: str,
) -> dict[str, Any]:
    """홈 스냅샷용: Prom(인프라+prom_up) + Loki/Tempo health. 반환 형식은 run_collector와 동일."""
    prom_status, prom_error, prom = await collect_prom_home(prom_url)
    loki_status, loki_error, loki = await collect_loki_health(loki_url)
    tempo_status, tempo_error, tempo = await collect_tempo_health(tempo_url)
    return {
        "prom_status": prom_status,
        "prom_error": prom_error,
        "prom": prom,
        "loki_status": loki_status,
        "loki_error": loki_error,
        "loki": loki,
        "tempo_status": tempo_status,
        "tempo_error": tempo_error,
        "tempo": tempo,
    }


# ----- Layer snapshots: infrastructure / observability / application -----

def _empty_loki_tempo() -> tuple[str, str | None, dict[str, Any], str, str | None, dict[str, Any]]:
    """레이어에서 Loki/Tempo 미수집 시 (status, error, body) x2."""
    return "empty", None, {}, "empty", None, {}


async def collect_layer_platform(
    prom_url: str,
    window_from: datetime,
    window_to: datetime,
) -> tuple[str, str | None, dict[str, Any], str, str | None, dict[str, Any], str, str | None, dict[str, Any]]:
    """Platform: AWS LBC, istio-ingress, istiod, ALB 5xx rate, YACE up."""
    if not prom_url.strip():
        return "empty", None, {"stats": [], "series": []}, *_empty_loki_tempo()
    base = prom_url.rstrip("/")
    window_s, window_e = _ts_s(window_from), _ts_s(window_to)
    stats_named: list[dict[str, Any]] = []
    series_list: list[Any] = []

    def has_result(data: dict) -> list[Any]:
        if data.get("status") != "success" or "data" not in data:
            return []
        return data["data"].get("result") or []

    def _scalar(qres: list[Any]) -> float:
        return _scalar_from_result(qres) or 0

    try:
        async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
            async def query(q: str) -> list[Any]:
                r = await client.get(f"{base}/api/v1/query", params={"query": q})
                r.raise_for_status()
                return has_result(r.json())

            async def query_range(q: str) -> list[Any]:
                r = await client.get(
                    f"{base}/api/v1/query_range",
                    params={"query": q, "start": window_s, "end": window_e, "step": "60"},
                )
                r.raise_for_status()
                return has_result(r.json())

            # AWS Load Balancer Controller
            lbc_up = _scalar(await query('sum(up{job="aws-load-balancer-controller-metrics"}) or vector(0)'))
            stats_named.append({"name": "lbc_up", "value": lbc_up})

            # Istio ingress / istiod
            istio_ingress_up = _scalar(await query('sum(up{job=~"istio-ingress.*|istio/ingressgateway.*"}) or vector(0)'))
            istiod_up = _scalar(await query('sum(up{job=~"istiod.*"}) or vector(0)'))
            stats_named.append({"name": "istio_ingress_up", "value": istio_ingress_up})
            stats_named.append({"name": "istiod_up", "value": istiod_up})

            # YACE up
            yace_up = _scalar(await query('sum(up{job=~"yace.*"}) or vector(0)'))
            stats_named.append({"name": "yace_up", "value": yace_up})

            # ALB 5xx rate 시계열 (30m)
            alb_5xx_q = (
                'sum(rate(aws_applicationelb_httpcode_target_5_xx_count_sum[5m])) or vector(0)'
            )
            alb_series = await query_range(alb_5xx_q)
            if alb_series:
                for s in alb_series:
                    s["_metric_name"] = "alb_5xx_rate"
                series_list.extend(alb_series)

        prom = {"stats": stats_named, "series": series_list}
        return "ok", None, prom, *_empty_loki_tempo()
    except httpx.HTTPStatusError as e:
        return "error", f"HTTP {e.response.status_code}", {"stats": stats_named, "series": series_list}, *_empty_loki_tempo()
    except (httpx.RequestError, Exception) as e:
        return "error", str(e)[:200], {"stats": stats_named, "series": series_list}, *_empty_loki_tempo()


async def collect_layer_delivery(
    prom_url: str,
    window_from: datetime,
    window_to: datetime,
) -> tuple[str, str | None, dict[str, Any], str, str | None, dict[str, Any], str, str | None, dict[str, Any]]:
    """Delivery: ArgoCD server/repo/app-controller, Jenkins, SonarQube up 상태."""
    if not prom_url.strip():
        return "empty", None, {"stats": [], "series": []}, *_empty_loki_tempo()
    base = prom_url.rstrip("/")
    stats_named: list[dict[str, Any]] = []

    def has_result(data: dict) -> list[Any]:
        if data.get("status") != "success" or "data" not in data:
            return []
        return data["data"].get("result") or []

    def _scalar(qres: list[Any]) -> float:
        return _scalar_from_result(qres) or 0

    try:
        async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
            async def query(q: str) -> list[Any]:
                r = await client.get(f"{base}/api/v1/query", params={"query": q})
                r.raise_for_status()
                return has_result(r.json())

            argocd_server = _scalar(await query('sum(up{job=~"argocd-server.*"}) or vector(0)'))
            argocd_repo = _scalar(await query('sum(up{job=~"argocd-repo-server.*"}) or vector(0)'))
            argocd_app_ctrl = _scalar(await query('sum(up{job=~"argocd-application-controller.*"}) or vector(0)'))
            jenkins_up = _scalar(await query('sum(up{job=~"jenkins.*"}) or vector(0)'))
            sonarqube_up = _scalar(await query('sum(up{job=~"sonarqube.*"}) or vector(0)'))

            stats_named.append({"name": "argocd_server_up", "value": argocd_server})
            stats_named.append({"name": "argocd_repo_up", "value": argocd_repo})
            stats_named.append({"name": "argocd_app_ctrl_up", "value": argocd_app_ctrl})
            stats_named.append({"name": "jenkins_up", "value": jenkins_up})
            stats_named.append({"name": "sonarqube_up", "value": sonarqube_up})

        prom = {"stats": stats_named, "series": []}
        return "ok", None, prom, *_empty_loki_tempo()
    except httpx.HTTPStatusError as e:
        return "error", f"HTTP {e.response.status_code}", {"stats": stats_named, "series": []}, *_empty_loki_tempo()
    except (httpx.RequestError, Exception) as e:
        return "error", str(e)[:200], {"stats": stats_named, "series": []}, *_empty_loki_tempo()


async def collect_layer_data(
    prom_url: str,
    window_from: datetime,
    window_to: datetime,
) -> tuple[str, str | None, dict[str, Any], str, str | None, dict[str, Any], str, str | None, dict[str, Any]]:
    """Data: Kafka broker/controller, MongoDB, MySQL exporter, Redis exporter up 상태."""
    if not prom_url.strip():
        return "empty", None, {"stats": [], "series": []}, *_empty_loki_tempo()
    base = prom_url.rstrip("/")
    window_s, window_e = _ts_s(window_from), _ts_s(window_to)
    stats_named: list[dict[str, Any]] = []
    series_list: list[Any] = []

    def has_result(data: dict) -> list[Any]:
        if data.get("status") != "success" or "data" not in data:
            return []
        return data["data"].get("result") or []

    def _scalar(qres: list[Any]) -> float:
        return _scalar_from_result(qres) or 0

    try:
        async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
            async def query(q: str) -> list[Any]:
                r = await client.get(f"{base}/api/v1/query", params={"query": q})
                r.raise_for_status()
                return has_result(r.json())

            async def query_range(q: str) -> list[Any]:
                r = await client.get(
                    f"{base}/api/v1/query_range",
                    params={"query": q, "start": window_s, "end": window_e, "step": "60"},
                )
                r.raise_for_status()
                return has_result(r.json())

            kafka_broker = _scalar(await query('sum(up{job=~"kafka.*"}) or vector(0)'))
            mongodb_up = _scalar(await query('sum(up{job=~"mongodb.*"}) or vector(0)'))
            mysql_up = _scalar(await query('sum(up{job=~"mysqld-exporter.*"}) or vector(0)'))
            redis_up = _scalar(await query('sum(up{job=~"redis-exporter.*"}) or vector(0)'))

            stats_named.append({"name": "kafka_up", "value": kafka_broker})
            stats_named.append({"name": "mongodb_up", "value": mongodb_up})
            stats_named.append({"name": "mysql_up", "value": mysql_up})
            stats_named.append({"name": "redis_up", "value": redis_up})

            # Kafka consumer lag 시계열 (있으면)
            lag_q = 'sum(kafka_consumergroup_lag) or vector(0)'
            lag_series = await query_range(lag_q)
            if lag_series:
                for s in lag_series:
                    s["_metric_name"] = "kafka_consumer_lag"
                series_list.extend(lag_series)

        prom = {"stats": stats_named, "series": series_list}
        return "ok", None, prom, *_empty_loki_tempo()
    except httpx.HTTPStatusError as e:
        return "error", f"HTTP {e.response.status_code}", {"stats": stats_named, "series": series_list}, *_empty_loki_tempo()
    except (httpx.RequestError, Exception) as e:
        return "error", str(e)[:200], {"stats": stats_named, "series": series_list}, *_empty_loki_tempo()


async def collect_layer_ux(
    prom_url: str,
    window_from: datetime,
    window_to: datetime,
) -> tuple[str, str | None, dict[str, Any], str, str | None, dict[str, Any], str, str | None, dict[str, Any]]:
    """UX: Faro RUM events/exceptions rate (5m), exception ratio."""
    if not prom_url.strip():
        return "empty", None, {"stats": [], "series": []}, *_empty_loki_tempo()
    base = prom_url.rstrip("/")
    window_s, window_e = _ts_s(window_from), _ts_s(window_to)
    stats_named: list[dict[str, Any]] = []
    series_list: list[Any] = []

    def has_result(data: dict) -> list[Any]:
        if data.get("status") != "success" or "data" not in data:
            return []
        return data["data"].get("result") or []

    def _scalar(qres: list[Any]) -> float:
        return _scalar_from_result(qres) or 0

    try:
        async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
            async def query(q: str) -> list[Any]:
                r = await client.get(f"{base}/api/v1/query", params={"query": q})
                r.raise_for_status()
                return has_result(r.json())

            async def query_range(q: str) -> list[Any]:
                r = await client.get(
                    f"{base}/api/v1/query_range",
                    params={"query": q, "start": window_s, "end": window_e, "step": "60"},
                )
                r.raise_for_status()
                return has_result(r.json())

            events_rate = _scalar(await query('sum(rate(faro_receiver_events_total[5m])) or vector(0)'))
            exception_rate = _scalar(await query('sum(rate(faro_receiver_exceptions_total[5m])) or vector(0)'))
            exception_ratio = exception_rate / max(events_rate, 0.001) if events_rate > 0 else 0

            stats_named.append({"name": "faro_events_rate", "value": events_rate})
            stats_named.append({"name": "faro_exception_rate", "value": exception_rate})
            stats_named.append({"name": "faro_exception_ratio", "value": exception_ratio})

            # events 시계열 30m
            events_series = await query_range('sum(rate(faro_receiver_events_total[5m])) or vector(0)')
            if events_series:
                for s in events_series:
                    s["_metric_name"] = "faro_events"
                series_list.extend(events_series)

            # exceptions 시계열 30m
            exc_series = await query_range('sum(rate(faro_receiver_exceptions_total[5m])) or vector(0)')
            if exc_series:
                for s in exc_series:
                    s["_metric_name"] = "faro_exceptions"
                series_list.extend(exc_series)

        prom = {"stats": stats_named, "series": series_list}
        return "ok", None, prom, *_empty_loki_tempo()
    except httpx.HTTPStatusError as e:
        return "error", f"HTTP {e.response.status_code}", {"stats": stats_named, "series": series_list}, *_empty_loki_tempo()
    except (httpx.RequestError, Exception) as e:
        return "error", str(e)[:200], {"stats": stats_named, "series": series_list}, *_empty_loki_tempo()


async def collect_layer_infrastructure(
    prom_url: str,
    window_from: datetime,
    window_to: datetime,
) -> tuple[str, str | None, dict[str, Any], str, str | None, dict[str, Any], str, str | None, dict[str, Any]]:
    """Infrastructure: nodes/pods ready total·notready, scrape_target_down·total_targets, ratio(0~1). cluster 필터 없음."""
    if not prom_url.strip():
        return "empty", None, {"stats": [], "series": []}, *_empty_loki_tempo()
    base = prom_url.rstrip("/")
    window_s, window_e = _ts_s(window_from), _ts_s(window_to)
    stats_named: list[dict[str, Any]] = []
    series_list: list[Any] = []

    def has_result(data: dict) -> list[Any]:
        if data.get("status") != "success" or "data" not in data:
            return []
        return data["data"].get("result") or []

    def _scalar(qres: list[Any]) -> float:
        return _scalar_from_result(qres) or 0

    try:
        async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
            async def query(q: str) -> list[Any]:
                r = await client.get(f"{base}/api/v1/query", params={"query": q})
                r.raise_for_status()
                return has_result(r.json())

            async def query_range(q: str) -> list[Any]:
                r = await client.get(
                    f"{base}/api/v1/query_range",
                    params={"query": q, "start": window_s, "end": window_e, "step": "60"},
                )
                r.raise_for_status()
                return has_result(r.json())

            # Nodes (NotReady: ==1 필수, 착시/중복 방지)
            total_nodes = _scalar(await query("count(kube_node_info) or vector(0)"))
            notready_nodes = _scalar(
                await query('count(kube_node_status_condition{condition="Ready", status="false"} == 1) or vector(0)')
            )
            ready_nodes = max(0, total_nodes - notready_nodes)
            stats_named.append({"name": "total_nodes", "value": total_nodes})
            stats_named.append({"name": "notready_nodes", "value": notready_nodes})
            stats_named.append({"name": "ready_nodes", "value": ready_nodes})

            # Pods (전체, 파드 기준 dedupe: max by (namespace, pod))
            total_pods = _scalar(await query("count(kube_pod_info) or vector(0)"))
            notready_pods = _scalar(
                await query('count(max by (namespace, pod) (kube_pod_status_ready{condition="false"} == 1)) or vector(0)')
            )
            ready_pods = max(0, total_pods - notready_pods)
            stats_named.append({"name": "total_pods", "value": total_pods})
            stats_named.append({"name": "notready_pods", "value": notready_pods})
            stats_named.append({"name": "ready_pods", "value": ready_pods})

            # Scrape targets (cluster 필터 없음)
            scrape_target_down = _scalar(await query("count(up == 0) or vector(0)"))
            total_targets = _scalar(await query("count(up) or vector(0)"))
            stats_named.append({"name": "scrape_target_down", "value": scrape_target_down})
            stats_named.append({"name": "total_targets", "value": total_targets})

            # Ratios 0~1 (clamp_min(total, 1))
            denom_pod = max(total_pods, 1)
            denom_tgt = max(total_targets, 1)
            stats_named.append({"name": "pod_not_ready_ratio", "value": notready_pods / denom_pod})
            stats_named.append({"name": "target_down_ratio", "value": scrape_target_down / denom_tgt})

            # Series: notready_pods 30m (dedupe 동일 적용)
            pod_series = await query_range('count(max by (namespace, pod) (kube_pod_status_ready{condition="false"} == 1)) or vector(0)')
            if pod_series:
                for s in pod_series:
                    s["_metric_name"] = "notready_pods"
                series_list.extend(pod_series)

        prom = {"stats": stats_named, "series": series_list}
        return "ok", None, prom, *_empty_loki_tempo()
    except httpx.HTTPStatusError as e:
        return "error", f"HTTP {e.response.status_code}", {"stats": stats_named, "series": series_list}, *_empty_loki_tempo()
    except (httpx.RequestError, Exception) as e:
        return "error", str(e)[:200], {"stats": stats_named, "series": series_list}, *_empty_loki_tempo()


async def collect_layer_observability(
    prom_url: str,
    loki_url: str,
    tempo_url: str,
    window_from: datetime,
    window_to: datetime,
) -> tuple[str, str | None, dict[str, Any], str, str | None, dict[str, Any], str, str | None, dict[str, Any]]:
    """Observability: prom_ready, loki_ready, tempo_ready (1/0) + target_down 30m 시계열. 결과는 prom에 통합."""
    base_prom = prom_url.rstrip("/") if prom_url else ""
    base_loki = loki_url.rstrip("/") if loki_url else ""
    base_tempo = tempo_url.rstrip("/") if tempo_url else ""
    window_s, window_e = _ts_s(window_from), _ts_s(window_to)
    stats_named: list[dict[str, Any]] = []
    series_list: list[Any] = []

    def has_result(data: dict) -> list[Any]:
        if data.get("status") != "success" or "data" not in data:
            return []
        return data["data"].get("result") or []

    prom_ready, loki_ready, tempo_ready = 0, 0, 0
    try:
        async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
            if base_prom:
                try:
                    r = await client.get(f"{base_prom}/-/ready")
                    prom_ready = 1 if r.status_code == 200 else 0
                except Exception:
                    pass
            if base_loki:
                try:
                    r = await client.get(f"{base_loki}/loki/api/v1/labels", headers=_loki_headers())
                    loki_ready = 1 if r.status_code == 200 else 0
                except Exception:
                    pass
            if base_tempo:
                for path in ("/ready", "/metrics"):
                    try:
                        r = await client.get(f"{base_tempo}{path}")
                        if r.status_code == 200:
                            tempo_ready = 1
                            break
                    except Exception:
                        continue
    except Exception:
        pass

    stats_named.append({"name": "prom_ready", "value": prom_ready})
    stats_named.append({"name": "loki_ready", "value": loki_ready})
    stats_named.append({"name": "tempo_ready", "value": tempo_ready})

    # Grafana / Alertmanager: up(job) 기반, >=1 이면 ok
    if base_prom:
        try:
            async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
                g = await client.get(
                    f"{base_prom}/api/v1/query",
                    params={"query": 'sum(up{job="kps-grafana"} == 1) or vector(0)'},
                )
                g.raise_for_status()
                stats_named.append({"name": "grafana_up", "value": _scalar_from_result(has_result(g.json())) or 0})
                a = await client.get(
                    f"{base_prom}/api/v1/query",
                    params={"query": 'sum(up{job="kps-alertmanager"} == 1) or vector(0)'},
                )
                a.raise_for_status()
                stats_named.append({"name": "alertmanager_up", "value": _scalar_from_result(has_result(a.json())) or 0})
                r = await client.get(
                    f"{base_prom}/api/v1/query_range",
                    params={
                        "query": "count(up == 0) or vector(0)",
                        "start": window_s,
                        "end": window_e,
                        "step": "60",
                    },
                )
                r.raise_for_status()
                res = has_result(r.json())
                if res:
                    for s in res:
                        s["_metric_name"] = "scrape_target_down"
                    series_list.extend(res)
        except Exception:
            pass

    prom = {"stats": stats_named, "series": series_list}
    loki_status = "ok" if loki_ready else "empty"
    tempo_status = "ok" if tempo_ready else "empty"
    return (
        "ok", None, prom,
        loki_status, None, {"ready": loki_ready},
        tempo_status, None, {"ready": tempo_ready},
    )


# Application layer: hp-core 고정. hp-backend-worker 포함(outbox/email 운영 필수)
APP_LAYER_SERVICES = ["hp-frontend", "hp-backend-core", "hp-backend-booking", "hp-backend-queue", "hp-backend-worker"]
APP_LAYER_LABEL_REGEX = "hp-frontend|hp-backend-core|hp-backend-booking|hp-backend-queue|hp-backend-worker"


async def collect_layer_application(
    prom_url: str,
    namespace: str,
    window_from: datetime,
    window_to: datetime,
) -> tuple[str, str | None, dict[str, Any], str, str | None, dict[str, Any], str, str | None, dict[str, Any]]:
    """Application: namespace=hp-core. 서비스별 total/ready (up 제거), pods hp-core 전체, cpu_cores·memory_bytes 30m."""
    if not prom_url.strip():
        return "empty", None, {"stats": [], "series": []}, *_empty_loki_tempo()
    base = prom_url.rstrip("/")
    ns = namespace or "hp-core"
    window_s, window_e = _ts_s(window_from), _ts_s(window_to)
    stats_named: list[dict[str, Any]] = []
    series_list: list[Any] = []

    def has_result(data: dict) -> list[Any]:
        if data.get("status") != "success" or "data" not in data:
            return []
        return data["data"].get("result") or []

    def _scalar(qres: list[Any]) -> float:
        return _scalar_from_result(qres) or 0

    try:
        async with httpx.AsyncClient(timeout=COLLECT_TIMEOUT) as client:
            async def query(q: str) -> list[Any]:
                r = await client.get(f"{base}/api/v1/query", params={"query": q})
                r.raise_for_status()
                return has_result(r.json())

            async def query_range(q: str) -> list[Any]:
                r = await client.get(
                    f"{base}/api/v1/query_range",
                    params={"query": q, "start": window_s, "end": window_e, "step": "60"},
                )
                r.raise_for_status()
                return has_result(r.json())

            # 서비스별 total: count by (label_app) kube_pod_labels{namespace, label_app=~...}
            total_q = (
                f'count by (label_app) (kube_pod_labels{{namespace="{ns}", '
                f'label_app=~"{APP_LAYER_LABEL_REGEX}"}})'
            )
            total_res = await query(total_q)
            total_by_app: dict[str, float] = {}
            for s in total_res:
                app = (s.get("metric") or {}).get("label_app")
                if app and app in APP_LAYER_SERVICES:
                    v = _scalar_from_result([s])
                    if v is not None:
                        total_by_app[app] = v

            # 서비스별 ready: (kube_pod_status_ready condition=true == 1) * on(namespace,pod) group_left(label_app) kube_pod_labels
            ready_q = (
                f'count by (label_app) ((kube_pod_status_ready{{namespace="{ns}", condition="true"}} == 1) '
                f'* on(namespace, pod) group_left(label_app) '
                f'kube_pod_labels{{namespace="{ns}", label_app=~"{APP_LAYER_LABEL_REGEX}"}})'
            )
            ready_res = await query(ready_q)
            ready_by_app: dict[str, float] = {}
            for s in ready_res:
                app = (s.get("metric") or {}).get("label_app")
                if app and app in APP_LAYER_SERVICES:
                    v = _scalar_from_result([s])
                    if v is not None:
                        ready_by_app[app] = v

            for svc in APP_LAYER_SERVICES:
                stats_named.append({"name": f"total_{svc}", "value": total_by_app.get(svc, 0)})
                stats_named.append({"name": f"ready_{svc}", "value": ready_by_app.get(svc, 0)})

            # Pods ready/total (hp-core 전체, notready dedupe)
            total_pods_hp_core = _scalar(await query(f'count(kube_pod_info{{namespace="{ns}"}}) or vector(0)'))
            notready_pods_hp_core = _scalar(
                await query(
                    f'count(max by (namespace, pod) (kube_pod_status_ready{{namespace="{ns}", condition="false"}} == 1)) or vector(0)'
                )
            )
            ready_pods_hp_core = max(0, total_pods_hp_core - notready_pods_hp_core)
            stats_named.append({"name": "total_pods_hp_core", "value": total_pods_hp_core})
            stats_named.append({"name": "notready_pods_hp_core", "value": notready_pods_hp_core})
            stats_named.append({"name": "ready_pods_hp_core", "value": ready_pods_hp_core})

            # CPU 시계열 (30m, namespace 합산)
            cpu_q = f'sum(rate(container_cpu_usage_seconds_total{{namespace="{ns}", container!="", image!=""}}[5m]))'
            cpu_series = await query_range(cpu_q)
            if cpu_series:
                for s in cpu_series:
                    s["_metric_name"] = "cpu_cores"
                series_list.extend(cpu_series)
            # Memory 시계열 (30m, working set)
            mem_q = f'sum(container_memory_working_set_bytes{{namespace="{ns}", container!="", image!=""}})'
            mem_series = await query_range(mem_q)
            if mem_series:
                for s in mem_series:
                    s["_metric_name"] = "memory_bytes"
                series_list.extend(mem_series)

        prom = {"stats": stats_named, "series": series_list}
        return "ok", None, prom, *_empty_loki_tempo()
    except httpx.HTTPStatusError as e:
        return "error", f"HTTP {e.response.status_code}", {"stats": stats_named, "series": series_list}, *_empty_loki_tempo()
    except (httpx.RequestError, Exception) as e:
        return "error", str(e)[:200], {"stats": stats_named, "series": series_list}, *_empty_loki_tempo()


async def run_layer_collectors(
    prom_url: str,
    loki_url: str,
    tempo_url: str,
    layers: list[str],
    app_namespace: str,
    window_from: datetime,
    window_to: datetime,
) -> list[dict[str, Any]]:
    """layers 순서대로 수집. 각 항목은 layer + prom/loki/tempo 필드 dict."""
    results: list[dict[str, Any]] = []
    for layer in layers:
        if layer == "infrastructure":
            p_s, p_e, p, l_s, l_e, l, t_s, t_e, t = await collect_layer_infrastructure(
                prom_url, window_from, window_to
            )
        elif layer == "observability":
            p_s, p_e, p, l_s, l_e, l, t_s, t_e, t = await collect_layer_observability(
                prom_url, loki_url, tempo_url, window_from, window_to
            )
        elif layer == "application":
            p_s, p_e, p, l_s, l_e, l, t_s, t_e, t = await collect_layer_application(
                prom_url, app_namespace, window_from, window_to
            )
        elif layer == "platform":
            p_s, p_e, p, l_s, l_e, l, t_s, t_e, t = await collect_layer_platform(
                prom_url, window_from, window_to
            )
        elif layer == "delivery":
            p_s, p_e, p, l_s, l_e, l, t_s, t_e, t = await collect_layer_delivery(
                prom_url, window_from, window_to
            )
        elif layer == "data":
            p_s, p_e, p, l_s, l_e, l, t_s, t_e, t = await collect_layer_data(
                prom_url, window_from, window_to
            )
        elif layer == "ux":
            p_s, p_e, p, l_s, l_e, l, t_s, t_e, t = await collect_layer_ux(
                prom_url, window_from, window_to
            )
        else:
            continue
        results.append({
            "layer": layer,
            "prom_status": p_s,
            "prom_error": p_e,
            "prom": p,
            "loki_status": l_s,
            "loki_error": l_e,
            "loki": l,
            "tempo_status": t_s,
            "tempo_error": t_e,
            "tempo": t,
        })
    return results
