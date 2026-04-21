"""Snapshots: AI summary (Phase2, on-demand, UPSERT). Bedrock (Claude) 연동."""
import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException

from config import settings
from database import get_pool
from schemas import AISummaryCreate

from bedrock_ai import generate_ai_summary
from bedrock_embed import build_doc_text, generate_embedding

logger = logging.getLogger(__name__)

router = APIRouter()


async def get_conn():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


@router.post("/snapshots/{snapshot_id}/ai-summary")
async def create_ai_summary(
    snapshot_id: int,
    body: AISummaryCreate | None = None,
    conn=Depends(get_conn),
):
    """갱신: 바디 없으면 Bedrock 호출 후 UPSERT. 바디 있으면 그대로 저장(테스트/수동)."""
    from services import upsert_ai_summary

    row = await conn.fetchrow(
        """
        SELECT s.id, s.window_from, s.window_to,
               s.prom_status, s.prom_error, s.prom,
               s.loki_status, s.loki_error, s.loki,
               s.tempo_status, s.tempo_error, s.tempo,
               c.service, c.namespace, c.severity, c.status
        FROM aiops.snapshots s
        JOIN aiops.cases c ON c.id = s.case_id
        WHERE s.id = $1
        """,
        snapshot_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    if body:
        summary = body.summary
        evidence = body.evidence
        checks = body.checks
        advice = body.advice
        raw = body.raw
        model = body.model or "manual"
        prompt_version = body.prompt_version or "v0"
    else:
        if not settings.bedrock_model_id:
            raise HTTPException(
                status_code=500,
                detail="BEDROCK_MODEL_ID가 설정되지 않았습니다. .env에 BEDROCK_MODEL_ID를 설정하세요.",
            )
        case_meta = {
            "service": row["service"],
            "namespace": row["namespace"],
            "severity": row["severity"],
            "status": row["status"],
        }
        snapshot_dict = dict(row)
        try:
            summary, evidence, checks, advice = await asyncio.to_thread(
                generate_ai_summary,
                case_meta,
                snapshot_dict,
                settings.bedrock_model_id,
                settings.aws_region,
            )
        except RuntimeError as e:
            logger.warning("Bedrock AI summary failed: %s", e)
            raise HTTPException(status_code=502, detail=str(e)) from e
        except Exception as e:
            logger.exception("AI summary unexpected error")
            raise HTTPException(status_code=502, detail=f"AI 요약 생성 실패: {e}") from e
        raw = None
        model = "bedrock"
        prompt_version = "v1"

    saved = await upsert_ai_summary(
        conn,
        snapshot_id,
        model=model,
        prompt_version=prompt_version,
        summary=summary,
        evidence=evidence,
        checks=checks,
        advice=advice,
        raw=raw,
    )
    # Phase2-2: RAG embedding 저장 (실패 시 로그만, ai_summary는 이미 성공)
    if getattr(settings, "enable_rag_embedding", False):
        try:
            doc_text = build_doc_text(
                saved["summary"],
                saved.get("evidence"),
                saved.get("checks"),
                saved.get("advice"),
            )
            vec = await asyncio.to_thread(generate_embedding, doc_text)
            from services import save_ai_summary_embedding
            await save_ai_summary_embedding(conn, snapshot_id, vec)
        except Exception as e:
            logger.warning(
                "embedding_save_failed snapshot_id=%s err=%s",
                snapshot_id,
                e,
            )
    return {
        "snapshot_id": snapshot_id,
        "ai_summary_id": saved["id"],
        "summary": saved["summary"],
        "evidence": saved["evidence"],
        "checks": saved["checks"],
        "advice": saved["advice"],
    }


@router.post("/snapshots/{snapshot_id}/ai-summary/refresh")
async def refresh_ai_summary(snapshot_id: int, conn=Depends(get_conn)):
    """캐시 무시, 항상 Bedrock 재호출 후 UPSERT. POST /snapshots/{id}/ai-summary 와 동일(바디 없음)."""
    return await create_ai_summary(snapshot_id, body=None, conn=conn)
