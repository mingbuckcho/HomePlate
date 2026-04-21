# hp-ai-back

AIOps Portal (Backend) — Alertmanager 웹훅 수신, Cases/Snapshots API, Bedrock(Claude) AI 요약 연동.

## AI Summary (Phase2) 테스트

Bedrock 연동 후 아래 순서로 확인한다.

1. **스냅샷 ID 확인**  
   케이스가 있고 해당 케이스에 스냅샷이 있어야 한다.  
   `GET /cases/{case_id}` 응답의 `snapshot.id`를 사용한다.

2. **AI 요약 생성 (body 없이 호출 → Bedrock 호출)**

   ```bash
   curl -X POST "http://localhost:8000/snapshots/{snapshot_id}/ai-summary" \
     -H "Content-Type: application/json"
   ```

   성공 시 `ai_summary_id`, `summary`, `evidence`, `checks`, `advice`가 JSON으로 반환된다.

3. **케이스 상세에서 요약 확인**
   ```bash
   curl "http://localhost:8000/cases/{case_id}"
   ```
   응답의 `ai_summary`에 위에서 생성한 요약이 포함되어 있으면 정상 동작이다.

**필수 환경 변수:** `.env`에 `BEDROCK_MODEL_ID`(필수), `AWS_REGION`(선택, 기본 `ap-northeast-2`) 설정.  
로컬은 `aws configure`로 자격증명이 설정되어 있어야 한다.

---

## 수집기(Collector) 로컬 터널 + 수집 동작 확인

Prometheus/Loki/Tempo가 원격에 있을 때 로컬에서 터널로 접속해 snapshot에 실제 데이터를 채우는 절차.

1. **로컬 터널 (ssh -L)**  
   예: Prom 19090, Loki 13100, Tempo 13200으로 포워딩.

   ```bash
   ssh -L 19090:prom-host:9090 -L 13100:loki-host:3100 -L 13200:tempo-host:3200 user@jump-host
   ```

2. **환경 변수 (.env)**

   ```env
   PROM_URL=http://localhost:19090
   LOKI_URL=http://localhost:13100
   TEMPO_URL=http://localhost:13200
   ```

   터널 포트와 위 포트가 일치하도록 설정.

3. **수집 동작 확인 (웹훅 → snapshot ok)**
   - 백엔드 실행: `uvicorn main:app --host 0.0.0.0 --port 8000`
   - 웹훅으로 케이스 생성(같은 case_key면 기존 case 갱신). 2분 이내 동일 case에 대한 중복 snapshot은 생성되지 않음.

   ```bash
   curl -X POST "http://localhost:8000/webhook/alertmanager" \
     -H "Content-Type: application/json" \
     -d '{"status":"firing","alerts":[{"status":"firing","labels":{"alertname":"Test","namespace":"hp-core","service":"hp-backend-core","severity":"warning","cluster":"local","env":"dev"},"annotations":{"summary":"테스트"}}]}'
   ```

   - 해당 case의 상세에서 snapshot 확인: `GET /cases/{case_id}`  
     응답의 `snapshot`에 `prom_status`/`loki_status`/`tempo_status` 및 `prom`/`loki`/`tempo`(또는 empty)가 채워져 있으면 수집 정상.
   - **Refresh** 시에는 2분 체크 없이 항상 새 snapshot 생성 후 collector 실행.

---

## Layer (0단계) 마이그레이션 및 검증

1. **DB 마이그레이션**

   ```bash
   psql -U <user> -d <dbname> -f db/002_add_layer.sql
   ```

   `aiops.cases`에 `layer` 컬럼과 `idx_cases_layer_status_last_seen` 인덱스가 추가된다.

2. **labels.layer 포함 웹훅 → DB 저장**

   ```bash
   curl -X POST "http://localhost:8000/webhook/alertmanager" \
     -H "Content-Type: application/json" \
     -d '{"status":"firing","alerts":[{"status":"firing","labels":{"alertname":"Test","namespace":"hp-core","service":"hp-backend-core","layer":"ux","severity":"warning","cluster":"local","env":"dev"}}]}'
   ```

   이후 `GET /cases` 또는 해당 case 상세에서 `layer: "ux"` 확인.

3. **labels.layer 없이 alertname으로 layer 판정**

   ```bash
   curl -X POST "http://localhost:8000/webhook/alertmanager" \
     -H "Content-Type: application/json" \
     -d '{"status":"firing","alerts":[{"status":"firing","labels":{"alertname":"BackendDown","namespace":"hp-core","service":"hp-backend-core","severity":"warning","cluster":"local","env":"dev"}}]}'
   ```

   `alertname`이 "Backend"로 시작하므로 `layer: "application"` 저장됨.

4. **layer 필터**
   ```bash
   curl "http://localhost:8000/cases?layer=ux"
   ```
   `layer=ux`인 케이스만 반환되는지 확인.
