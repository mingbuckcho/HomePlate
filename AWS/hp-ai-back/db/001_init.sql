-- =========================================================
-- AIOps DB Schema (Phase1~2) - Postgres
-- case_key: cluster|env|namespace|service
-- snapshots TTL: 14 days (expires_at)
-- =========================================================

create schema if not exists aiops;

-- 1) Cases
create table if not exists aiops.cases (
  id            bigserial primary key,
  case_key      text not null unique,

  status        text not null default 'open',  -- open|resolved
  severity      text null,

  cluster       text null,
  environment   text null,
  namespace     text null,
  service       text null,

  title         text null,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  resolved_at   timestamptz null,

  owner         text null,
  tags          text[] null,
  note          text null
);

create index if not exists idx_cases_status_last_seen
  on aiops.cases(status, last_seen_at desc);

create index if not exists idx_cases_ns_svc_last_seen
  on aiops.cases(namespace, service, last_seen_at desc);

-- 2) Alert events (webhook history)
create table if not exists aiops.alert_events (
  id            bigserial primary key,
  case_id       bigint not null references aiops.cases(id) on delete cascade,
  received_at   timestamptz not null default now(),

  am_status     text not null,                 -- firing|resolved
  alertname     text null,

  group_key     text null,
  fingerprint   text null,

  labels        jsonb not null default '{}'::jsonb,
  annotations   jsonb not null default '{}'::jsonb,
  raw           jsonb not null
);

create index if not exists idx_alert_events_case_time
  on aiops.alert_events(case_id, received_at desc);

create index if not exists idx_alert_events_alertname_time
  on aiops.alert_events(alertname, received_at desc);

-- 3) Snapshots (evidence)
create table if not exists aiops.snapshots (
  id            bigserial primary key,
  case_id       bigint not null references aiops.cases(id) on delete cascade,
  created_at    timestamptz not null default now(),

  window_from   timestamptz not null,
  window_to     timestamptz not null,

  prom_status   text not null default 'ok',    -- ok|empty|error
  prom_error    text null,
  prom          jsonb null,

  loki_status   text not null default 'ok',    -- ok|empty|error
  loki_error    text null,
  loki          jsonb null,

  tempo_status  text not null default 'ok',    -- ok|empty|error
  tempo_error   text null,
  tempo         jsonb null,

  expires_at    timestamptz null               -- TTL: created_at + 14 days
);

create index if not exists idx_snapshots_case_time
  on aiops.snapshots(case_id, created_at desc);

create index if not exists idx_snapshots_expires_at
  on aiops.snapshots(expires_at);

-- 4) AI summaries (Phase2, on-demand) - 1 per snapshot
create table if not exists aiops.ai_summaries (
  id            bigserial primary key,
  snapshot_id   bigint not null references aiops.snapshots(id) on delete cascade,
  created_at    timestamptz not null default now(),

  model         text null,
  prompt_version text null,

  summary       text not null,
  evidence      jsonb null,
  checks        jsonb null,
  advice        jsonb null,
  raw           jsonb null,

  constraint ai_summaries_snapshot_unique unique (snapshot_id)
);

create index if not exists idx_ai_summaries_snapshot_time
  on aiops.ai_summaries(snapshot_id, created_at desc);

-- 5) (Optional but useful) Case <-> alertname rollup
create table if not exists aiops.case_alertnames (
  case_id     bigint not null references aiops.cases(id) on delete cascade,
  alertname   text not null,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  primary key (case_id, alertname)
);

create index if not exists idx_case_alertnames_alertname
  on aiops.case_alertnames(alertname);