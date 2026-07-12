-- mkh-ai-os initial schema
-- Mirrors packages/database/src/repository.ts. Only needed when DATA_MODE=supabase;
-- the app runs perfectly well in dummy mode without ever touching this project.

create extension if not exists "pgcrypto";

create table if not exists reports (
  id text primary key,
  module_id text not null check (module_id in (
    'marketing-strategist', 'meta-ads-operator', 'sales-supervisor', 'finance-analyst', 'ceo-assistant'
  )),
  generated_at timestamptz not null default now(),
  status text not null check (status in ('success', 'error')),
  summary text not null,
  data jsonb not null,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists reports_module_id_generated_at_idx on reports (module_id, generated_at desc);

create table if not exists approvals (
  id text primary key,
  module_id text not null,
  action_type text not null check (action_type in (
    'increase_budget', 'decrease_budget', 'pause_campaign', 'activate_campaign'
  )),
  campaign_id text not null,
  campaign_name text not null,
  reason text not null,
  proposed_change jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);
create index if not exists approvals_status_idx on approvals (status);

create table if not exists action_logs (
  id text primary key,
  approval_id text not null references approvals (id),
  action_type text not null,
  campaign_id text not null,
  executed_at timestamptz not null default now(),
  result text not null check (result in ('executed', 'failed')),
  detail text not null
);
create index if not exists action_logs_executed_at_idx on action_logs (executed_at desc);

create table if not exists notifications (
  id text primary key,
  channel text not null check (channel in ('dummy', 'whatsapp', 'telegram', 'email', 'push')),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text not null,
  target text,
  source_module_id text,
  created_at timestamptz not null default now()
);
create index if not exists notifications_created_at_idx on notifications (created_at desc);

create table if not exists schedule_entries (
  id text primary key,
  module_id text not null,
  time text not null, -- "HH:mm", company timezone (Asia/Makassar)
  label text not null,
  enabled boolean not null default true
);

create table if not exists schedule_runs (
  id text primary key,
  module_id text not null,
  scheduled_time text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  report_id text references reports (id)
);
create index if not exists schedule_runs_started_at_idx on schedule_runs (started_at desc);

-- Internal "source of truth" business data — populated by a future ERP/MK Connect
-- sync. Until then, the app reads seeded fixtures instead of these tables
-- (see packages/database/src/seed-data.ts).
create table if not exists sales_targets (
  rep_id text primary key,
  name text not null,
  branch text not null,
  target_idr bigint not null,
  achieved_idr bigint not null default 0,
  last_activity_days_ago int not null default 0,
  period_label text not null
);

create table if not exists finance_transactions (
  id text primary key,
  date date not null,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount_idr bigint not null,
  description text not null
);
create index if not exists finance_transactions_date_idx on finance_transactions (date desc);

-- Row Level Security: enabled with no policies yet (service-role key bypasses RLS
-- for server-side reads/writes; add policies here once end-user dashboard auth ships).
alter table reports enable row level security;
alter table approvals enable row level security;
alter table action_logs enable row level security;
alter table notifications enable row level security;
alter table schedule_entries enable row level security;
alter table schedule_runs enable row level security;
alter table sales_targets enable row level security;
alter table finance_transactions enable row level security;
