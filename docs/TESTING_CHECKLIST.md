# Testing checklist

## Automated (run via `pnpm test:coverage` / CI)

- [ ] `pnpm install` completes without errors
- [ ] `pnpm typecheck` — zero type errors across all 10 packages + dashboard
- [ ] `pnpm test:coverage` (Vitest + `@vitest/coverage-v8`), covering:
  - [ ] `runEmployeeTask` retry path: transient failures retry with backoff and eventually succeed; exhausted retries still return a persisted `status: "error"` report instead of rejecting; `durationMs`/`retryCount` attached; a cadence with no handler defined fails gracefully
  - [ ] Every employee's `logic.ts` (pure calculation functions) and `module.ts` (actual `runDaily`/`runWeekly`/`runMonthly` orchestration, exercised via `runEmployeeTask`, not just unit-tested in isolation)
  - [ ] Meta Ads Specialist: CPL/CTR/CPC computed correctly including zero-lead/zero-click divide-by-zero guards; recommendation thresholds; new-campaign proposal drafting; `proposeAction` creates a pending approval and rejects `no_action`; `decideOnApproval` enforces owner-only RBAC and rejects unknown ids
  - [ ] Security: approval state machine (pending → approved/rejected), `assertApproved` gate
  - [ ] Sales Supervisor: rep classification, recovery/scaling strategy assignment, overall progress aggregation
  - [ ] Branch Performance Manager: fully data-driven branch grouping (no hardcoded branch names), status classification, recommendation text
  - [ ] Finance Analyst: anomaly detection flags a genuine outlier and ignores uniform/insufficient-sample categories; cashflow projection math
  - [ ] HR Officer: attendance-rate/lateness/leave-quota/KPI issue detection, coaching recommendation text
  - [ ] OTA Manager: dynamic-pricing recommendation direction (increase/decrease/hold) from occupancy + booking pace
  - [ ] SOP Guardian: missed-run/run-failed/excessive-retry/structural-step-missing detection, generically across `AI_MODULE_IDS`
  - [ ] Marketing Intelligence: `buildDiscoveredFacts` dedup-key construction; `buildDailyResearchSummary`/`buildWeeklyStrategy`/`buildMonthlyRetrospective`
  - [ ] Content Planner: checklist building/cycling, overdue detection (only up to "today", not future days), priority summary wording, monthly recap aggregation
  - [ ] CEO Assistant: attention/recommendations/tomorrow-priorities assembly across all 9 siblings, property income breakdown, weekly/monthly rollups, own memory (attention-theme-history)
  - [ ] `@mkh/memory`: `mergeKnowledgeItem` creates on first sight, bumps `timesSeen`/`lastSeenAt` on rediscovery, preserves `firstSeenAt` and merges metadata
  - [ ] Scheduler: `toCronExpression` for all 3 cadences + error cases (missing dayOfWeek/dayOfMonth, malformed time); `runScheduledTask` end-to-end for more than one employee and more than one cadence; `triggerEmployee` (manual trigger) tags runs `scheduledTime: "manual"` and rejects an unknown employee id
  - [ ] Connectors: registry resolves every port to its mock adapter; `ExternalSystemConnector`'s guardrail always throws; every mock adapter returns its expected shape
  - [ ] Notifications: all four real channel skeletons (WhatsApp/Telegram/Email/Push) stay undelivered whether or not their env vars are set, and never throw
  - [ ] `SupabaseRepository`: every CRUD method's request shape and error branch, via a fake chainable query-builder client (no live Supabase project needed)
  - [ ] Coverage thresholds enforced: 90% lines/statements/functions, 85% branches (`vitest.config.ts`)
- [ ] `pnpm build` — `apps/dashboard` still builds successfully with `DATA_MODE=dummy` (compatibility only, not a roadmap item)

## Manual QA — running the workforce end-to-end

- [ ] `pnpm scheduler:dev` starts without error and logs all 30 armed slots (10 employees × 3 cadences)
- [ ] `pnpm employee:trigger -- --module=<id> --cadence=daily` runs a single employee on demand and prints a `ScheduleRunRecord` with `scheduledTime: "manual"`
- [ ] For each employee, confirm:
  - [ ] A `WorkLogEntry` exists for every SOP step declared in `docs/SOP.md`, in order, ending in a "finished" step, tagged with the correct `attempt`
  - [ ] The resulting `AIReport` is queryable via `getRepository().getLatestReport(moduleId)`
- [ ] Run Marketing Intelligence twice in the same process/day and confirm via `getRepository().listKnowledgeItems({ moduleId: "marketing-intelligence" })`:
  - [ ] Run 1 produces N new items, 0 recurring
  - [ ] Run 2 produces 0 new items, N recurring, and `timesSeen` on each item is now 2 (no duplicate rows)
- [ ] Run Content Planner after Marketing Intelligence and confirm it reads Intelligence's `contentChecklist` and reflects it in the checklist
- [ ] Run Meta Ads Specialist and confirm every actionable recommendation (including a new campaign proposal, once Marketing Intelligence has a top opportunity) produced a pending `ApprovalRequest` (`getRepository().listApprovals("pending")`)
- [ ] Call `decideOnApproval(id, "approved", { role: "owner", name: "..." })` and confirm status flips; call it again with a non-owner role and confirm it throws
- [ ] Run SOP Guardian and confirm it flags every employee that hasn't run today as `missed_run`, and does not flag one that has
- [ ] Run CEO Assistant last and confirm it either reuses today's sibling reports or runs any missing ones itself (all 9), and that `attentionNeeded`/`recommendations`/`tomorrowPriorities` are all non-trivially populated when there's something to flag

## Manual QA — MCP server

- [ ] `pnpm mcp:dev` starts without error
- [ ] `list_ai_status` returns all 10 employees
- [ ] `get_latest_report` / `list_recent_reports` return data matching direct repository queries
- [ ] `list_pending_approvals` reflects any approvals created but not yet decided
- [ ] `list_knowledge_base` — with no `moduleId`, returns items across every employee; with a `moduleId`, is scoped to that one employee's memory only
- [ ] `list_work_log` filtered by `runId` returns exactly that run's step trail, in order

## Safety checks (must always pass)

- [ ] `getExternalSystemConnector().call()` throws unconditionally — no code path reaches `mkh.haluoleo.id`
- [ ] Sales Supervisor, Branch Performance Manager, Finance Analyst, HR Officer, and SOP Guardian never call a repository write method for business data (only `get*Snapshot`/`getHRSnapshot`/report reads)
- [ ] No code path calls a real Meta Ads "execute"/publish method — it doesn't exist in this phase
- [ ] No code path calls a real OTA channel manager API — `OTAConnector` is mock-only
- [ ] `DATA_MODE=dummy` requires zero external credentials to run
- [ ] All four notification channel adapters (WhatsApp/Telegram/Email/Push) no-op safely when their env vars are unset, and no employee ever imports a channel module directly (only `notify()`)
- [ ] No employee reads or writes another employee's `KnowledgeBase` memory

## Out of scope for this checklist

Dashboard UI walkthroughs are no longer part of the active testing
surface — `apps/dashboard` is frozen and only needs to keep compiling
(covered by `pnpm build` above), not to demonstrate new functionality.
