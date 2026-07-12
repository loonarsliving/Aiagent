-- mkh-ai-os schema — AI Workforce Engine
-- Mirrors packages/database/src/repository.ts. Only needed when DATA_MODE=supabase;
-- the app runs perfectly well in dummy mode without ever touching this project.

create extension if not exists "pgcrypto";

create table if not exists reports (
  id text primary key,
  module_id text not null check (module_id in (
    'marketing-intelligence', 'marketing-operation', 'meta-ads-operator',
    'sales-supervisor', 'finance-analyst', 'ceo-assistant'
  )),
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly')),
  generated_at timestamptz not null default now(),
  status text not null check (status in ('success', 'error')),
  summary text not null,
  data jsonb not null,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists reports_module_id_generated_at_idx on reports (module_id, generated_at desc);
create index if not exists reports_module_id_cadence_idx on reports (module_id, cadence, generated_at desc);

-- Meta Ads AI's workflow: propose an action, Owner (via MK Connect) decides.
-- No execution table yet — publishing to a real ad account is a distinct,
-- not-yet-authorized future phase (see docs/ROADMAP.md).
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
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly')),
  time text not null, -- "HH:mm", company timezone (Asia/Makassar)
  day_of_week int, -- 0=Sunday..6=Saturday, required when cadence='weekly'
  day_of_month int, -- 1-28, required when cadence='monthly'
  label text not null,
  enabled boolean not null default true
);

create table if not exists schedule_runs (
  id text primary key,
  module_id text not null,
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly')),
  scheduled_time text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  report_id text references reports (id)
);
create index if not exists schedule_runs_started_at_idx on schedule_runs (started_at desc);

-- Granular SOP step trail — "08:00 Started", "08:12 Research Completed", ...
-- One row per step, tied to a single scheduler run via run_id.
create table if not exists work_log (
  id text primary key,
  module_id text not null,
  run_id text not null,
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly')),
  step text not null,
  status text not null check (status in ('info', 'success', 'error')),
  detail text,
  logged_at timestamptz not null default now()
);
create index if not exists work_log_run_id_idx on work_log (run_id, logged_at);
create index if not exists work_log_module_id_idx on work_log (module_id, logged_at desc);

-- Marketing Intelligence's knowledge base — deduplicated by id, `times_seen`
-- increments on rediscovery instead of inserting a duplicate row (the
-- "learning" behavior lives in @mkh/memory's mergeKnowledgeItem; this table
-- is just where the merged result lands).
create table if not exists knowledge_items (
  id text primary key,
  module_id text not null,
  category text not null,
  title text not null,
  source_url text,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  times_seen int not null default 1,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists knowledge_items_module_category_idx on knowledge_items (module_id, category, last_seen_at desc);

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

create table if not exists markom_checklist_completion (
  day_index int primary key check (day_index between 0 and 6), -- 0=Senin..6=Minggu
  completed boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Row Level Security: enabled with no policies yet (service-role key bypasses RLS
-- for server-side reads/writes; add policies here once a real caller identity exists,
-- e.g. MK Connect's service account).
alter table reports enable row level security;
alter table approvals enable row level security;
alter table notifications enable row level security;
alter table schedule_entries enable row level security;
alter table schedule_runs enable row level security;
alter table work_log enable row level security;
alter table knowledge_items enable row level security;
alter table sales_targets enable row level security;
alter table finance_transactions enable row level security;
alter table markom_checklist_completion enable row level security;
