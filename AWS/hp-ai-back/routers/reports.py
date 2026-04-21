"""Weekly reports aggregation API (browser report tab)."""
import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from config import settings
from database import get_pool
from services import get_weekly_report, find_similar_ai_summaries

router = APIRouter(prefix="/reports", tags=["reports"])


async def get_conn():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


@router.get("/weekly")
async def weekly_report(
    end: str | None = Query(None, description="End time ISO8601 (optional), default now"),
    days: int = Query(7, ge=1, le=31, description="Number of days"),
    conn=Depends(get_conn),
):
    """
    GET /reports/weekly?end=<ISO8601 optional>&days=7
    Aggregation by alert_events.received_at in [period_start, period_end].
    """
    try:
        if end:
            period_end = datetime.fromisoformat(end.replace("Z", "+00:00"))
            if period_end.tzinfo is None:
                period_end = period_end.replace(tzinfo=timezone.utc)
        else:
            period_end = datetime.now(timezone.utc)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid end parameter (expect ISO8601)")

    period_start = period_end - timedelta(days=days)

    try:
        data = await get_weekly_report(
            conn,
            period_start=period_start,
            period_end=period_end,
            days=days,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report aggregation failed: {e!s}") from e

    return data


def _aggregation_to_rag_text(data: dict) -> str:
    """집계 JSON을 RAG embedding 입력용 짧은 텍스트로 변환."""
    parts = []
    totals = data.get("totals") or {}
    parts.append(
        f"total_cases={totals.get('total_cases', 0)} "
        f"resolved_cases={totals.get('resolved_cases', 0)} "
        f"resolution_rate={totals.get('resolution_rate', 0)}"
    )
    layer_items = data.get("by_layer") or []
    parts.append("by_layer: " + ", ".join(f"{x.get('layer', '')}={x.get('count', 0)}" for x in layer_items))
    sev_items = data.get("by_severity") or []
    parts.append("by_severity: " + ", ".join(f"{x.get('severity', '')}={x.get('count', 0)}" for x in sev_items))
    top_svc = data.get("top_services") or []
    parts.append("top_services: " + ", ".join(f"{s.get('namespace')}/{s.get('service')}({s.get('count')})" for s in top_svc))
    top_alert = data.get("top_alertnames") or []
    parts.append("top_alertnames: " + ", ".join(f"{a.get('alertname')}({a.get('count')})" for a in top_alert))
    return "\n".join(parts)


@router.get("/weekly/similar")
async def weekly_similar(
    days: int = Query(7, ge=1, le=31),
    conn=Depends(get_conn),
):
    """디버그용: 주간 집계 요약으로 embedding 생성 후 유사 케이스 top3."""
    try:
        period_end = datetime.now(timezone.utc)
        period_start = period_end - timedelta(days=days)
        data = await get_weekly_report(
            conn,
            period_start=period_start,
            period_end=period_end,
            days=days,
        )
        rag_text = _aggregation_to_rag_text(data)
        similar = await find_similar_ai_summaries(conn, rag_text, top_k=3)
        return {"aggregation_summary": rag_text[:500], "similar": similar}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/weekly/ai")
async def weekly_ai(
    body: dict | None = None,
    conn=Depends(get_conn),
):
    """
    POST /reports/weekly/ai
    입력: { "end"?: ISO, "days"?: int }. 집계 JSON + RAG top3 → Bedrock → highlights 3개, summary 1개.
    """
    from datetime import timedelta

    from bedrock_ai import invoke_bedrock_report, parse_report_ai_response

    params = body or {}
    end = params.get("end")
    days = int(params.get("days", 7))
    if days < 1 or days > 31:
        raise HTTPException(status_code=400, detail="days must be 1..31")

    try:
        if end:
            period_end = datetime.fromisoformat(end.replace("Z", "+00:00"))
            if period_end.tzinfo is None:
                period_end = period_end.replace(tzinfo=timezone.utc)
        else:
            period_end = datetime.now(timezone.utc)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid end (expect ISO8601)")

    period_start = period_end - timedelta(days=days)
    data = await get_weekly_report(
        conn,
        period_start=period_start,
        period_end=period_end,
        days=days,
    )
    rag_text = _aggregation_to_rag_text(data)
    try:
        similar = await find_similar_ai_summaries(conn, rag_text, top_k=3)
    except Exception:
        similar = []  # RAG 실패 시에도 weekly_ai 200 유지

    if not settings.bedrock_model_id:
        raise HTTPException(status_code=500, detail="BEDROCK_MODEL_ID not set")

    similar_blob = "\n".join(
        f"- case_key: {s['case_key']}, created_at: {s['created_at']}\n  summary_preview: {s['summary_preview']}"
        for s in similar
    )
    aggregation_blob = rag_text[:3000]
    user_prompt = f"""주간 집계 요약:
{aggregation_blob}

유사 케이스 (RAG top3):
{similar_blob or '(없음)'}

위만 보고 한국어로 답하세요. 추측 금지. 근거 없으면 "데이터 없음".
반드시 아래 JSON 단일 객체만 출력 (마크다운 없음):
{{ "highlights": [
  {{ "title": "HIGHLIGHT 1", "text": "2~3문장 요약" }},
  {{ "title": "HIGHLIGHT 2", "text": "2~3문장 요약" }},
  {{ "title": "HIGHLIGHT 3", "text": "2~3문장 요약" }}
], "summary": "전체 결론 1~2문장" }}
"""
    system_instruction = """You are an AIOps report assistant. Output only in Korean.
Output a single JSON object only: {"highlights": [{"title":"HIGHLIGHT 1","text":"..."}, ... 3 items], "summary": "..."}.
No markdown. Do not guess; if no data, say "데이터 없음"."""
    try:
        raw = await asyncio.to_thread(
            invoke_bedrock_report,
            system_instruction,
            user_prompt,
            settings.bedrock_model_id,
            settings.aws_region,
        )
        out = parse_report_ai_response(raw)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Report AI failed: {e!s}") from e
    return out
