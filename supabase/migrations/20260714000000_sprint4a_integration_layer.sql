-- Sprint 4A — AI Operating System Integration Layer (no external API).
-- Integration request/response log + chat conversations. See
-- packages/database/src/repository.ts (saveIntegrationLog/listIntegrationLogs,
-- saveConversation/getConversation/listConversations) and
-- packages/database/src/repositories/supabase-repository.ts for the
-- row <-> domain-type mapping these columns must match.

-- One row per request that crossed a connector boundary, in either
-- direction. `connector`/`direction` mirror the ConnectorType/
-- IntegrationDirection unions in packages/shared/src/types.ts.
create table if not exists integration_logs (
  id text primary key,
  connector text not null check (connector in ('whatsapp', 'telegram', 'email', 'meta', 'mkconnect', 'ota')),
  direction text not null check (direction in ('outgoing', 'incoming')),
  payload jsonb not null,
  status text not null check (status in ('success', 'error', 'pending')),
  response_status integer,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists integration_logs_connector_idx on integration_logs (connector, created_at desc);
create index if not exists integration_logs_direction_idx on integration_logs (direction, created_at desc);

alter table integration_logs enable row level security;

-- Every incoming message becomes (or continues) exactly one conversation —
-- see packages/integrations/src/conversation-engine.ts. `history` is the
-- full ChatMessage[] trail as jsonb, oldest first, rather than a separate
-- messages table — a conversation's history is always read as a whole
-- (never paginated independently), so one jsonb column is the simpler and
-- cheaper shape here.
create table if not exists chat_conversations (
  id text primary key,
  connector text not null check (connector in ('whatsapp', 'telegram', 'email', 'meta', 'mkconnect', 'ota')),
  sender text not null,
  intent text,
  assigned_agent text,
  status text not null check (status in ('open', 'routed', 'closed')),
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_conversations_connector_idx on chat_conversations (connector, updated_at desc);
create index if not exists chat_conversations_status_idx on chat_conversations (status, updated_at desc);
create index if not exists chat_conversations_assigned_agent_idx on chat_conversations (assigned_agent, updated_at desc);

alter table chat_conversations enable row level security;
