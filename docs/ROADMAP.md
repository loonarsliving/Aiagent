# Roadmap

## Sprint 1 status: CLOSED ✅

Sprint 1 Final's checklist (all 11 required Digital Employees, retry
strategy, manual trigger, per-employee memory, granular logging, 90%+ test
coverage, updated documentation) is complete — see
`docs/audits/SPRINT1_FINAL_AUDIT.md` for the full technical audit,
scorecard, and evidence. The engineering foundation is now considered
enterprise-ready for **Sprint 2: Gemini API integration**, which has not
started — no Gemini, WhatsApp, Meta, OTA, or MK Connect API call exists
anywhere in this repository yet.

## Direction (current)

This is a **backend AI Workforce Engine / Digital Management Team** with
no UI of its own. All UI — today's dashboard included — is out of active
scope; MK Connect owns the UI once integration is authorized. Everything
below runs on mocked connectors and seeded/dummy data.

## Foundation ✅ (Sprint 1 Final)

- **10 AI employees** implementing `AIEmployee` (daily/weekly/monthly
  cadences, declared SOP, work-logged, retry-strategy-covered): Marketing
  Intelligence, Content Planner, Meta Ads Specialist, Sales Supervisor,
  Branch Performance Manager, Finance Analyst, HR Officer, OTA Manager,
  SOP Guardian, CEO Assistant. See `docs/SOP.md` for each employee's exact
  steps.
- **Retry strategy** — `runEmployeeTask` retries a failing task up to
  `MAX_RETRY_ATTEMPTS` times (default 3, config-layer, not hardcoded) with
  exponential backoff; no employee "just fails" on a transient error.
  Every attempt is recorded in the work log; the final report carries
  `durationMs`/`retryCount`.
- **Manual trigger service** — `triggerEmployee()` (`@mkh/scheduler`) runs
  any employee on demand outside its schedule; a CLI wrapper
  (`pnpm employee:trigger`) exists for operator use today, and the same
  function is what MK Connect will call directly once authorized. No UI.
- **Per-employee memory** — every one of the 10 employees has its own
  `KnowledgeBase` (`@mkh/memory`), never shared with another employee. See
  `docs/ARCHITECTURE.md`'s memory table for what each one remembers.
- **Granular, retry-aware work log** (`WorkLogEntry`) — every SOP step is
  persisted with `runId` and `attempt`, not just logged to console; SOP
  Guardian reads this trail to detect structurally incomplete runs.
- **Notification Coordinator** (`packages/notifications`) — the single
  funnel every employee routes 100% of its alerts through; no employee
  calls a channel directly. WhatsApp/Telegram/Email/Push adapters exist as
  inert skeletons, unactivated.
- **Connectors** restructured as ports + mock adapters
  (`packages/connectors/src/ports`, `adapters/mock`), including a new
  `OTAConnector` for occupancy/ADR/competitor price/booking pace/dynamic
  pricing — swapping to a real integration later touches one adapter file
  + one registry line, not employee logic.
- **Cadence-aware scheduler** (`packages/scheduler`) — `toCronExpression()`
  handles daily/weekly/monthly for all 10 employees (30 schedule slots);
  `local-runner.ts` (node-cron) is a plain backend process, the primary
  autonomous execution path for this phase.
- **Meta Ads Specialist's workflow** trimmed to its authorized scope:
  analyze → recommend/draft new campaign → `proposeAction()` (creates a
  pending, i.e. WAITING OWNER APPROVAL, Approval Request). No
  execute/publish path exists yet — see "Deferred" below.
- **Configuration layer** — every tunable (retry attempts/backoff,
  notification default channel, data mode) is read through
  `packages/shared/src/config.ts`'s zod-validated `getConfig()`; nothing
  hardcoded.
