"""Alertmanager webhook and health."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from database import get_pool
from schemas import AMWebhookPayload
from services import CaseKeyValidationError, process_webhook

router = APIRouter()


async def get_conn():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.post("/webhook/alertmanager")
async def alertmanager_webhook(payload: AMWebhookPayload, conn=Depends(get_conn)):
    if not payload.alerts:
        return JSONResponse(content={"ok": True, "alerts_processed": 0, "cases_touched": 0})
    try:
        result = await process_webhook(conn, payload)
        return JSONResponse(content=result)
    except CaseKeyValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
