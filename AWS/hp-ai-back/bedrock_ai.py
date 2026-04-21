"""Bedrock (Claude) AI summary generation for snapshots. Phase2. 스냅샷 요약본 기반 입력 축소."""
import json
import re
from typing import Any

import boto3
import botocore.exceptions

# Case AI Summary: POST /snapshots/{id}/ai-summary, /refresh. 고정 8줄, 각 줄 "- "로 시작.
SYSTEM_INSTRUCTION = """You are an AIOps assistant.

공통 원칙: (1) 출력은 반드시 한국어. (2) 추측 금지. 근거(스냅샷 요약)에 없는 내용은 "데이터 없음"으로 명시. (3) 줄 수는 절대 줄이지 말 것. 데이터가 없어도 지정 줄 수를 반드시 채울 것. (4) 각 줄은 반드시 "- "로 시작.

Respond only with a single JSON object: {"summary": "...", "evidence": [...], "checks": [...], "advice": [...]}. No markdown.

Case summary: 정확히 8줄. 8줄 구성(순서 고정):
1) 요약(Severity/Status 포함) + 한 줄 결론
2) 범위(서비스/네임스페이스/시간창)
3) 메트릭 핵심(Ready/NotReady/Restarts/CPU/Mem 최신값; 없으면 "데이터 없음")
4) 로그 핵심(ERROR/WARN 20줄에서 반복 패턴/키워드; 없으면 "데이터 없음")
5) 트레이스 핵심(Tempo 10개 요약: 느린 trace/에러 유무; 없으면 "데이터 없음")
6) 확인1(즉시 확인할 1순위)
7) 확인2(2순위)
8) 확인3(3순위)"""


def _to_dict_safe(v: Any) -> dict[str, Any] | None:
    """jsonb 등이 str로 올 수 있으므로 dict|None으로 통일."""
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
    if hasattr(v, "items"):
        try:
            return dict(v)
        except (TypeError, ValueError):
            pass
    return None


