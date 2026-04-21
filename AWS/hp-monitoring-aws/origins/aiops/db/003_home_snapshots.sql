-- Home Snapshot: 클러스터/레이어 상태 메트릭 (14일 TTL)
create table if not exists aiops.home_snapshots (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),

  window_from   timestamptz not null,
  window_to     timestamptz not null,
  expires_at    timestamptz not null,

  prom_status   text not null default 'ok',
  prom_error    text null,
  prom          jsonb null,

  loki_status   text not null default 'ok',
  loki_error    text null,
  loki          jsonb null,

  tempo_status  text not null default 'ok',
  tempo_error   text null,
  tempo         jsonb null
);

create index if not exists idx_home_snapshots_created_at
  on aiops.home_snapshots(created_at desc);

create index if not exists idx_home_snapshots_expires_at
  on aiops.home_snapshots(expires_at);
