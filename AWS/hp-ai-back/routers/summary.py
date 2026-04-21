"""Summary API: home/layer 집계, AI 요약 (집계만 입력), Home Snapshot."""
import asyncio
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from config import settings
from database import get_pool
from services import (
    get_summary_home,
    get_summary_layer,
    insert_home_snapshot,
    get_latest_home_snapshot,
    insert_home_layer_snapshot,
    get_latest_home_layer_snapshots,
)
from collector import run_home_collector, run_layer_collectors
from schemas import HomeSnapshotOut, HomeLayerSnapshotOut
from bedrock_ai import generate_summary_ai, generate_summary_ai_home_layers

router = APIRouter(prefix="/summary", tags=["summary"])


async def get_conn():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


@router.get("/home")
async def summary_home(
    conn=Depends(get_conn),
    status: str = Query("open", description="open | resolved"),
):
    """집계: total_open, by_layer, by_severity, top_services(5), recently_updated(5). layer IS NOT NULL인 케이스만."""
    data = await get_summary_home(conn, status=status)
    return data


@router.get("/layer/{layer}")
async def summary_layer(
    layer: str,
    conn=Depends(get_conn),
    status: str = Query("open", description="open | resolved"),
):
    """지정 layer 집계: layer, total_open, by_severity, top_services(5), recently_updated(5)."""
    data = await get_summary_layer(conn, layer, status=status)
    return data


@router.post("/home/ai")
async def summary_home_ai(conn=Depends(get_conn)):
    """GET /summary/home 결과(집계만)를 Bedrock에 넣어 2~3줄 한국어 요약 생성. 저장/캐시 없음."""
    if not settings.bedrock_model_id:
        raise HTTPException(status_code=500, detail="BEDROCK_MODEL_ID not configured")
    data = await get_summary_home(conn, status="open")
    try:
        summary = generate_summary_ai(
            data,
            settings.bedrock_model_id,
            settings.aws_region,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"summary": summary}


@router.post("/layer/{layer}/ai")
async def summary_layer_ai(
    layer: str,
    conn=Depends(get_conn),
):
    """GET /summary/layer/{layer} 결과(집계만)를 Bedrock에 넣어 2~3줄 한국어 요약 생성. 저장/캐시 없음."""
    if not settings.bedrock_model_id:
        raise HTTPException(status_code=500, detail="BEDROCK_MODEL_ID not configured")
    data = await get_summary_layer(conn, layer, status="open")
    try:
        summary = generate_summary_ai(
            data,
            settings.bedrock_model_id,
            settings.aws_region,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"summary": summary}


# ----- Home Snapshot (DB 저장, 14일 TTL) -----

def _row_to_home_snapshot(row) -> HomeSnapshotOut:
    """asyncpg Record -> HomeSnapshotOut. prom/loki/tempo는 _to_dict_or_none으로 dict|None 보장 (jsonb str 대비)."""
    r = dict(row)
    return HomeSnapshotOut(
        id=r["id"],
        created_at=r["created_at"],
        window_from=r["window_from"],
        window_to=r["window_to"],
        expires_at=r["expires_at"],
        prom_status=r["prom_status"],
        prom_error=r.get("prom_error"),
        prom=_to_dict_or_none(r.get("prom")),
        loki_status=r["loki_status"],
        loki_error=r.get("loki_error"),
        loki=_to_dict_or_none(r.get("loki")),
        tempo_status=r["tempo_status"],
        tempo_error=r.get("tempo_error"),
        tempo=_to_dict_or_none(r.get("tempo")),
    )


@router.post("/home/snapshot", response_model=HomeSnapshotOut)
async def create_home_snapshot(conn=Depends(get_conn)):
    """window: now-30m~now, expires_at: now+14d. Prom/Loki/Tempo 수집 후 home_snapshots에 INSERT."""
    now = datetime.now(timezone.utc)
    window_from = now - timedelta(minutes=30)
    window_to = now
    expires_at = now + timedelta(days=14)
    coll = await run_home_collector(
        settings.prom_url,
        settings.loki_url,
        settings.tempo_url,
    )
    row = await insert_home_snapshot(
        conn,
        window_from=window_from,
        window_to=window_to,
        expires_at=expires_at,
        prom_status=coll["prom_status"],
        prom_error=coll.get("prom_error"),
        prom=coll["prom"],
        loki_status=coll["loki_status"],
        loki_error=coll.get("loki_error"),
        loki=coll["loki"],
        tempo_status=coll["tempo_status"],
        tempo_error=coll.get("tempo_error"),
        tempo=coll["tempo"],
    )
    return _row_to_home_snapshot(row)


@router.get("/home/snapshot/latest", response_model=HomeSnapshotOut | None)
async def get_home_snapshot_latest(conn=Depends(get_conn)):
    """최신 home_snapshot 1건. 없으면 null."""
    row = await get_latest_home_snapshot(conn)
    if not row:
        return None
    return _row_to_home_snapshot(row)


# ----- Home Layer Snapshots (infra / observability / application) -----

DEFAULT_LAYERS = ["infrastructure", "platform", "delivery", "observability", "data", "application", "ux"]


def _to_dict_or_none(v):
    """prom/loki/tempo 등 jsonb가 str(JSON 문자열)로 올 수 있으므로 dict|None으로 통일."""
    if v is None:
        return None
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        try:
            out = json.loads(v)
            return out if isinstance(out, dict) else None
        except (json.JSONDecodeError, TypeError):
            return None
    try:
        if hasattr(v, "items"):
            return dict(v)
    except (TypeError, ValueError):
        pass
    return None


