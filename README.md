# mkh-ai-os — AI Operating System for PT Maha Karya Haluoleo

A "digital employee" system: five background-worker AI modules that supervise
Marketing, Meta Ads, Sales, and Finance, and roll their output up into a
daily Executive Summary for the Owner. **This is not a chatbot and not an
ERP replacement** — it observes, analyzes, and (for Meta Ads, only after
explicit Owner approval) acts.

> **Status: standalone / dummy-data stage.** This repository is deliberately
> isolated from `mkh.haluoleo.id` and any production system. Every module
> runs against seeded, in-memory fixtures (`DATA_MODE=dummy`) until real
> integration is explicitly requested. See `docs/ROADMAP.md`.

## Stack

Next.js 14 (App Router) · TypeScript · Supabase (Postgres) · Vercel
(hosting + Cron) · pnpm workspaces + Turborepo · Vitest.

## Repository layout

```
apps/dashboard/        Next.js app — dashboard UI + /api/cron/* endpoints
packages/ai-engine/     Core AIModule interface + the 5 AI modules
packages/scheduler/     Modular time-slot registry, local + Vercel Cron runners
packages/notifications/ NotificationChannel interface + channel adapters
packages/connectors/    Mocked external integrations (IG, TikTok, Meta Ads, ...)
packages/database/      Repository interface: InMemoryRepository (default) / SupabaseRepository
packages/security/      RBAC roles, approval-gate, audit log helper
packages/shared/        Shared types, zod schemas, logger, config loader
packages/mcp-server/    MCP server exposing read-only tools (Claude-ready)
supabase/migrations/    SQL schema (for the future DATA_MODE=supabase switch)
docs/                   Architecture, roadmap, connectors, external APIs, testing checklist
```

See `docs/ARCHITECTURE.md` for the full design and diagram.

## Getting started

```bash
pnpm install
cp .env.example .env.local     # defaults are safe: DATA_MODE=dummy, no real credentials needed
pnpm dev                       # runs apps/dashboard on http://localhost:3000
```

Other useful commands:

```bash
pnpm typecheck        # tsc --noEmit across all packages
pnpm test             # vitest run (unit tests for every module's calculations)
pnpm build            # turbo build (dashboard + packages)
pnpm scheduler:dev     # run the modular scheduler locally (node-cron), executes modules on their configured times
pnpm mcp:dev           # run the MCP server standalone (stdio) for Claude Desktop / MCP clients
```

## Running an AI module on demand (no scheduler)

Every module implements the same interface (`packages/ai-engine/src/core`), so
you can invoke any module directly, e.g. from a script or REPL:

```ts
import { marketingStrategistModule } from "@mkh/ai-engine/modules/marketing-strategist";
const report = await marketingStrategistModule.run({ triggeredBy: "manual" });
```

## Data mode

`DATA_MODE=dummy` (default) — the `database` package returns an
`InMemoryRepository` seeded with realistic fixtures; nothing leaves the
process. Flipping to `DATA_MODE=supabase` (with `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set) switches to
the `SupabaseRepository` implementation against the schema in
`supabase/migrations/`. No code changes required either way.

## Safety boundaries (do not remove without Owner sign-off)

- **Meta Ads Operator AI** never calls a real ads API directly — actions
  (budget change, pause/activate) always go through the approval workflow in
  `packages/security` and are only executed by the mocked connector once an
  `approvals` record has `status = "approved"`. Every action is written to
  `action_logs`.
- **Sales Supervisor AI** and **Finance Analyst AI** are strictly read-only —
  they never write to sales or transaction records.
- No package here talks to `mkh.haluoleo.id` or MK Connect. `packages/connectors`
  ships an `mkConnect` stub that throws if called, as a guardrail.

## Documentation

- `docs/ARCHITECTURE.md` — system design + Mermaid diagram
- `docs/ROADMAP.md` — Tahap 1–5 execution plan and post-MVP integration phases
- `docs/CONNECTORS.md` — connectors needed at real-integration time
- `docs/EXTERNAL_APIS.md` — external APIs, auth method, purpose
- `docs/TESTING_CHECKLIST.md` — automated + manual QA checklist