def build_snapshot_summary_for_ai(snapshot: dict[str, Any], case_meta: dict[str, Any]) -> dict[str, Any]:
    """스냅샷 전체가 아닌 요약만 추출: Prom stats(6~10)+latest from series, Loki 20줄, Tempo 10개. series 배열은 절대 포함하지 않음."""
    prom = _to_dict_safe(snapshot.get("prom"))
    loki = _to_dict_safe(snapshot.get("loki"))
    tempo = _to_dict_safe(snapshot.get("tempo"))

    prom_summary: dict[str, Any] = {
        "prom_status": snapshot.get("prom_status") or "-",
        "prom_error": snapshot.get("prom_error"),
        "stats": [],
    }
    if prom:
        stats = list(prom.get("stats") or [])[:10]
        prom_summary["stats"] = [{"name": s.get("name"), "value": s.get("value")} for s in stats if isinstance(s, dict)]
        series_list = prom.get("series") or []
        for s in series_list:
            if not isinstance(s, dict):
                continue
            values = s.get("values") or []
            if not values:
                continue
            last = values[-1]
            if not isinstance(last, (list, tuple)) or len(last) < 2:
                continue
            try:
                val = float(last[1])
            except (TypeError, ValueError):
                continue
            name = (s.get("_metric_name") or "").lower()
            if "cpu" in name:
                prom_summary["stats"].append({"name": "cpu_latest", "value": val, "unit": "cores"})
            elif "mem" in name or "memory" in name:
                prom_summary["stats"].append({"name": "mem_latest", "value": val, "unit": "bytes"})
    if not prom_summary["stats"]:
        prom_summary["stats"] = [{"name": "(no stats)", "value": None}]

    loki_summary: list[dict[str, Any]] = []
    recent_logs = (loki or {}).get("recent_logs") or []
    for entry in list(recent_logs)[:20]:
        if not isinstance(entry, dict):
            continue
        line = entry.get("line") or ""
        row: dict[str, Any] = {"@timestamp": entry.get("ts")}
        if isinstance(line, str) and line.strip().startswith("{"):
            try:
                parsed = json.loads(line)
                if isinstance(parsed, dict):
                    for key in ("level", "logger", "method", "path", "status", "duration_ms", "trace_id", "message"):
                        v = parsed.get(key) or parsed.get(key.replace("_", ""))
                        if v is not None:
                            if key == "message" and isinstance(v, str) and len(v) > 200:
                                v = v[:200] + "..."
                            row[key] = v
            except json.JSONDecodeError:
                row["message"] = (line[:200] + "...") if len(line) > 200 else line
        else:
            row["message"] = (line[:200] + "...") if len(line) > 200 else line
        loki_summary.append(row)
    if not loki_summary:
        loki_summary = [{"message": "(no logs)"}]

    tempo_summary: list[dict[str, Any]] = []
    traces = (tempo or {}).get("traces") or []
    for t in list(traces)[:20]:
        if not isinstance(t, dict):
            continue
        tempo_summary.append({
            "traceId": t.get("traceID") or t.get("traceId") or t.get("trace_id"),
            "durationMs": t.get("durationMs") or t.get("duration_ms") or t.get("duration"),
            "rootSpanName": t.get("rootSpanName") or t.get("root_span_name") or t.get("rootServiceName") or t.get("root_service_name"),
            "startTime": t.get("startTime") or t.get("start_time"),
        })
    if tempo_summary:
        by_dur = sorted(
            [x for x in tempo_summary if x.get("durationMs") is not None],
            key=lambda x: float(x["durationMs"]) if x.get("durationMs") is not None else 0,
            reverse=True,
        )
        tempo_summary = by_dur[:10]
    if not tempo_summary:
        tempo_summary = [{"note": "(no traces)"}]

    return {
        "case_meta": {
            "service": case_meta.get("service") or "-",
            "namespace": case_meta.get("namespace") or "-",
            "severity": case_meta.get("severity") or "-",
            "status": case_meta.get("status") or "-",
            "window_from": str(snapshot.get("window_from") or ""),
            "window_to": str(snapshot.get("window_to") or ""),
        },
        "prom_summary": prom_summary,
        "loki_summary": loki_summary,
        "tempo_summary": tempo_summary,
    }


def _build_prompt_from_summary(snapshot_summary: dict[str, Any]) -> str:
    """스냅샷 요약본만으로 프롬프트 구성. 시계열 전체/원문 미포함."""
    lines = [
        "## Case",
        json.dumps(snapshot_summary.get("case_meta") or {}, ensure_ascii=False),
        "",
        "## Prometheus (요약: status, stats, cpu_latest/mem_latest만)",
        json.dumps(snapshot_summary.get("prom_summary") or {}, ensure_ascii=False),
        "",
        "## Loki (최근 20줄, 필드 제한)",
        json.dumps(snapshot_summary.get("loki_summary") or [], ensure_ascii=False),
        "",
        "## Tempo (최대 10개 trace)",
        json.dumps(snapshot_summary.get("tempo_summary") or [], ensure_ascii=False),
        "",
        "위 스냅샷 증거만 보고 JSON으로 답하세요. summary는 정확히 8줄(순서: 요약+결론 → 범위 → 메트릭 → 로그 → 트레이스 → 확인1 → 확인2 → 확인3), 각 줄 '- '로 시작. evidence, checks, advice 포함. 추측 금지, 없는 데이터는 해당 줄 '데이터 없음'.",
    ]
    return "\n".join(lines)


def invoke_bedrock(prompt: str, model_id: str, region: str) -> str:
    """Call Bedrock Claude. Returns response text. Raises on API/network errors."""
    client = boto3.client("bedrock-runtime", region_name=region)
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "temperature": 0.3,
        "system": SYSTEM_INSTRUCTION,
        "messages": [{"role": "user", "content": prompt}],
    }
    try:
        response = client.invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body).encode("utf-8"),
        )
    except botocore.exceptions.ClientError as e:
        msg = e.response.get("Error", {}).get("Message", str(e))
        raise RuntimeError(f"Bedrock 호출 실패: {msg}") from e
    except Exception as e:
        raise RuntimeError(f"Bedrock 호출 실패: {e}") from e

    out = json.loads(response["body"].read())
    content = out.get("content") or []
    if not content:
        raise RuntimeError("Bedrock 응답에 content가 없습니다.")
    text = content[0].get("text", "")
    if not text:
        raise RuntimeError("Bedrock 응답 텍스트가 비어 있습니다.")
    return text.strip()


