# Testing checklist

## Automated (run via `pnpm test` / CI)

- [ ] `pnpm install` completes without errors
- [ ] `pnpm typecheck` — zero type errors across all packages + dashboard
- [ ] `pnpm test` (Vitest):
  - [ ] Meta Ads: CPL/CTR/CPC computed correctly, including zero-lead/zero-click divide-by-zero guards
  - [ ] Meta Ads: recommendation thresholds (pause on zero-lead high-spend, decrease/increase budget on CPL thresholds, no_action in normal range)
  - [ ] Security: only `owner` role can approve an action; already-decided approvals can't be redecided; `assertApproved` blocks non-approved executions
  - [ ] Sales Supervisor: rep classification (achieved/on_track/lagging), overall progress aggregation, follow-up recommendation only attached to lagging reps
  - [ ] Finance Analyst: anomaly detection flags a genuine outlier and ignores uniform/insufficient-sample categories; cashflow projection math
  - [ ] Scheduler: `runScheduledModule` records a `schedule_runs` entry and links the produced report, for more than one module id
- [ ] `pnpm build` — `apps/dashboard` builds successfully with `DATA_MODE=dummy`

## Manual QA — Dashboard

- [ ] `pnpm dev`, visit `/status` — all 5 modules listed, "belum pernah jalan" until first run
- [ ] Trigger each module once (see below), then reload `/status` — statuses flip to `success` with a summary
- [ ] `/reports` — reports list newest-first, expanding a row shows the module's structured `data` as JSON
- [ ] `/logs` — scheduler run history and Meta Ads action-log audit trail render (empty states look correct before any runs)
- [ ] `/scheduler` — shows the 5 default slots (08:00/09:00/12:00/15:00/18:00 WITA) mapped to the right module
- [ ] `/notifications` — Sales Supervisor's "lagging rep" notification and any others appear with correct severity badges
- [ ] `/integrations` — every row shows "not configured (mock)" with no env vars set; setting one (e.g. `TELEGRAM_BOT_TOKEN`) flips its row to "configured"

## Manual QA — Modules end-to-end (dummy data)

Trigger via a short script/REPL (`tsx`) or `pnpm scheduler:dev` and observe:

- [ ] Marketing Strategist — weekly checklist has 7 days, daily recommendation references today's content idea, competitor notes mention both seeded competitors
- [ ] Meta Ads Operator — Stage 1 report lists all 4 seeded campaigns with recommendations; `proposeAction()` → `decideOnApproval()` (as `owner`) → `executeApprovedAction()` produces an `action_logs` entry; `decideOnApproval()` as a non-owner role throws
- [ ] Sales Supervisor — at least one seeded rep is flagged lagging (Budi Santoso, Makassar) and a Dir Ops notification is raised
- [ ] Finance Analyst — the seeded "pembelian alat berat" outlier transaction is flagged as an anomaly; cashflow projection is a finite number
- [ ] CEO Assistant — Executive Summary aggregates all 4 other modules' latest reports (auto-runs any missing one), `decisionsNeeded` includes the Meta Ads/Sales/Finance items above

## Manual QA — MCP server

- [ ] `pnpm mcp:dev` starts without error
- [ ] `list_ai_status` returns all 5 modules
- [ ] `get_latest_report` / `list_recent_reports` return data matching what's in the dashboard
- [ ] `list_pending_approvals` reflects any approvals created but not yet decided

## Safety checks (must always pass)

- [ ] `callMkConnect()` throws unconditionally — no code path reaches `mkh.haluoleo.id`
- [ ] Sales/Finance modules never call a repository write method for business data (only `get*Snapshot`)
- [ ] `executeMetaAdsAction()` is only reachable through `executeApprovedAction()`, which calls `assertApproved()` first
- [ ] `DATA_MODE=dummy` requires zero external credentials to run