def _row_to_layer_snapshot(row) -> HomeLayerSnapshotOut:
    """asyncpg Record → response. prom/loki/tempo는 _to_dict_or_none으로 dict|None 보장."""
    r = dict(row)
    return HomeLayerSnapshotOut(
        id=r["id"],
        created_at=r["created_at"],
        layer=r["layer"],
        window_from=r["window_from"],
        window_to=r["window_to"],
        expires_at=r["expires_at"],
        prom_status=r["prom_status"],
        prom_error=r.get("prom_error"),
        prom=_to_dict_or_none(r["prom"]),
        loki_status=r["loki_status"],
        loki_error=r.get("loki_error"),
        loki=_to_dict_or_none(r["loki"]),
        tempo_status=r["tempo_status"],
        tempo_error=r.get("tempo_error"),
        tempo=_to_dict_or_none(r["tempo"]),
    )


@router.post("/home/layers/snapshot")
async def create_home_layers_snapshot(
    conn=Depends(get_conn),
    layers: list[str] = Query(default=DEFAULT_LAYERS, description="infrastructure, observability, application"),
):
    """각 layer별 수집 후 home_layer_snapshots에 3건 INSERT. 반환: { snapshots: [...] }."""
    now = datetime.now(timezone.utc)
    window_from = now - timedelta(minutes=30)
    window_to = now
    expires_at = now + timedelta(days=14)
    to_run = [l for l in layers if l in DEFAULT_LAYERS] or DEFAULT_LAYERS
    colls = await run_layer_collectors(
        settings.prom_url,
        settings.loki_url,
        settings.tempo_url,
        to_run,
        settings.app_layer_namespace,
        window_from,
        window_to,
    )
    snapshots_out = []
    for c in colls:
        row = await insert_home_layer_snapshot(
            conn,
            layer=c["layer"],
            window_from=window_from,
            window_to=window_to,
            expires_at=expires_at,
            prom_status=c["prom_status"],
            prom_error=c.get("prom_error"),
            prom=c["prom"],
            loki_status=c["loki_status"],
            loki_error=c.get("loki_error"),
            loki=c["loki"],
            tempo_status=c["tempo_status"],
            tempo_error=c.get("tempo_error"),
            tempo=c["tempo"],
        )
        snapshots_out.append(_row_to_layer_snapshot(row))
    return {"snapshots": snapshots_out}


@router.get("/home/layers/snapshot/latest")
async def get_home_layers_snapshot_latest(
    conn=Depends(get_conn),
    layers: list[str] = Query(default=DEFAULT_LAYERS, description="layer names"),
):
    """각 layer별 최신 1건씩 반환. 없으면 빈 배열."""
    to_fetch = [l for l in layers if l in DEFAULT_LAYERS] or DEFAULT_LAYERS
    rows = await get_latest_home_layer_snapshots(conn, to_fetch)
    return {"snapshots": [_row_to_layer_snapshot(r) for r in rows]}


def _layer_snapshot_for_ai(row) -> dict:
    """AI 입력용: status + stats만 (series/원문 제외)."""
    r = dict(row)
    prom = _to_dict_or_none(r["prom"])
    stats = (prom.get("stats") or []) if prom else []
    return {
        "layer": r["layer"],
        "prom_status": r["prom_status"],
        "prom_error": r.get("prom_error"),
        "loki_status": r["loki_status"],
        "tempo_status": r["tempo_status"],
        "stats": stats,
    }


@router.post("/home/layers/ai")
async def summary_home_layers_ai(conn=Depends(get_conn)):
    """open 집계 + 최신 3개 레이어 스냅샷(핵심만)으로 6줄 한국어 요약. layer snapshot 1개도 없으면 400."""
    if not settings.bedrock_model_id:
        raise HTTPException(status_code=500, detail="BEDROCK_MODEL_ID not configured")
    aggregation = await get_summary_home(conn, status="open")
    rows = await get_latest_home_layer_snapshots(conn, DEFAULT_LAYERS)
    if not rows:
        raise HTTPException(
            status_code=400,
            detail="No layer snapshots. Create them via POST /summary/home/layers/snapshot first.",
        )
    layer_summary = [_layer_snapshot_for_ai(r) for r in rows]
    try:
        summary = await asyncio.to_thread(
            generate_summary_ai_home_layers,
            aggregation,
            layer_summary,
            settings.bedrock_model_id,
            settings.aws_region,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"summary": summary}


@router.post("/home/snapshot/latest/ai")
async def summary_home_snapshot_latest_ai(conn=Depends(get_conn)):
    """최신 home_snapshot의 prom/loki/tempo status+error + open 케이스 수·by_layer를 Bedrock에 넣어 2~3문장 한국어 요약. snapshot 없으면 404."""
    if not settings.bedrock_model_id:
        raise HTTPException(status_code=500, detail="BEDROCK_MODEL_ID not configured")
    row = await get_latest_home_snapshot(conn)
    if not row:
        raise HTTPException(status_code=404, detail="No home snapshot. Create one via POST /summary/home/snapshot first.")
    home_data = await get_summary_home(conn, status="open")
    payload = {
        "snapshot": {
            "prom_status": row["prom_status"],
            "prom_error": row.get("prom_error"),
            "loki_status": row["loki_status"],
            "loki_error": row.get("loki_error"),
            "tempo_status": row["tempo_status"],
            "tempo_error": row.get("tempo_error"),
        },
        "total_open": home_data["total_open"],
        "by_layer": home_data["by_layer"],
    }
    try:
        summary = await asyncio.to_thread(
            generate_summary_ai,
            payload,
            settings.bedrock_model_id,
            settings.aws_region,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"summary": summary}