def _extract_json_block(text: str) -> str:
    """Strip markdown code fence (```json ... ```) and return inner text."""
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    # Remove first line (e.g. ```json or ```)
    first_newline = stripped.find("\n")
    if first_newline != -1:
        stripped = stripped[first_newline + 1 :].strip()
    # Remove trailing ```
    if stripped.endswith("```"):
        stripped = stripped[:-3].strip()
    return stripped


def _extract_summary_from_raw(text: str) -> str | None:
    """Try to extract summary value from truncated or complete JSON. Returns None if not found."""
    # 1) Complete "summary": "..." with possible escaped quotes
    m = re.search(r'"summary"\s*:\s*"((?:[^"\\]|\\.)*)"', text, re.DOTALL)
    if m:
        try:
            return m.group(1).encode().decode("unicode_escape")[:4000]
        except Exception:
            return m.group(1)[:4000]
    # 2) Truncated: "summary": "..." without closing quote (response cut off)
    m = re.search(r'"summary"\s*:\s*"([\s\S]{0,4000})', text)
    if m:
        raw = m.group(1)
        try:
            raw = raw.encode().decode("unicode_escape")
        except Exception:
            pass
        return raw[:4000].strip() or None
    return None


def parse_ai_response(text: str) -> dict[str, Any]:
    """Parse LLM JSON. Returns dict with summary, evidence, checks, advice. On failure returns fallback."""
    stripped = _extract_json_block(text)
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            partial = _extract_summary_from_raw(text)
            if partial:
                return {
                    "summary": partial + "\n\n(응답이 잘려 나머지 항목은 표시되지 않았습니다.)",
                    "evidence": None,
                    "checks": None,
                    "advice": None,
                }
            return {
                "summary": "AI 응답 파싱 실패. 응답이 잘렸거나 JSON 형식이 올바르지 않습니다.",
                "evidence": None,
                "checks": None,
                "advice": None,
            }

    if not isinstance(data, dict):
        return {
            "summary": "AI 응답 파싱 실패. (JSON이 객체가 아님)",
            "evidence": None,
            "checks": None,
            "advice": None,
        }

    summary = data.get("summary")
    if summary is not None and not isinstance(summary, str):
        summary = str(summary)
    elif summary is None:
        summary = "AI 응답 파싱 실패. (summary 없음)"

    return {
        "summary": summary[:4000] if summary else "AI 응답 파싱 실패.",
        "evidence": data.get("evidence"),
        "checks": data.get("checks"),
        "advice": data.get("advice"),
    }


def generate_ai_summary(
    case_meta: dict[str, Any],
    snapshot: dict[str, Any],
    model_id: str,
    region: str,
) -> tuple[str, Any, Any, Any]:
    """스냅샷 요약본으로 프롬프트 구성 후 Bedrock 호출. Returns (summary, evidence, checks, advice). Raises on Bedrock error."""
    snapshot_summary = build_snapshot_summary_for_ai(snapshot, case_meta)
    prompt = _build_prompt_from_summary(snapshot_summary)
    raw_text = invoke_bedrock(prompt, model_id, region)
    parsed = parse_ai_response(raw_text)
    return (
        parsed["summary"],
        parsed.get("evidence"),
        parsed.get("checks"),
        parsed.get("advice"),
    )


# ----- Summary AI (집계 JSON만 입력, 2~3줄 한국어 요약) -----

SUMMARY_AI_SYSTEM = """You are an AIOps assistant. 반드시 한국어로만 답변하세요.
Respond only with a single JSON object with one key: "summary" (string, 2~3 sentences in Korean). No markdown, no code block, no explanation."""


