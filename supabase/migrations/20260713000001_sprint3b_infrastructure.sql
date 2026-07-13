-- Sprint 3B — AI Infrastructure (no external API).
-- Job Queue, Distributed Scheduler Lock, and Conversation Log tables.
-- See packages/database/src/repository.ts (enqueueJob/claimNextPendingJob/
-- acquireLock/saveConversationLog and friends) and
-- packages/database/src/repositories/supabase-repository.ts for the
-- row <-> domain-type mapping these columns must match.

create table if not exists jobs (
  id text primary key,
  type text not null,
  payload jsonb not null,
  priority text not null check (priority in ('low', 'normal', 'high', 'urgent')),
  priority_rank integer not null,
  status text not null check (status in ('pending', 'running', 'success', 'failed', 'dead')),
  run_at timestamptz not null,
  attempts integer not null default 0,
  max_attempts integer not null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_claim_idx on jobs (status, run_at, priority_rank);
create index if not exists jobs_type_idx on jobs (type, status);

alter table jobs enable row level security;

-- Distributed Scheduler Lock (Sprint 3B — see packages/scheduler/src/distributed-lock.ts).
-- One row per lock key; acquire_scheduler_lock() below is the only writer
-- path used for acquisition, so acquisition stays atomic under concurrent
-- callers. Release/read go through plain delete/select (see
-- SupabaseRepository.releaseLock/getLock) since those aren't racy.
create table if not exists scheduler_locks (
  lock_key text primary key,
  holder_id text not null,
  acquired_at timestamptz not null,
  expires_at timestamptz not null
);

alter table scheduler_locks enable row level security;

-- Atomically acquire (or reclaim an expired) lock. Succeeds if the lock is
-- free, already expired, or already held by the same holder (idempotent
-- renewal); fails only when genuinely held by a different, still-live
-- holder. The conditional ON CONFLICT ... WHERE clause only updates (and
-- therefore only counts toward ROW_COUNT) when one of those conditions
-- holds, which is what makes this safe under concurrent callers.
create or replace function acquire_scheduler_lock(p_lock_key text, p_holder_id text, p_expires_at timestamptz)
returns boolean
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_rows integer;
begin
  insert into scheduler_locks (lock_key, holder_id, acquired_at, expires_at)
  values (p_lock_key, p_holder_id, v_now, p_expires_at)
  on conflict (lock_key) do update
    set holder_id = excluded.holder_id,
        acquired_at = excluded.acquired_at,
        expires_at = excluded.expires_at
    where scheduler_locks.expires_at < v_now or scheduler_locks.holder_id = p_holder_id;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- Conversation log (Sprint 3B — verbatim prompt/response exchange per
-- reasoning call; deliberately separate from ai_reasoning_logs, which
-- stays metadata-only so audit-log queries there remain cheap).
create table if not exists conversation_logs (
  id text primary key,
  module_id text not null,
  run_id text not null,
  system_prompt text not null,
  user_prompt text not null,
  response_text text not null,
  created_at timestamptz not null default now()
);
create index if not exists conversation_logs_run_id_idx on conversation_logs (run_id, created_at);
create index if not exists conversation_logs_module_id_idx on conversation_logs (module_id, created_at desc);

alter table conversation_logs enable row level security;
