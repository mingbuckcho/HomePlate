-- Layer column for cases (0단계: layer 저장 파이프라인)
-- 표준 값: infrastructure | delivery | observability | data | ux | application | unknown

ALTER TABLE aiops.cases ADD COLUMN IF NOT EXISTS layer text;

CREATE INDEX IF NOT EXISTS idx_cases_layer_status_last_seen
  ON aiops.cases(layer, status, last_seen_at DESC);
