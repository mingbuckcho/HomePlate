"""Cases list, detail, refresh."""
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_pool
from schemas import (
    AlertEventOut,
    CaseBrief,
    CaseDetailResponse,
    CaseListItem,
    SnapshotOut,
    AISummaryOut,
)
from services import get_case_detail, list_cases, refresh_case_snapshot

router = APIRouter()


async def get_conn():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


def _record_to_case_brief(r: Any) -> CaseBrief:
    return CaseBrief(
        id=r["id"],
        case_key=r["case_key"],
        status=r["status"],
        severity=r["severity"],
        layer=r.get("layer"),
        cluster=r["cluster"],
        environment=r["environment"],
        namespace=r["namespace"],
        service=r["service"],
        started_at=r["started_at"],
        last_seen_at=r["last_seen_at"],
    )


def _ensure_dict(v: Any) -> dict[str, Any] | None:
    """JSONB may come back as str from DB; normalize to dict or None for Pydantic."""
    if v is None:
        return None
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v) if v.strip() else None
        except (json.JSONDecodeError, ValueError):
            return None
    return None


def _record_to_case_list_item(r: Any) -> CaseListItem:
    return CaseListItem(
        id=r["id"],
        case_key=r["case_key"],
        status=r["status"],
        severity=r["severity"],
        layer=r.get("layer"),
        cluster=r["cluster"],
        environment=r["environment"],
        namespace=r["namespace"],
        service=r["service"],
        started_at=r["started_at"],
        last_seen_at=r["last_seen_at"],
    )


@router.get("/cases")
async def cases_list(
    conn=Depends(get_conn),
    status: str | None = Query(None, description="open | resolved"),
    severity: str | None = Query(None),
    layer: str | None = Query(None, description="infrastructure|delivery|observability|data|ux|application|unknown"),
    namespace: str | None = Query(None),
    service: str | None = Query(None),
    time_from: datetime | None = Query(None),
    time_to: datetime | None = Query(None),
    search: str | None = Query(None, description="case_key or alertname search"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    rows = await list_cases(
        conn,
        status=status,
        severity=severity,
        layer=layer,
        namespace=namespace,
        service=service,
        time_from=time_from,
        time_to=time_to,
        search=search,
        limit=limit,
        offset=offset,
    )
    return {"items": [_record_to_case_list_item(r) for r in rows]}


@router.get("/cases/{case_id}", response_model=CaseDetailResponse)
async def case_detail(
    case_id: int,
    conn=Depends(get_conn),
    alert_events_limit: int = Query(50, ge=1, le=200),
):
    case, events, snapshot, ai_summary = await get_case_detail(
        conn, case_id, alert_events_limit=alert_events_limit
    )
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    snapshot_out = None
    if snapshot:
        snapshot_out = SnapshotOut(
            id=snapshot["id"],
            created_at=snapshot["created_at"],
            window_from=snapshot["window_from"],
            window_to=snapshot["window_to"],
            prom_status=snapshot["prom_status"],
            prom_error=snapshot.get("prom_error"),
            prom=_ensure_dict(snapshot.get("prom")),
            loki_status=snapshot["loki_status"],
            loki_error=snapshot.get("loki_error"),
            loki=_ensure_dict(snapshot.get("loki")),
            tempo_status=snapshot["tempo_status"],
            tempo_error=snapshot.get("tempo_error"),
            tempo=_ensure_dict(snapshot.get("tempo")),
        )
    ai_summary_out = None
    if ai_summary:
        ai_summary_out = AISummaryOut(
            summary=ai_summary["summary"],
            evidence=ai_summary.get("evidence"),
            checks=ai_summary.get("checks"),
            advice=ai_summary.get("advice"),
        )
    return CaseDetailResponse(
        case=_record_to_case_brief(case),
        alert_events=[
            AlertEventOut(
                received_at=e["received_at"],
                am_status=e["am_status"],
                alertname=e["alertname"],
                labels=_ensure_dict(e.get("labels")) or {},
                annotations=_ensure_dict(e.get("annotations")) or {},
            )
            for e in events
        ],
        snapshot=snapshot_out,
        ai_summary=ai_summary_out,
    )


@router.post("/cases/{case_id}/refresh")
async def case_refresh(case_id: int, conn=Depends(get_conn)):
    snapshot = await refresh_case_snapshot(conn, case_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Case not found")
    return {
        "ok": True,
        "snapshot_id": snapshot["id"],
        "window_from": snapshot["window_from"],
        "window_to": snapshot["window_to"],
        "expires_at": snapshot["expires_at"],
    }
