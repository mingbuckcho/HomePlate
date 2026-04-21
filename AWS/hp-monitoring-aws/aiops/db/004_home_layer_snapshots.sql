-- Home Layer Snapshot: 레이어별 메트릭 (infrastructure / observability / application), 14일 TTL
create table if not exists aiops.home_layer_snapshots (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  layer         text not null,

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
  tempo_error    text null,
  tempo         jsonb null
);

create index if not exists idx_home_layer_snapshots_layer_created
  on aiops.home_layer_snapshots(layer, created_at desc);

create index if not exists idx_home_layer_snapshots_expires_at
  on aiops.home_layer_snapshots(expires_at);
