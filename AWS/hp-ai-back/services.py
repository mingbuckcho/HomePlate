"""Business logic: webhook processing, cases, snapshots."""
import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import asyncpg

from config import settings
from schemas import AMAlert, AMWebhookPayload

from bedrock_embed import generate_embedding
from collector import run_collector, run_home_collector

logger = logging.getLogger(__name__)

# alertname prefix/keyword → layer (소문자 표준)
ALERTNAME_LAYER_MAP = {
    "Node": "infrastructure",
    "Pod": "infrastructure",
    "Container": "infrastructure",
    "Deployment": "infrastructure",
    "PVC": "infrastructure",
    "Scrape": "infrastructure",
    "Job": "infrastructure",
    "ArgoCD": "delivery",
    "Jenkins": "delivery",
    "Harbor": "delivery",
    "Prometheus": "observability",
    "Loki": "observability",
    "Tempo": "observability",
    "Grafana": "observability",
    "MongoDB": "data",
    "MariaDB": "data",
    "Redis": "data",
    "MinIO": "data",
    "Ingress": "ux",
    "HAProxy": "ux",
    "Frontend": "ux",
    "Backend": "application",
    "Worker": "application",
}

LAYER_ALLOWED = frozenset(
    {"infrastructure", "delivery", "observability", "data", "ux", "application", "unknown"}
)


def resolve_layer(labels: dict[str, Any], alertname: str | None) -> str:
    """
    - labels["layer"] 있으면 소문자 normalize 후 허용 집합에 있으면 사용, 없으면 "unknown"
    - 없으면 alertname prefix 매핑 (긴 키 우선), 매칭 없으면 "unknown"
    """
    layer_label = (labels.get("layer") or "").strip()
    if layer_label:
        normalized = layer_label.lower()
        return normalized if normalized in LAYER_ALLOWED else "unknown"

    name = (alertname or "").strip()
    if not name:
        return "unknown"

    # 긴 prefix 먼저 매칭 (예: BackendDown → Backend)
    for key in sorted(ALERTNAME_LAYER_MAP.keys(), key=len, reverse=True):
        if name.startswith(key):
            return ALERTNAME_LAYER_MAP[key]
    return "unknown"


class CaseKeyValidationError(Exception):
    """Raised when namespace or service is missing/empty (required for case_key)."""


def _get_label(labels: dict[str, Any], key: str, fallback: dict[str, Any] | None = None) -> str:
    v = labels.get(key)
    if v is not None and v != "":
        return str(v)
    if fallback:
        v = fallback.get(key)
        if v is not None and v != "":
            return str(v)
    return ""


def build_case_key_components(
    labels: dict[str, Any], common_labels: dict[str, Any] | None = None
) -> tuple[str, str, str, str, str]:
    """
    Returns (case_key, cluster, env, namespace, service).
    - cluster/env: missing/empty -> "unknown"
    - namespace/service: required; missing/empty -> raises CaseKeyValidationError
    - case_key = f"{cluster}|{env}|{namespace}|{service}" (no empty slots).
    """
    common = common_labels or {}
    cluster = _get_label(labels, "cluster", common) or "unknown"
    env = _get_label(labels, "env", common) or _get_label(labels, "environment", common) or "unknown"
    namespace = _get_label(labels, "namespace", common)
    service = _get_label(labels, "service", common)
    if not namespace or not service:
        raise CaseKeyValidationError("namespace and service are required")
    case_key = f"{cluster}|{env}|{namespace}|{service}"
    return (case_key, cluster, env, namespace, service)


def get_severity(labels: dict[str, Any], common: dict[str, Any] | None = None) -> str | None:
    s = _get_label(labels, "severity", common or {})
    return s or None