def generate_summary_ai(aggregation_json: dict[str, Any], model_id: str, region: str) -> str:
    """집계 데이터만 넣고 2~3줄 한국어 요약 생성. prom/loki/tempo 원문 금지. Returns summary string. Raises on Bedrock error."""
    prompt = (
        "다음은 오픈 케이스 집계 데이터입니다. 2~3문장으로 한국어 요약해주세요. JSON은 반드시 {\"summary\": \"...\"} 형태로만 답하세요.\n\n"
        + json.dumps(aggregation_json, ensure_ascii=False, indent=2)
    )
    client = boto3.client("bedrock-runtime", region_name=region)
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 512,
        "temperature": 0.3,
        "system": SUMMARY_AI_SYSTEM,
        "messages": [{"role": "user", "content": prompt}],
    }
    try:
        response = client.invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body).encode("utf-8"),
        )
    except botocore.exceptions.ClientError as e:
        msg = e.response.get("Error", {}).get("Message", str(e))
        raise RuntimeError(f"Bedrock 호출 실패: {msg}") from e
    except Exception as e:
        raise RuntimeError(f"Bedrock 호출 실패: {e}") from e

    out = json.loads(response["body"].read())
    content = out.get("content") or []
    if not content:
        raise RuntimeError("Bedrock 응답에 content가 없습니다.")
    text = (content[0].get("text") or "").strip()
    if not text:
        raise RuntimeError("Bedrock 응답 텍스트가 비어 있습니다.")

    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        buf = []
        for line in lines:
            if line.strip().startswith("```") and buf:
                continue
            if not line.strip().startswith("```"):
                buf.append(line)
        stripped = "\n".join(buf) if buf else stripped
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return "AI 응답 파싱 실패."
    if not isinstance(data, dict):
        return "AI 응답 파싱 실패."
    summary = data.get("summary")
    if not isinstance(summary, str):
        summary = str(summary) if summary is not None else "AI 응답 파싱 실패."
    return summary[:2000] if summary else "AI 응답 파싱 실패."


# ----- Home Layers AI (고정 6줄: open 집계 + 3개 레이어 스냅샷) -----

SUMMARY_AI_HOME_LAYERS_SYSTEM = """You are an AIOps assistant.

공통 원칙: (1) 출력은 반드시 한국어. (2) 추측 금지. 근거에 없는 내용은 "데이터 없음"으로 명시. (3) 줄 수는 절대 줄이지 말 것. 데이터가 없어도 6줄 채울 것. (4) 각 줄은 반드시 "- "로 시작.

Respond only with a single JSON object: {"summary": "..."}. No markdown. (summary만 써도 동일한 줄 규칙 적용.)

Home summary: 정확히 6줄. 6줄 구성(순서 고정):
1) 전체 상태(정상/주의/문제) + open 케이스 요약 한 줄
2) Infrastructure 상태(노드/파드/스크레이프; 없으면 "데이터 없음")
3) Observability 상태(Prom/Loki/Tempo/Grafana/Alertmanager, scrape down 의미 명확히; 없으면 "데이터 없음")
4) Application 상태(hp-core 주요 서비스 ready/total; 없으면 "데이터 없음")
5) 레이어별 오픈 케이스 분포 요약(by_layer/top 서비스)
6) 운영자 액션 1~2개(우선순위)"""