- **Test coverage** — 90%+ lines/statements/functions, 85%+ branches
  (`pnpm test:coverage`, enforced in CI), across every employee's
  calculation logic and orchestration wiring, the memory merge rule, the
  approval workflow, the scheduler's cron-expression logic and manual
  trigger, the runner's retry path, all four notification channel
  skeletons, all mock connector adapters, and both `Repository`
  implementations (including the Supabase client's request/response
  mapping and error branches, exercised via a fake query-builder client).
- `apps/dashboard` kept (not deleted) as a frozen, read-only internal
  debug viewer from an earlier phase — receives compatibility fixes only,
  no new features (per explicit instruction: no new UI/dashboard pages).

## Explicitly deferred (each requires separate, explicit Owner authorization)

1. **Gemini API / any AI provider integration.** This is Sprint 2, not
   started. No employee calls an LLM anywhere in this codebase yet.
2. **Real connectors.** Wire one adapter at a time behind the existing
   ports (`docs/CONNECTORS.md`) — Instagram/TikTok first (lowest risk,
   read-only), Meta Ads read next, Google Trends, OTA channel manager,
   then MK Connect.
3. **Meta Ads execution.** Add a real `execute()` path only after Stage
   1's recommendations have been validated against real numbers for at
   least one reporting cycle. Bring back an execution-audit table at that
   point.
4. **Notification channels.** WhatsApp/Telegram/Email/Push adapters exist
   as inert skeletons (`packages/notifications/src/channels/*.ts`,
   `TODO(integration)` markers) — fill in one at a time.
5. **MK Connect integration.** Replace `getExternalSystemConnector()`'s
   guardrail adapter with a real client once authorized. This is also the
   point where Sales/Finance/HR snapshots and the Markom
   checklist-completion state switch from seed fixtures to real ERP data,
   and where `triggerEmployee()` gets its first real external caller.
6. **Real infrastructure.** No live Supabase project or Vercel deployment
   exists — code is Supabase-ready (`DATA_MODE=supabase`,
   `supabase/migrations/`) and has an HTTP cron endpoint ready
   (`apps/dashboard/src/app/api/cron/[moduleId]`), but neither is
   provisioned. `pnpm scheduler:dev` is sufficient to run the whole system
   autonomously today.

## Known limitations to revisit

- Weekly/monthly task methods intentionally share a lighter-weight
  aggregation pattern (`aggregateRecentReports`) rather than 20 fully
  bespoke algorithms — proportionate for now, worth deepening once real
  usage patterns are known.
- Anomaly detection (Finance), CPL/CTR/CPC thresholds (Meta Ads),
  attendance/KPI thresholds (HR), and occupancy/pace thresholds (OTA) use
  simple, explainable heuristics tuned for small dummy data volume —
  revisit against real historical data once connectors go live.
- No auth/RBAC enforcement point exists yet outside the approval
  decision check — add real auth when this stops being a backend-only
  service invoked by trusted callers (i.e. once MK Connect calls in).
- SOP Guardian's "structural SOP violation" check is a generic heuristic
  (work log reaches a `finished` step, has a minimum number of distinct
  steps) rather than a per-employee declared-vs-actual step diff — this
  keeps it decoupled from every other employee's internals, but is worth
  revisiting if false positives/negatives show up in practice.
- `pnpm audit` flags several high-severity Next.js advisories
  (DoS/SSRF/middleware-bypass in Server Components/middleware) that are
  only patched in Next.js 15.5.16+; the currently pinned 14.2.35 remains
  vulnerable. Fixing this requires a major-version bump (14→15) of
  `apps/dashboard`'s one dependency, which is a real behavior-change risk
  for a frozen app — deliberately **not** done in this round to honor "no
  behavior changes." Low real-world exposure today since no live
  deployment exists yet (see "Real infrastructure" above) and the
  dashboard is an internal, unauthenticated-network-only debug viewer.
  Flag for explicit Owner sign-off before the next time `apps/dashboard`
  is touched, or fold into whichever future phase finally deprecates/
  replaces it with MK Connect's UI.