async def process_webhook(conn: asyncpg.Connection, payload: AMWebhookPayload) -> dict[str, Any]:
    """Process Alertmanager webhook: upsert cases, insert alert_events, case_alertnames, snapshots. All in one transaction."""
    now = datetime.now(timezone.utc)
    window_from = now - timedelta(minutes=30)
    window_to = now
    expires_at = now + timedelta(days=14)
    common = payload.commonLabels or {}
    case_ids_created_snapshot: set[int] = set()
    skipped_count = 0
    processed_count = 0

    async with conn.transaction():
        for alert in payload.alerts:
            labels = {**(common), **(alert.labels or {})}
            try:
                case_key, cluster, env, namespace, service = build_case_key_components(
                    labels, common
                )
            except CaseKeyValidationError:
                # namespace/service 가 없어서 case_key를 만들 수 없는 알림은 건너뛴다.
                alertname = (alert.labels or {}).get("alertname") or "unknown"
                logger.warning(
                    "Skipping alert without namespace/service for case_key: alertname=%s labels=%s",
                    alertname,
                    {k: labels.get(k) for k in ("cluster", "env", "environment", "namespace", "service")},
                )
                skipped_count += 1
                continue
            severity = get_severity(labels, common)
            alertname = (alert.labels or {}).get("alertname")
            layer = resolve_layer(labels, alertname)
            am_status = alert.status or payload.status
            is_resolved = (am_status or "").lower() == "resolved"

            # Upsert case (layer 포함, 최신 판정값으로 갱신)
            row = await conn.fetchrow(
                """
                INSERT INTO aiops.cases (
                    case_key, status, severity, layer, cluster, environment, namespace, service,
                    title, started_at, last_seen_at, resolved_at
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8,
                    $9, $10, $10, $11
                )
                ON CONFLICT (case_key) DO UPDATE SET
                    status = CASE WHEN $2 = 'resolved' THEN 'resolved' ELSE aiops.cases.status END,
                    severity = COALESCE($3, aiops.cases.severity),
                    layer = $4,
                    last_seen_at = $10,
                    resolved_at = CASE WHEN $2 = 'resolved' THEN $10 ELSE aiops.cases.resolved_at END
                RETURNING id, status
                """,
                case_key,
                "resolved" if is_resolved else "open",
                severity,
                layer,
                cluster,
                env,
                namespace,
                service,
                (alert.annotations or {}).get("summary") or (alert.annotations or {}).get("description") or case_key,
                now,
                now if is_resolved else None,
            )
            case_id = row["id"]

            # Insert alert_event (jsonb columns: pass JSON string for asyncpg)
            raw = alert.model_dump() if hasattr(alert, "model_dump") else alert.dict()
            await conn.execute(
                """
                INSERT INTO aiops.alert_events (
                    case_id, am_status, alertname, group_key, fingerprint, labels, annotations, raw
                )
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
                """,
                case_id,
                am_status,
                alertname,
                payload.groupKey or None,
                getattr(alert, "fingerprint", None) or (alert.labels or {}).get("fingerprint"),
                json.dumps(labels),
                json.dumps(alert.annotations or {}),
                json.dumps(raw),
            )

            # case_alertnames upsert
            alertname = (alert.labels or {}).get("alertname") or "unknown"
            await conn.execute(
                """
                INSERT INTO aiops.case_alertnames (case_id, alertname, first_seen, last_seen)
                VALUES ($1, $2, $3, $3)
                ON CONFLICT (case_id, alertname) DO UPDATE SET last_seen = $3
                """,
                case_id,
                alertname,
                now,
            )

            # One snapshot per case (skip if same case_id has snapshot in last 2 minutes)
            if case_id not in case_ids_created_snapshot:
                recent = await conn.fetchrow(
                    """
                    SELECT 1 FROM aiops.snapshots
                    WHERE case_id = $1 AND created_at > now() - interval '2 minutes'
                    LIMIT 1
                    """,
                    case_id,
                )
                if not recent:
                    coll = await run_collector(
                        settings.prom_url,
                        settings.loki_url,
                        settings.tempo_url,
                        namespace,
                        service,
                        window_from,
                        window_to,
                    )
                    await conn.execute(
                        """
                        INSERT INTO aiops.snapshots (
                            case_id, window_from, window_to,
                            prom_status, prom_error, prom, loki_status, loki_error, loki,
                            tempo_status, tempo_error, tempo, expires_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10, $11, $12::jsonb, $13)
                        """,
                        case_id,
                        window_from,
                        window_to,
                        coll["prom_status"],
                        coll.get("prom_error"),
                        json.dumps(coll["prom"]),
                        coll["loki_status"],
                        coll.get("loki_error"),
                        json.dumps(coll["loki"]),
                        coll["tempo_status"],
                        coll.get("tempo_error"),
                        json.dumps(coll["tempo"]),
                        expires_at,
                    )
                    case_ids_created_snapshot.add(case_id)

            processed_count += 1

    return {
        "ok": True,
        "alerts_processed": processed_count,
        "alerts_skipped": skipped_count,
        "cases_touched": len(case_ids_created_snapshot),
    }


# ----- Cases list/detail/refresh -----

