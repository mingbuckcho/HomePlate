"""Titan embedding for RAG. ai_summaries.embedding 저장 및 유사 케이스 검색용."""
import json
import logging
from typing import Any

import boto3
import botocore.exceptions

from config import settings

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 1024
MAX_DOC_LEN = 8000
MAX_SECTION_LEN = 2000


def build_doc_text(
    summary: str,
    evidence: Any,
    checks: Any,
    advice: Any,
) -> str:
    """
    문서 텍스트 구성(B안). summary 그대로, evidence/checks/advice는 JSON 직렬화.
    각 섹션 최대 2000자, 전체 최대 8000자.
    """
    def _truncate(s: str, max_len: int) -> str:
        if not s or len(s) <= max_len:
            return s or ""
        return s[:max_len].rstrip() + "..."

    def _section(name: str, obj: Any) -> str:
        if obj is None:
            return f"{name}:\nnull"
        if isinstance(obj, str):
            try:
                obj = json.loads(obj)
            except (json.JSONDecodeError, TypeError):
                pass
        raw = json.dumps(obj, ensure_ascii=False) if not isinstance(obj, str) else obj
        return f"{name}:\n{_truncate(raw, MAX_SECTION_LEN)}"

    parts = [
        f"SUMMARY:\n{_truncate(summary or "", MAX_SECTION_LEN)}",
        _section("EVIDENCE", evidence),
        _section("CHECKS", checks),
        _section("ADVICE", advice),
    ]
    out = "\n\n".join(parts)
    if len(out) > MAX_DOC_LEN:
        out = out[:MAX_DOC_LEN].rstrip() + "..."
    return out


def generate_embedding(text: str) -> list[float] | None:
    """
    Titan Embeddings로 텍스트 임베딩 생성. 1024차원 벡터 반환.
    차원 불일치 시 로그만 남기고 None 반환 (graceful fallback).
    """
    if not text or not text.strip():
        raise ValueError("embedding input text is empty")
    client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
    body = {"inputText": text.strip()}
    try:
        response = client.invoke_model(
            modelId=settings.embed_model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body).encode("utf-8"),
        )
    except botocore.exceptions.ClientError as e:
        msg = e.response.get("Error", {}).get("Message", str(e))
        raise RuntimeError(f"Titan embedding 호출 실패: {msg}") from e
    except Exception as e:
        raise RuntimeError(f"Titan embedding 호출 실패: {e}") from e

    out = json.loads(response["body"].read())
    embedding = out.get("embedding")
    if not isinstance(embedding, list) or len(embedding) != EMBEDDING_DIM:
        logger.warning(
            "Titan embedding dimension mismatch: expected %s, got %s",
            EMBEDDING_DIM,
            len(embedding) if isinstance(embedding, list) else type(embedding).__name__,
        )
        return None
    return [float(x) for x in embedding]
