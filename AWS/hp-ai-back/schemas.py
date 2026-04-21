"""Request/response schemas."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ----- Alertmanager webhook -----
class AMAlert(BaseModel):
    status: str  # firing | resolved
    labels: dict[str, Any] = Field(default_factory=dict)
    annotations: dict[str, Any] = Field(default_factory=dict)
    startsAt: str = ""
    endsAt: str = ""
    generatorURL: str = ""
    fingerprint: str = ""


class AMWebhookPayload(BaseModel):
    status: str  # firing | resolved
    alerts: list[AMAlert] = Field(default_factory=list)
    groupLabels: dict[str, Any] = Field(default_factory=dict)
    commonLabels: dict[str, Any] = Field(default_factory=dict)
    commonAnnotations: dict[str, Any] = Field(default_factory=dict)
    groupKey: str = ""
    externalURL: str = ""


# ----- API responses -----
class CaseBrief(BaseModel):
    id: int
    case_key: str
    status: str
    severity: str | None
    layer: str | None = None
    cluster: str | None
    environment: str | None
    namespace: str | None
    service: str | None
    started_at: datetime
    last_seen_at: datetime


class AlertEventOut(BaseModel):
    received_at: datetime
    am_status: str
    alertname: str | None
    labels: dict[str, Any]
    annotations: dict[str, Any]


class SnapshotOut(BaseModel):
    id: int
    created_at: datetime
    window_from: datetime
    window_to: datetime
    prom_status: str
    prom_error: str | None = None
    prom: dict[str, Any] | None
    loki_status: str
    loki_error: str | None = None
    loki: dict[str, Any] | None
    tempo_status: str
    tempo_error: str | None = None
    tempo: dict[str, Any] | None


class AISummaryOut(BaseModel):
    summary: str
    evidence: Any = None  # dict | list | str from LLM
    checks: Any = None
    advice: Any = None


class CaseDetailResponse(BaseModel):
    case: CaseBrief
    alert_events: list[AlertEventOut]
    snapshot: SnapshotOut | None
    ai_summary: AISummaryOut | None = None


class CaseListItem(BaseModel):
    id: int
    case_key: str
    status: str
    severity: str | None
    layer: str | None = None
    cluster: str | None
    environment: str | None
    namespace: str | None
    service: str | None
    started_at: datetime
    last_seen_at: datetime


# ----- Home snapshot -----
class HomeSnapshotOut(BaseModel):
    id: int
    created_at: datetime
    window_from: datetime
    window_to: datetime
    expires_at: datetime
    prom_status: str
    prom_error: str | None = None
    prom: dict[str, Any] | None = None
    loki_status: str
    loki_error: str | None = None
    loki: dict[str, Any] | None = None
    tempo_status: str
    tempo_error: str | None = None
    tempo: dict[str, Any] | None = None


# ----- Home layer snapshot -----
class HomeLayerSnapshotOut(BaseModel):
    id: int
    created_at: datetime
    layer: str
    window_from: datetime
    window_to: datetime
    expires_at: datetime
    prom_status: str
    prom_error: str | None = None
    prom: dict[str, Any] | None = None
    loki_status: str
    loki_error: str | None = None
    loki: dict[str, Any] | None = None
    tempo_status: str
    tempo_error: str | None = None
    tempo: dict[str, Any] | None = None


# ----- Phase2 AI summary -----
class AISummaryCreate(BaseModel):
    model: str | None = None
    prompt_version: str | None = None
    summary: str
    evidence: dict[str, Any] | None = None
    checks: dict[str, Any] | None = None
    advice: dict[str, Any] | None = None
    raw: dict[str, Any] | None = None