async def list_cases(
    conn: asyncpg.Connection,
    *,
    status: str | None = None,
    severity: str | None = None,
    layer: str | None = None,
    namespace: str | None = None,
    service: str | None = None,
    time_from: datetime | None = None,
    time_to: datetime | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[asyncpg.Record]:
    """Filter and sort: severity first, then last_seen_at desc."""
    conditions = ["1=1"]
    args: list[Any] = []
    n = 0
    if status:
        n += 1
        conditions.append(f"c.status = ${n}")
        args.append(status)
    if severity:
        n += 1
        conditions.append(f"c.severity = ${n}")
        args.append(severity)
    if layer:
        n += 1
        conditions.append(f"c.layer = ${n}")
        args.append(layer)
    if namespace:
        n += 1
        conditions.append(f"c.namespace = ${n}")
        args.append(namespace)
    if service:
        n += 1
        conditions.append(f"c.service = ${n}")
        args.append(service)
    if time_from:
        n += 1
        conditions.append(f"c.last_seen_at >= ${n}")
        args.append(time_from)
    if time_to:
        n += 1
        conditions.append(f"c.last_seen_at <= ${n}")
        args.append(time_to)
    if search:
        n += 1
        search_arg = f"%{search}%"
        conditions.append(f"(c.case_key ILIKE ${n} OR EXISTS (SELECT 1 FROM aiops.case_alertnames ca WHERE ca.case_id = c.id AND ca.alertname ILIKE ${n}))")
        args.append(search_arg)
    n += 1
    args.append(limit)
    n += 1
    args.append(offset)
    where = " AND ".join(conditions)
    # severity order: critical > warning > info (custom order), then last_seen_at desc
    order = """
        CASE c.severity
            WHEN 'critical' THEN 1
            WHEN 'warning' THEN 2
            WHEN 'info' THEN 3
            ELSE 4
        END,
        c.last_seen_at DESC
    """
    q = f"""
        SELECT c.id, c.case_key, c.status, c.severity, c.layer, c.cluster, c.environment, c.namespace, c.service,
               c.started_at, c.last_seen_at
        FROM aiops.cases c
        WHERE {where}
        ORDER BY {order}
        LIMIT ${n-1} OFFSET ${n}
    """
    return await conn.fetch(q, *args)


# ----- Summary (집계만, layer IS NOT NULL인 케이스만) -----

async def get_summary_home(
    conn: asyncpg.Connection,
    *,
    status: str = "open",
) -> dict[str, Any]:
    """Open(또는 지정 status) 케이스 중 layer가 있는 것만 집계. total_open, by_layer, by_severity, top_services(5), recently_updated(5)."""
    base = "c.status = $1 AND c.layer IS NOT NULL"
    args: list[Any] = [status]

    total = await conn.fetchval(
        f"SELECT COUNT(*) FROM aiops.cases c WHERE {base}",
        *args,
    )
    total_open = int(total or 0)

    by_layer_rows = await conn.fetch(
        f"SELECT c.layer AS layer, COUNT(*) AS count FROM aiops.cases c WHERE {base} GROUP BY c.layer ORDER BY count DESC",
        *args,
    )
    by_layer = [{"layer": r["layer"], "count": r["count"]} for r in by_layer_rows]

    by_severity_rows = await conn.fetch(
        f"SELECT COALESCE(c.severity, 'unknown') AS severity, COUNT(*) AS count FROM aiops.cases c WHERE {base} GROUP BY c.severity ORDER BY count DESC",
        *args,
    )
    by_severity = [{"severity": r["severity"], "count": r["count"]} for r in by_severity_rows]

    top_services_rows = await conn.fetch(
        f"""
        SELECT c.namespace AS namespace, c.service AS service, COUNT(*) AS count
        FROM aiops.cases c WHERE {base}
        GROUP BY c.namespace, c.service ORDER BY count DESC LIMIT 5
        """,
        *args,
    )
    top_services = [
        {"namespace": r["namespace"] or "", "service": r["service"] or "", "count": r["count"]}
        for r in top_services_rows
    ]

    recent_rows = await conn.fetch(
        f"""
        SELECT c.id, c.case_key, c.last_seen_at
        FROM aiops.cases c WHERE {base}
        ORDER BY c.last_seen_at DESC LIMIT 5
        """,
        *args,
    )
    recently_updated = [
        {
            "id": r["id"],
            "case_key": r["case_key"],
            "last_seen_at": r["last_seen_at"].isoformat() if hasattr(r["last_seen_at"], "isoformat") else str(r["last_seen_at"]),
        }
        for r in recent_rows
    ]

    return {
        "total_open": total_open,
        "by_layer": by_layer,
        "by_severity": by_severity,
        "top_services": top_services,
        "recently_updated": recently_updated,
    }


async def get_summary_layer(
    conn: asyncpg.Connection,
    layer: str,
    *,
    status: str = "open",
) -> dict[str, Any]:
    """지정 layer의 open 케이스만 집계. layer, total_open, by_severity, top_services(5), recently_updated(5)."""
    base = "c.status = $1 AND c.layer = $2"
    args: list[Any] = [status, layer]

    total = await conn.fetchval(
        f"SELECT COUNT(*) FROM aiops.cases c WHERE {base}",
        *args,
    )
    total_open = int(total or 0)

    by_severity_rows = await conn.fetch(
        f"SELECT COALESCE(c.severity, 'unknown') AS severity, COUNT(*) AS count FROM aiops.cases c WHERE {base} GROUP BY c.severity ORDER BY count DESC",
        *args,
    )
    by_severity = [{"severity": r["severity"], "count": r["count"]} for r in by_severity_rows]

    top_services_rows = await conn.fetch(
        f"""
        SELECT c.namespace AS namespace, c.service AS service, COUNT(*) AS count
        FROM aiops.cases c WHERE {base}
        GROUP BY c.namespace, c.service ORDER BY count DESC LIMIT 5
        """,
        *args,
    )
    top_services = [
        {"namespace": r["namespace"] or "", "service": r["service"] or "", "count": r["count"]}
        for r in top_services_rows
    ]

    recent_rows = await conn.fetch(
        f"""
        SELECT c.id, c.case_key, c.last_seen_at
        FROM aiops.cases c WHERE {base}
        ORDER BY c.last_seen_at DESC LIMIT 5
        """,
        *args,
    )
    recently_updated = [
        {
            "id": r["id"],
            "case_key": r["case_key"],
            "last_seen_at": r["last_seen_at"].isoformat() if hasattr(r["last_seen_at"], "isoformat") else str(r["last_seen_at"]),
        }
        for r in recent_rows
    ]

    return {
        "layer": layer,
        "total_open": total_open,
        "by_severity": by_severity,
        "top_services": top_services,
        "recently_updated": recently_updated,
    }


async def get_case_detail(
    conn: asyncpg.Connection,
    case_id: int,
    alert_events_limit: int = 50,
) -> tuple[asyncpg.Record | None, list[asyncpg.Record], asyncpg.Record | None, asyncpg.Record | None]:
    """Return (case, alert_events, latest_snapshot, ai_summary for that snapshot)."""
    case = await conn.fetchrow("SELECT * FROM aiops.cases WHERE id = $1", case_id)
    if not case:
        return None, [], None, None
    events = await conn.fetch(
        """
        SELECT received_at, am_status, alertname, labels, annotations
        FROM aiops.alert_events WHERE case_id = $1 ORDER BY received_at DESC LIMIT $2
        """,
        case_id,
        alert_events_limit,
    )
    snapshot = await conn.fetchrow(
        "SELECT * FROM aiops.snapshots WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1",
        case_id,
    )
    ai_summary = None
    if snapshot:
        ai_summary = await conn.fetchrow(
            "SELECT summary, evidence, checks, advice FROM aiops.ai_summaries WHERE snapshot_id = $1",
            snapshot["id"],
        )
    return case, events, snapshot, ai_summary


async def refresh_case_snapshot(conn: asyncpg.Connection, case_id: int) -> asyncpg.Record | None:
    """Create a new snapshot for the case (window now-30m ~ now), 항상 collector 실행."""
    case = await conn.fetchrow(
        "SELECT id, namespace, service FROM aiops.cases WHERE id = $1", case_id
    )
    if not case:
        return None
    now = datetime.now(timezone.utc)
    window_from = now - timedelta(minutes=30)
    window_to = now
    expires_at = now + timedelta(days=14)
    namespace = case.get("namespace") or ""
    service = case.get("service") or ""
    coll = await run_collector(
        settings.prom_url,
        settings.loki_url,
        settings.tempo_url,
        namespace,
        service,
        window_from,
        window_to,
    )
    await conn.execute(
        """
        INSERT INTO aiops.snapshots (
            case_id, window_from, window_to,
            prom_status, prom_error, prom, loki_status, loki_error, loki,
            tempo_status, tempo_error, tempo, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10, $11, $12::jsonb, $13)
        """,
        case_id,
        window_from,
        window_to,
        coll["prom_status"],
        coll.get("prom_error"),
        json.dumps(coll["prom"]),
        coll["loki_status"],
        coll.get("loki_error"),
        json.dumps(coll["loki"]),
        coll["tempo_status"],
        coll.get("tempo_error"),
        json.dumps(coll["tempo"]),
        expires_at,
    )
    return await conn.fetchrow(
        "SELECT * FROM aiops.snapshots WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1",
        case_id,
    )


# ----- Phase2: AI summary (on-demand, UPSERT) -----

def _json_for_db(val: Any) -> str:
    """Serialize for jsonb column; empty dict if None."""
    if val is None:
        return "{}"
    if isinstance(val, (dict, list)):
        return json.dumps(val)
    if isinstance(val, str):
        try:
            json.loads(val)
            return val
        except json.JSONDecodeError:
            return json.dumps({"value": val})
    return json.dumps({"value": val})


async def upsert_ai_summary(
    conn: asyncpg.Connection,
    snapshot_id: int,
    *,
    model: str | None = None,
    prompt_version: str | None = None,
    summary: str,
    evidence: Any = None,
    checks: Any = None,
    advice: Any = None,
    raw: Any = None,
) -> asyncpg.Record:
    """Insert or update ai_summaries for snapshot_id (ON CONFLICT DO UPDATE)."""
    await conn.execute(
        """
        INSERT INTO aiops.ai_summaries (snapshot_id, model, prompt_version, summary, evidence, checks, advice, raw)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)
        ON CONFLICT (snapshot_id) DO UPDATE SET
            model = EXCLUDED.model,
            prompt_version = EXCLUDED.prompt_version,
            summary = EXCLUDED.summary,
            evidence = EXCLUDED.evidence,
            checks = EXCLUDED.checks,
            advice = EXCLUDED.advice,
            raw = EXCLUDED.raw,
            created_at = now()
        """,
        snapshot_id,
        model,
        prompt_version,
        summary,
        _json_for_db(evidence),
        _json_for_db(checks),
        _json_for_db(advice),
        _json_for_db(raw),
    )
    return await conn.fetchrow(
        "SELECT * FROM aiops.ai_summaries WHERE snapshot_id = $1",
        snapshot_id,
    )


async def save_ai_summary_embedding(
    conn: asyncpg.Connection,
    snapshot_id: int,
    vec: list[float] | None,
) -> None:
    """RAG: ai_summaries.embedding 업데이트. vec가 None이면 UPDATE 스킵."""
    if vec is None:
        return
    vec_str = "[" + ",".join(str(x) for x in vec) + "]"
    await conn.execute(
        "UPDATE aiops.ai_summaries SET embedding = $1::vector WHERE snapshot_id = $2",
        vec_str,
        snapshot_id,
    )


async def find_similar_ai_summaries(
    conn: asyncpg.Connection,
    text: str,
    *,
    top_k: int = 3,
) -> list[dict[str, Any]]:
    """
    RAG: 입력 텍스트로 embedding 생성 후 cosine 유사도 top_k 건 반환.
    반환: snapshot_id, case_key, created_at, summary_preview, distance
    embedding 생성 실패/차원 불일치 시 빈 리스트 반환.
    """
    vec = await asyncio.to_thread(generate_embedding, text)
    if vec is None:
        return []
    vec_str = "[" + ",".join(str(x) for x in vec) + "]"
    rows = await conn.fetch(
        """
        SELECT
            a.snapshot_id,
            c.case_key,
            a.created_at,
            left(a.summary, 200) AS summary_preview,
            (a.embedding <=> $1::vector) AS distance
        FROM aiops.ai_summaries a
        JOIN aiops.snapshots s ON s.id = a.snapshot_id
        JOIN aiops.cases c ON c.id = s.case_id
        WHERE a.embedding IS NOT NULL
        ORDER BY a.embedding <=> $1::vector
        LIMIT $2
        """,
        vec_str,
        top_k,
    )
    return [
        {
            "snapshot_id": r["snapshot_id"],
            "case_key": r["case_key"],
            "created_at": _format_dt_iso8601(r["created_at"]) if r.get("created_at") else "",
            "summary_preview": (r["summary_preview"] or "")[:200],
            "distance": float(r["distance"]) if r.get("distance") is not None else None,
        }
        for r in rows
    ]


# ----- Home snapshot (14일 TTL) -----

async def insert_home_snapshot(
    conn: asyncpg.Connection,
    *,
    window_from: datetime,
    window_to: datetime,
    expires_at: datetime,
    prom_status: str,
    prom_error: str | None,
    prom: dict[str, Any],
    loki_status: str,
    loki_error: str | None,
    loki: dict[str, Any],
    tempo_status: str,
    tempo_error: str | None,
    tempo: dict[str, Any],
) -> asyncpg.Record:
    """Home snapshot 1건 INSERT. 반환: inserted row (id, created_at, ...)."""
    row = await conn.fetchrow(
        """
        INSERT INTO aiops.home_snapshots (
            window_from, window_to, expires_at,
            prom_status, prom_error, prom,
            loki_status, loki_error, loki,
            tempo_status, tempo_error, tempo
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10, $11, $12::jsonb)
        RETURNING id, created_at, window_from, window_to, expires_at,
                  prom_status, prom_error, prom, loki_status, loki_error, loki,
                  tempo_status, tempo_error, tempo
        """,
        window_from,
        window_to,
        expires_at,
        prom_status,
        prom_error,
        _json_for_db(prom),
        loki_status,
        loki_error,
        _json_for_db(loki),
        tempo_status,
        tempo_error,
        _json_for_db(tempo),
    )
    return row


async def get_latest_home_snapshot(conn: asyncpg.Connection) -> asyncpg.Record | None:
    """최신 home_snapshot 1건. 없으면 None."""
    return await conn.fetchrow(
        """
        SELECT id, created_at, window_from, window_to, expires_at,
               prom_status, prom_error, prom, loki_status, loki_error, loki,
               tempo_status, tempo_error, tempo
        FROM aiops.home_snapshots
        ORDER BY created_at DESC
        LIMIT 1
        """
    )


# ----- Home layer snapshots (14일 TTL) -----

async def insert_home_layer_snapshot(
    conn: asyncpg.Connection,
    *,
    layer: str,
    window_from: datetime,
    window_to: datetime,
    expires_at: datetime,
    prom_status: str,
    prom_error: str | None,
    prom: dict[str, Any],
    loki_status: str,
    loki_error: str | None,
    loki: dict[str, Any],
    tempo_status: str,
    tempo_error: str | None,
    tempo: dict[str, Any],
) -> asyncpg.Record:
    """Home layer snapshot 1건 INSERT."""
    return await conn.fetchrow(
        """
        INSERT INTO aiops.home_layer_snapshots (
            layer, window_from, window_to, expires_at,
            prom_status, prom_error, prom,
            loki_status, loki_error, loki,
            tempo_status, tempo_error, tempo
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11, $12, $13::jsonb)
        RETURNING id, created_at, layer, window_from, window_to, expires_at,
                  prom_status, prom_error, prom, loki_status, loki_error, loki,
                  tempo_status, tempo_error, tempo
        """,
        layer,
        window_from,
        window_to,
        expires_at,
        prom_status,
        prom_error,
        _json_for_db(prom),
        loki_status,
        loki_error,
        _json_for_db(loki),
        tempo_status,
        tempo_error,
        _json_for_db(tempo),
    )


async def get_latest_home_layer_snapshots(
    conn: asyncpg.Connection,
    layers: list[str],
) -> list[asyncpg.Record]:
    """각 layer별 최신 1건씩 반환 (layers 순서). prom/loki/tempo jsonb 반드시 SELECT."""
    if not layers:
        return []
    rows: list[asyncpg.Record] = []
    for layer in layers:
        row = await conn.fetchrow(
            """
            SELECT
                id, created_at, layer, window_from, window_to, expires_at,
                prom_status, prom_error, prom,
                loki_status, loki_error, loki,
                tempo_status, tempo_error, tempo
            FROM aiops.home_layer_snapshots
            WHERE layer = $1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            layer,
        )
        if row:
            rows.append(row)
    return rows


# ----- Weekly report (Phase1: browser report tab aggregation) -----

def _format_dt_iso8601(dt: datetime | None) -> str:
    """Format datetime as UTC ISO8601 (e.g. 2026-03-03T09:24:04Z)."""
    if dt is None:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


async def get_weekly_report(
    conn: asyncpg.Connection,
    *,
    period_start: datetime,
    period_end: datetime,
    days: int,
) -> dict[str, Any]:
    """
    Aggregate weekly report by alert_events.received_at in [period_start, period_end].
    Returns dict with period, totals, trend_daily, by_layer, by_severity,
    top_services, top_alertnames, latest_cases, ai_highlights_seed.
    """
    # (1) totals
    total_cases_row = await conn.fetchrow(
        """
        SELECT COUNT(DISTINCT ae.case_id) AS cnt
        FROM aiops.alert_events ae
        WHERE ae.received_at >= $1 AND ae.received_at <= $2
        """,
        period_start,
        period_end,
    )
    total_cases = int(total_cases_row["cnt"] or 0)

    resolved_row = await conn.fetchrow(
        """
        SELECT COUNT(*) AS cnt
        FROM aiops.cases c
        WHERE c.resolved_at IS NOT NULL
          AND c.resolved_at >= $1 AND c.resolved_at <= $2
        """,
        period_start,
        period_end,
    )
    resolved_cases = int(resolved_row["cnt"] or 0)
    resolution_rate = (resolved_cases / total_cases) if total_cases else 0.0

    # (2) trend_daily: opened by day (DISTINCT case_id per day), resolved by day
    trend_opened = await conn.fetch(
        """
        SELECT date_trunc('day', ae.received_at) AT TIME ZONE 'UTC' AS d,
               COUNT(DISTINCT ae.case_id) AS opened
        FROM aiops.alert_events ae
        WHERE ae.received_at >= $1 AND ae.received_at <= $2
        GROUP BY date_trunc('day', ae.received_at)
        ORDER BY d
        """,
        period_start,
        period_end,
    )
    trend_resolved = await conn.fetch(
        """
        SELECT date_trunc('day', c.resolved_at) AT TIME ZONE 'UTC' AS d,
               COUNT(*) AS resolved
        FROM aiops.cases c
        WHERE c.resolved_at IS NOT NULL
          AND c.resolved_at >= $1 AND c.resolved_at <= $2
        GROUP BY date_trunc('day', c.resolved_at)
        ORDER BY d
        """,
        period_start,
        period_end,
    )
    def _to_date(v: Any):
        if v is None:
            return None
        if hasattr(v, "date") and callable(getattr(v, "date")):
            return v.date()
        return v

    opened_by_day = {_to_date(r["d"]): r["opened"] for r in trend_opened if r["d"] is not None}
    resolved_by_day = {_to_date(r["d"]): r["resolved"] for r in trend_resolved if r["d"] is not None}
    # Build all days in range so frontend has 0s
    start_date = period_start.date() if hasattr(period_start, "date") else period_start
    end_date = period_end.date() if hasattr(period_end, "date") else period_end
    sorted_dates: list[Any] = []
    current = start_date
    while current <= end_date:
        sorted_dates.append(current)
        current = current + timedelta(days=1)  # type: ignore[assignment]
    trend_daily = [
        {
            "date": d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)[:10],
            "opened": opened_by_day.get(d, 0),
            "resolved": resolved_by_day.get(d, 0),
        }
        for d in sorted_dates
    ]

    # (3) by_layer: layer normalized to allowed or 'unknown', COUNT(DISTINCT ae.case_id)
    layer_rows = await conn.fetch(
        """
        WITH ev AS (
            SELECT ae.case_id
            FROM aiops.alert_events ae
            WHERE ae.received_at >= $1 AND ae.received_at <= $2
        ),
        layer_norm AS (
            SELECT DISTINCT e.case_id,
                   CASE
                     WHEN c.layer IS NULL OR TRIM(c.layer) = '' THEN 'unknown'
                     WHEN LOWER(TRIM(c.layer)) IN ('infrastructure','delivery','observability','data','ux','application')
                       THEN LOWER(TRIM(c.layer))
                     ELSE 'unknown'
                   END AS layer
            FROM ev e
            JOIN aiops.cases c ON c.id = e.case_id
        )
        SELECT layer, COUNT(DISTINCT case_id) AS count
        FROM layer_norm
        GROUP BY layer
        ORDER BY count DESC
        """,
        period_start,
        period_end,
    )
    by_layer = [{"layer": r["layer"], "count": r["count"]} for r in layer_rows]
    # Ensure all allowed layers present with 0
    for layer in ("infrastructure", "delivery", "observability", "data", "ux", "application", "unknown"):
        if not any(x["layer"] == layer for x in by_layer):
            by_layer.append({"layer": layer, "count": 0})
    by_layer.sort(key=lambda x: (-x["count"], x["layer"]))

    # (4) by_severity: critical/warning/info else unknown
    severity_rows = await conn.fetch(
        """
        WITH ev AS (
            SELECT ae.case_id
            FROM aiops.alert_events ae
            WHERE ae.received_at >= $1 AND ae.received_at <= $2
        ),
        sev_norm AS (
            SELECT DISTINCT e.case_id,
                   CASE
                     WHEN c.severity IS NULL OR TRIM(c.severity) = '' THEN 'unknown'
                     WHEN LOWER(TRIM(c.severity)) IN ('critical','warning','info')
                       THEN LOWER(TRIM(c.severity))
                     ELSE 'unknown'
                   END AS severity
            FROM ev e
            JOIN aiops.cases c ON c.id = e.case_id
        )
        SELECT severity, COUNT(DISTINCT case_id) AS count
        FROM sev_norm
        GROUP BY severity
        ORDER BY count DESC
        """,
        period_start,
        period_end,
    )
    by_severity = [{"severity": r["severity"], "count": r["count"]} for r in severity_rows]
    for sev in ("critical", "warning", "info", "unknown"):
        if not any(x["severity"] == sev for x in by_severity):
            by_severity.append({"severity": sev, "count": 0})
    by_severity.sort(key=lambda x: (-x["count"], x["severity"]))

    # (5) top_services Top5
    top_services_rows = await conn.fetch(
        """
        SELECT c.namespace AS namespace, c.service AS service, COUNT(DISTINCT ae.case_id) AS count
        FROM aiops.alert_events ae
        JOIN aiops.cases c ON c.id = ae.case_id
        WHERE ae.received_at >= $1 AND ae.received_at <= $2
        GROUP BY c.namespace, c.service
        ORDER BY count DESC
        LIMIT 5
        """,
        period_start,
        period_end,
    )
    top_services = [
        {"namespace": r["namespace"] or "", "service": r["service"] or "", "count": r["count"]}
        for r in top_services_rows
    ]

    # (6) top_alertnames Top5 (alertname null/empty can exclude)
    top_alertnames_rows = await conn.fetch(
        """
        SELECT ae.alertname AS alertname, COUNT(*) AS count
        FROM aiops.alert_events ae
        WHERE ae.received_at >= $1 AND ae.received_at <= $2
          AND ae.alertname IS NOT NULL AND TRIM(ae.alertname) != ''
        GROUP BY ae.alertname
        ORDER BY count DESC
        LIMIT 5
        """,
        period_start,
        period_end,
    )
    top_alertnames = [{"alertname": r["alertname"] or "", "count": r["count"]} for r in top_alertnames_rows]

    # (7) latest_cases: no period filter, ORDER BY last_seen_at DESC LIMIT 10
    latest_rows = await conn.fetch(
        """
        SELECT c.id AS case_id, c.case_key, c.namespace, c.service, c.layer, c.severity, c.status, c.last_seen_at
        FROM aiops.cases c
        ORDER BY c.last_seen_at DESC
        LIMIT 10
        """
    )
    latest_cases = []
    for r in latest_rows:
        layer_val = r["layer"]
        if layer_val is None or (isinstance(layer_val, str) and layer_val.strip() == ""):
            layer_val = "unknown"
        elif isinstance(layer_val, str) and layer_val.lower() not in (
            "infrastructure", "delivery", "observability", "data", "ux", "application"
        ):
            layer_val = "unknown"
        else:
            layer_val = layer_val.lower() if isinstance(layer_val, str) else "unknown"
        severity_val = r["severity"]
        if severity_val is None or (isinstance(severity_val, str) and severity_val.strip() == ""):
            severity_val = "unknown"
        elif isinstance(severity_val, str) and severity_val.lower() not in ("critical", "warning", "info"):
            severity_val = "unknown"
        else:
            severity_val = (severity_val or "unknown").lower() if isinstance(severity_val, str) else "unknown"
        latest_cases.append({
            "case_id": r["case_id"],
            "case_key": r["case_key"],
            "namespace": r["namespace"] or "",
            "service": r["service"] or "",
            "layer": layer_val,
            "severity": severity_val,
            "status": r["status"] or "open",
            "last_seen_at": _format_dt_iso8601(r["last_seen_at"]),
        })

    # (8) ai_highlights_seed: 기간 내(period_start~period_end) ai_summaries.created_at 기준 최신 3건만
    ai_rows = await conn.fetch(
        """
        SELECT a.snapshot_id, a.created_at, a.summary, c.case_key
        FROM aiops.ai_summaries a
        JOIN aiops.snapshots s ON s.id = a.snapshot_id
        JOIN aiops.cases c ON c.id = s.case_id
        WHERE a.created_at >= $1 AND a.created_at <= $2
        ORDER BY a.created_at DESC
        LIMIT 3
        """,
        period_start,
        period_end,
    )
    ai_highlights_seed = []
    for r in ai_rows:
        summary_text = r["summary"] or ""
        summary_preview = (summary_text[:100]) if len(summary_text) > 100 else summary_text
        ai_highlights_seed.append({
            "snapshot_id": r["snapshot_id"],
            "case_key": r["case_key"] or "",
            "summary_preview": summary_preview,
            "created_at": _format_dt_iso8601(r["created_at"]),
        })

    return {
        "period": {
            "start": _format_dt_iso8601(period_start),
            "end": _format_dt_iso8601(period_end),
            "days": days,
        },
        "totals": {
            "total_cases": total_cases,
            "resolved_cases": resolved_cases,
            "resolution_rate": round(resolution_rate, 4),
        },
        "trend_daily": trend_daily,
        "by_layer": by_layer,
        "by_severity": by_severity,
        "top_services": top_services,
        "top_alertnames": top_alertnames,
        "latest_cases": latest_cases,
        "ai_highlights_seed": ai_highlights_seed,
    }