def generate_summary_ai_home_layers(
    aggregation: dict[str, Any],
    layer_snapshots_summary: list[dict[str, Any]],
    model_id: str,
    region: str,
) -> str:
    """open 집계 + 레이어 스냅샷으로 고정 6줄 한국어 요약. 각 줄 '- '로 시작. Raises on Bedrock error."""
    payload = {
        "open_cases": {
            "total_open": aggregation.get("total_open"),
            "by_layer": aggregation.get("by_layer"),
            "by_severity": aggregation.get("by_severity"),
            "top_services": aggregation.get("top_services"),
        },
        "layer_snapshots": layer_snapshots_summary,
    }
    prompt = (
        "다음은 오픈 케이스 집계와 레이어별 스냅샷(인프라/관측성/앱) 핵심 지표입니다. "
        "이를 근거로 summary를 정확히 6줄로 작성하세요. 각 줄은 반드시 '- '로 시작. "
        "순서: 전체상태+open요약 → Infrastructure → Observability(scrape down 의미 명확히) → Application(hp-core ready/total) → 레이어별 분포 → 운영자 액션. "
        "없는 데이터는 해당 줄 '데이터 없음'으로 채우되 6줄 유지. JSON 형식 {\"summary\": \"...\"} 로만 답하세요.\n\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
    )
    client = boto3.client("bedrock-runtime", region_name=region)
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "temperature": 0.3,
        "system": SUMMARY_AI_HOME_LAYERS_SYSTEM,
        "messages": [{"role": "user", "content": prompt}],
    }
    try:
        response = client.invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body).encode("utf-8"),
        )
    except botocore.exceptions.ClientError as e:
        msg = e.response.get("Error", {}).get("Message", str(e))
        raise RuntimeError(f"Bedrock 호출 실패: {msg}") from e
    except Exception as e:
        raise RuntimeError(f"Bedrock 호출 실패: {e}") from e

    out = json.loads(response["body"].read())
    content = out.get("content") or []
    if not content:
        raise RuntimeError("Bedrock 응답에 content가 없습니다.")
    text = (content[0].get("text") or "").strip()
    if not text:
        raise RuntimeError("Bedrock 응답 텍스트가 비어 있습니다.")

    stripped = text.strip()
    if stripped.startswith("```"):
        first = stripped.find("\n")
        if first != -1:
            stripped = stripped[first + 1 :].strip()
        if stripped.endswith("```"):
            stripped = stripped[:-3].strip()
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return "AI 응답 파싱 실패."
    if not isinstance(data, dict):
        return "AI 응답 파싱 실패."
    summary = data.get("summary")
    if not isinstance(summary, str):
        summary = str(summary) if summary is not None else "AI 응답 파싱 실패."
    return summary[:3000] if summary else "AI 응답 파싱 실패."


# ----- Report AI (POST /reports/weekly/ai: highlights 3 + summary) -----


def invoke_bedrock_report(
    system_instruction: str,
    user_prompt: str,
    model_id: str,
    region: str,
) -> str:
    """리포트 전용: system + user 메시지로 Claude 호출, 응답 텍스트 반환."""
    client = boto3.client("bedrock-runtime", region_name=region)
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2048,
        "temperature": 0.3,
        "system": system_instruction,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    try:
        response = client.invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body).encode("utf-8"),
        )
    except botocore.exceptions.ClientError as e:
        msg = e.response.get("Error", {}).get("Message", str(e))
        raise RuntimeError(f"Bedrock 호출 실패: {msg}") from e
    except Exception as e:
        raise RuntimeError(f"Bedrock 호출 실패: {e}") from e

    out = json.loads(response["body"].read())
    content = out.get("content") or []
    if not content:
        raise RuntimeError("Bedrock 응답에 content가 없습니다.")
    text = (content[0].get("text") or "").strip()
    if not text:
        raise RuntimeError("Bedrock 응답 텍스트가 비어 있습니다.")
    return text


def parse_report_ai_response(text: str) -> dict[str, Any]:
    """리포트 AI 응답에서 JSON 추출. { highlights: [{title, text}, ...], summary }."""
    stripped = _extract_json_block(text)
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        data = {}
    if not isinstance(data, dict):
        data = {}
    highlights = data.get("highlights")
    if not isinstance(highlights, list):
        highlights = []
    highlights = [
        {"title": str(h.get("title") or f"HIGHLIGHT {i+1}"), "text": str(h.get("text") or "")}
        for i, h in enumerate(highlights[:3])
        if isinstance(h, dict)
    ]
    while len(highlights) < 3:
        highlights.append({"title": f"HIGHLIGHT {len(highlights)+1}", "text": ""})
    summary = data.get("summary")
    if not isinstance(summary, str):
        summary = str(summary) if summary is not None else "데이터 없음"
    return {"highlights": highlights[:3], "summary": summary[:2000] or "데이터 없음"}
