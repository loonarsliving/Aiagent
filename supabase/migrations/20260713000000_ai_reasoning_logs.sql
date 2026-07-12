-- Sprint 2 — AI Provider Layer / Reasoning Engine audit log.
-- One row per reasoning attempt sequence (not per individual provider
-- retry) — see packages/ai-engine/src/reasoning/reasoning-engine.ts and
-- packages/database/src/repository.ts's saveAIReasoningLog/listAIReasoningLogs.

create table if not exists ai_reasoning_logs (
  id text primary key,
  module_id text not null,
  run_id text not null,
  provider text not null check (provider in ('gemini', 'claude', 'openai', 'ollama')),
  model text not null,
  status text not null check (status in ('success', 'error')),
  response_time_ms integer not null,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  retry_count integer not null default 0,
  error_reason text,
  created_at timestamptz not null default now()
);
create index if not exists ai_reasoning_logs_run_id_idx on ai_reasoning_logs (run_id, created_at);
create index if not exists ai_reasoning_logs_module_id_idx on ai_reasoning_logs (module_id, created_at desc);

alter table ai_reasoning_logs enable row level security;
