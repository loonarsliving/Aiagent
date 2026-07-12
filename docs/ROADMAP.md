# Roadmap

## Direction (current)

This is a **backend AI Workforce Engine** with no UI of its own. All UI —
today's dashboard included — is out of active scope; MK Connect owns the
UI once integration is authorized. Everything below runs on mocked
connectors and seeded/dummy data.

## Foundation ✅

- 6 AI employees implementing `AIEmployee` (daily/weekly/monthly cadences,
  declared SOP, work-logged): Marketing Intelligence, Marketing Operation,
  Meta Ads AI, Sales Supervisor, Finance Analyst, CEO Assistant. See
  `docs/SOP.md` for each employee's exact steps.
- Persistent memory (`@mkh/memory`) — Marketing Intelligence's knowledge
  base deduplicates and strengthens (`timesSeen`) rediscovered facts
  instead of re-searching from scratch every day.
- Granular work log (`WorkLogEntry`) — every SOP step is persisted, not
  just logged to console.
- Connectors restructured as ports + mock adapters
  (`packages/connectors/src/ports`, `adapters/mock`) — swapping to a real
  integration later touches one adapter file + one registry line, not
  employee logic.
- Cadence-aware scheduler (`packages/scheduler`) — `toCronExpression()`
  handles daily/weekly/monthly; `local-runner.ts` (node-cron) is a plain
  backend process, the primary autonomous execution path for this phase.
- Meta Ads AI's workflow trimmed to its authorized scope: analyze →
  recommend → `proposeAction()` (creates a pending Approval Request). No
  execute/publish path exists yet — see "Deferred" below.
- Vitest coverage across every employee's calculation logic, the memory
  merge rule, the approval workflow, the scheduler's cron-expression
  logic, and the runner's error path.
- `apps/dashboard` kept (not deleted) as a frozen, read-only internal
  debug viewer from an earlier phase — receives compatibility fixes only,
  no new features.

## Explicitly deferred (each requires separate, explicit Owner authorization)

1. **Real connectors.** Wire one adapter at a time behind the existing
   ports (`docs/CONNECTORS.md`) — Instagram/TikTok first (lowest risk,
   read-only), Meta Ads read next, Google Trends, then MK Connect.
2. **Meta Ads execution.** Add a real `execute()` path only after Stage
   1's recommendations have been validated against real numbers for at
   least one reporting cycle. Bring back an execution-audit table
   (removed this round — see `supabase/migrations/`) at that point.
3. **Notification channels.** WhatsApp/Telegram/Email/Push adapters exist
   as inert skeletons (`packages/notifications/src/channels/*.ts`,
   `TODO(integration)` markers) — fill in one at a time.
4. **MK Connect integration.** Replace `getExternalSystemConnector()`'s
   guardrail adapter with a real client once authorized. This is also the
   point where Sales/Finance snapshots and the Markom checklist-completion
   state switch from seed fixtures to real ERP data.
5. **Claude API / MCP write tools.** The MCP server
   (`packages/mcp-server`) is read-only by design; consider gated write
   tools (e.g. propose/decide an approval) only after the read-only
   surface has been used in practice.
6. **Real infrastructure.** No live Supabase project or Vercel deployment
   exists — code is Supabase-ready (`DATA_MODE=supabase`,
   `supabase/migrations/`) and has an HTTP cron endpoint ready
   (`apps/dashboard/src/app/api/cron/[moduleId]`), but neither is
   provisioned. `pnpm scheduler:dev` is sufficient to run the whole system
   autonomously today.

## Known limitations to revisit

- Weekly/monthly task methods intentionally share a lighter-weight
  aggregation pattern (`aggregateRecentReports`) rather than 12 fully
  bespoke algorithms — proportionate for now, worth deepening once real
  usage patterns are known.
- Anomaly detection (Finance) and CPL/CTR/CPC thresholds (Meta Ads) use
  simple, explainable heuristics tuned for small dummy data volume —
  revisit against real historical data once connectors go live.
- No auth/RBAC enforcement point exists yet outside the approval
  decision check — add real auth when this stops being a backend-only
  service invoked by trusted callers (i.e. once MK Connect calls in).
