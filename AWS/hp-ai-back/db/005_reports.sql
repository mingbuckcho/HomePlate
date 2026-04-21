-- 주간 리포트 PDF 메타 저장
create table if not exists aiops.reports (
  id            bigserial primary key,
  report_type   text not null default 'weekly',

  period_start  timestamptz not null,
  period_end    timestamptz not null,
  created_at    timestamptz not null default now(),

  status        text not null default 'generated',  -- generated | failed
  file_name     text null,
  file_path     text null,
  file_size     bigint null,
  meta          jsonb null,
  error_message text null
);

create index if not exists idx_reports_type_created
  on aiops.reports(report_type, created_at desc);

create index if not exists idx_reports_period
  on aiops.reports(period_start, period_end);
