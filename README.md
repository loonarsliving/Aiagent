# mkh-ai-os — AI Workforce Engine for PT Maha Karya Haluoleo

A backend service where every AI is modeled as a digital employee: a
declared SOP, autonomous daily/weekly/monthly scheduling, persistent
memory where relevant, and a granular work log. **This project has no UI
of its own** — all UI lives in MK Connect, once integration is
authorized. `apps/dashboard` exists only as a frozen, read-only debug
viewer from an earlier phase; it receives compatibility fixes, not new
features.

> **Status: standalone / dummy-data stage.** Isolated from
> `mkh.haluoleo.id` and any production system. Every employee runs
> against mocked connectors and seeded fixtures (`DATA_MODE=dummy`) until
> real integration is explicitly requested. See `docs/ROADMAP.md`.

## The six employees

| Employee | Role | Cadences |
|---|---|---|
| Marketing Intelligence AI | Kepala Riset Marketing | daily, weekly, monthly |
| Marketing Operation AI | Koordinator Operasional Markom | daily, weekly, monthly |
| Meta Ads AI | Analis & Operator Meta Ads | daily, weekly, monthly |
| Sales Supervisor AI | Pengawas Penjualan | daily, weekly, monthly |
| Finance Analyst AI | Analis Keuangan | daily, weekly, monthly |
| CEO Assistant AI | Asisten Eksekutif | daily, weekly, monthly |

Each employee's exact SOP steps are declared in code
(`sop` field in each module's `module.ts`) and documented for humans in
`docs/SOP.md`.

## Stack

TypeScript · Supabase (Postgres, optional) · pnpm workspaces + Turborepo ·
node-cron (autonomous scheduling) · Model Context Protocol (read-only
introspection) · Vitest.

## Repository layout

```
packages/ai-engine/     AIEmployee interface, work logger, the 6 employees
packages/memory/         Knowledge base: dedup + "learning" over KnowledgeItems
packages/scheduler/      Cadence-aware cron builder + local autonomous runner
packages/notifications/  Notification Engine — dummy default + inert channel adapters
packages/connectors/     Ports (interfaces) + mock adapters — no real API calls
packages/database/       Repository interface: InMemoryRepository (default) / SupabaseRepository
packages/security/       RBAC roles, approval-gate state machine
packages/shared/         Shared types, logger, config loader
packages/mcp-server/     Read-only MCP server (Claude-ready)
apps/dashboard/          Frozen internal debug viewer (not part of the active roadmap)
supabase/migrations/     SQL schema (for DATA_MODE=supabase)
docs/                    Architecture, SOP, roadmap, connectors, testing checklist
```

See `docs/ARCHITECTURE.md` for the full design + diagrams, `docs/SOP.md`
for every employee's exact steps.

## Getting started

```bash
pnpm install
cp .env.example .env.local     # defaults are safe: DATA_MODE=dummy, no real credentials needed
pnpm scheduler:dev              # runs the whole workforce autonomously via node-cron
```

Other useful commands:

```bash
pnpm typecheck        # tsc --noEmit across all packages
pnpm test             # vitest run — unit tests for every employee's logic + memory + scheduler
pnpm build             # turbo build (all packages, including the frozen dashboard)
pnpm mcp:dev            # run the MCP server standalone (stdio) for Claude Desktop / MCP clients
```

## Running an employee on demand (no scheduler)

```ts
import { runEmployeeTask } from "@mkh/ai-engine";
import { marketingIntelligenceEmployee } from "@mkh/ai-engine";

const report = await runEmployeeTask(marketingIntelligenceEmployee, "daily", { triggeredBy: "manual" });
```

## Data mode

`DATA_MODE=dummy` (default) — `InMemoryRepository`, seeded fixtures, no
external calls. `DATA_MODE=supabase` (with Supabase env vars set) —
`SupabaseRepository` against `supabase/migrations/`. Same `Repository`
interface either way; no employee code changes.

## Safety boundaries (do not remove without Owner sign-off)

- **Meta Ads AI** only analyzes and creates Approval Requests
  (`proposeAction`) — there is no execute/publish path in this phase.
  `decideOnApproval` is RBAC-gated to the `owner` role.
- **Sales Supervisor AI** and **Finance Analyst AI** are strictly
  read-only — `Repository` has no write methods for their business data.
- **`getExternalSystemConnector()`** (MK Connect) always throws — nothing
  in this repo can reach `mkh.haluoleo.id`.

## Documentation

- `docs/ARCHITECTURE.md` — system design + diagrams
- `docs/SOP.md` — every employee's declared daily/weekly/monthly steps
- `docs/ROADMAP.md` — what's done, what's deferred and why
- `docs/CONNECTORS.md` — ports/adapters and what each becomes when wired for real
- `docs/EXTERNAL_APIS.md` — external APIs, auth method, purpose
- `docs/TESTING_CHECKLIST.md` — automated + manual QA checklist
