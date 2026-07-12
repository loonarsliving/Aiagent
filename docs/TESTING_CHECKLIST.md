# Testing checklist

## Automated (run via `pnpm test` / CI)

- [ ] `pnpm install` completes without errors
- [ ] `pnpm typecheck` — zero type errors across all 10 packages + dashboard
- [ ] `pnpm test` (Vitest), covering:
  - [ ] Meta Ads: CPL/CTR/CPC computed correctly, including zero-lead/zero-click divide-by-zero guards; recommendation thresholds
  - [ ] Meta Ads workflow: `proposeAction` creates a pending approval and rejects `no_action` recommendations; `decideOnApproval` enforces owner-only RBAC and rejects unknown ids
  - [ ] Security: approval state machine (pending → approved/rejected), `assertApproved` gate
  - [ ] Sales Supervisor: rep classification, overall progress aggregation, follow-up recommendation only on lagging reps
  - [ ] Finance Analyst: anomaly detection flags a genuine outlier and ignores uniform/insufficient-sample categories; cashflow projection math
  - [ ] Marketing Intelligence: `buildDiscoveredFacts` dedup-key construction; `buildDailyResearchSummary`/`buildWeeklyStrategy`/`buildMonthlyRetrospective`
  - [ ] Marketing Operation: checklist building/cycling, overdue detection (only up to "today", not future days), priority summary wording, monthly recap aggregation
  - [ ] CEO Assistant: attention/recommendations/tomorrow-priorities assembly, property income breakdown, weekly/monthly rollups
  - [ ] `@mkh/memory`: `mergeKnowledgeItem` creates on first sight, bumps `timesSeen`/`lastSeenAt` on rediscovery, preserves `firstSeenAt` and merges metadata
  - [ ] Scheduler: `toCronExpression` for all 3 cadences + error cases (missing dayOfWeek/dayOfMonth, malformed time); `runScheduledTask` end-to-end for more than one employee and more than one cadence
  - [ ] `runEmployeeTask` error path: an employee that throws still returns a persisted `status: "error"` report instead of rejecting; a cadence with no handler defined also fails gracefully
- [ ] `pnpm build` — `apps/dashboard` still builds successfully with `DATA_MODE=dummy` (compatibility only, not a roadmap item)

## Manual QA — running the workforce end-to-end

- [ ] `pnpm scheduler:dev` starts without error and logs all 18 armed slots (6 employees × 3 cadences)
- [ ] Trigger a daily run manually (e.g. a short `tsx` script calling `runEmployeeTask`) for each employee and confirm:
  - [ ] A `WorkLogEntry` exists for every SOP step declared in `docs/SOP.md`, in order, ending in a "finished" step
  - [ ] The resulting `AIReport` is queryable via `getRepository().getLatestReport(moduleId)`
- [ ] Run Marketing Intelligence twice in the same process/day and confirm via `getRepository().listKnowledgeItems({ moduleId: "marketing-intelligence" })`:
  - [ ] Run 1 produces N new items, 0 recurring
  - [ ] Run 2 produces 0 new items, N recurring, and `timesSeen` on each item is now 2 (no duplicate rows)
- [ ] Run Marketing Operation after Marketing Intelligence and confirm it reads Intelligence's `contentChecklist` and reflects it in the weekly checklist
- [ ] Run Meta Ads AI and confirm every actionable recommendation produced a pending `ApprovalRequest` (`getRepository().listApprovals("pending")`)
- [ ] Call `decideOnApproval(id, "approved", { role: "owner", name: "..." })` and confirm status flips; call it again with a non-owner role and confirm it throws
- [ ] Run CEO Assistant last and confirm it either reuses today's sibling reports or runs any missing ones itself, and that `attentionNeeded`/`recommendations`/`tomorrowPriorities` are all non-trivially populated when there's something to flag

## Manual QA — MCP server

- [ ] `pnpm mcp:dev` starts without error
- [ ] `list_ai_status` returns all 6 employees
- [ ] `get_latest_report` / `list_recent_reports` return data matching direct repository queries
- [ ] `list_pending_approvals` reflects any approvals created but not yet decided
- [ ] `list_knowledge_base` returns Marketing Intelligence's accumulated items with correct `timesSeen`
- [ ] `list_work_log` filtered by `runId` returns exactly that run's step trail, in order

## Safety checks (must always pass)

- [ ] `getExternalSystemConnector().call()` throws unconditionally — no code path reaches `mkh.haluoleo.id`
- [ ] Sales/Finance employees never call a repository write method for business data (only `get*Snapshot`)
- [ ] No code path calls a real Meta Ads "execute"/publish method — it doesn't exist in this phase
- [ ] `DATA_MODE=dummy` requires zero external credentials to run
- [ ] All four notification channel adapters (WhatsApp/Telegram/Email/Push) no-op safely when their env vars are unset

## Out of scope for this checklist

Dashboard UI walkthroughs are no longer part of the active testing
surface — `apps/dashboard` is frozen and only needs to keep compiling
(covered by `pnpm build` above), not to demonstrate new functionality.
