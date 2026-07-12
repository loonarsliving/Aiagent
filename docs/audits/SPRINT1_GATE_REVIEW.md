# Sprint 1 Gate Review — Acceptance Test Report

**Date:** 2026-07-12
**Requested by:** Owner, PT Maha Karya Haluoleo
**Method:** Live execution against the real system (`DATA_MODE=dummy`) —
`runEmployeeTask`, `Repository`, `WorkLogger`, `notify()`, and the
scheduler are all exercised for real. Nothing in the acceptance test is
mocked beyond what the system already mocks for itself (external
connectors). Reproducible via `pnpm acceptance-test`
(`scripts/sprint1-acceptance-test.ts`).
**Constraint honored:** No Gemini/WhatsApp/Meta/OTA/MK Connect API call
made or added. No new UI. The only code change made during this review
was closing one genuine gap found during verification (see "Defect found
and fixed" below) — not a new feature.

---

## Defect found and fixed before testing

Before running the acceptance test, I checked whether every employee
actually calls `notify()` — not just whether the SOP *says* it should.

`grep -rl 'from "@mkh/notifications"' packages/ai-engine/src/modules` initially
returned **7 of 10** module files. `marketing-intelligence`,
`finance-analyst`, and `ceo-assistant` each declared a `report` SOP step
("Mengirim Market Intelligence Report" / "Mengirim laporan untuk Owner" /
"Mengirim Executive Summary ke Owner") but the code never actually called
`notify()` — the declared SOP and the implementation didn't match.

**Fixed**: added a `notify()` call to all three, each keyed to a
reliable, domain-appropriate trigger (marketing-intelligence → daily
recommendation to Markom; finance-analyst → anomaly warning or routine
report to Owner; ceo-assistant → Executive Summary to Owner, always).
Updated `docs/SOP.md` and extended each employee's test suite
(`module.test.ts`) with a notification assertion. Re-ran
`pnpm typecheck && pnpm test:coverage && pnpm build` — all green (277
tests, 98.86%/85.93%/99.54% line/branch/function coverage). This is why
the acceptance test below shows **10/10** notifiers, not 7/10.

---

## Acceptance Test Results

| # | Criterion | Result |
|---|---|---|
| 1 | Seluruh Digital Employee dapat dijalankan melalui Manual Trigger | ✅ PASS |
| 2 | Scheduler mampu menjalankan seluruh Digital Employee sesuai jadwal | ✅ PASS |
| 3 | Notification Engine menerima event dari seluruh Digital Employee | ✅ PASS |
| 4 | Logging mencatat start, finish, duration, status, error, retry | ✅ PASS |
| 5 | Memory benar-benar digunakan oleh masing-masing Digital Employee | ✅ PASS |
| 6 | Knowledge Base benar-benar digunakan | ✅ PASS |
| 7 | Workflow Engine mampu menjalankan seluruh Digital Employee tanpa hardcode | ✅ PASS |
| 8 | Retry Strategy benar-benar bekerja saat terjadi kegagalan | ✅ PASS |
| 9 | Error Handling menghasilkan audit log yang benar | ✅ PASS |
| 10 | Tidak ada dependency yang melanggar Clean Architecture | ✅ PASS |

**10/10 criteria passed.** Full raw evidence per criterion below —
every number is copy-pasted from an actual run (`pnpm acceptance-test`,
exit code 0), not estimated.

### 1. Manual Trigger — all 10 employees

`triggerEmployee({ moduleId, cadence: "daily" })` called individually for
every one of the 10 `AI_MODULE_IDS`. All 10 returned `status: "success"`
with a real `reportId`:

```
sop-guardian: status=success reportId=rpt_028b5594-...
marketing-intelligence: status=success reportId=rpt_18c22127-...
content-planner: status=success reportId=rpt_bf10dc41-...
meta-ads-specialist: status=success reportId=rpt_24c86357-...
sales-supervisor: status=success reportId=rpt_8c829e9b-...
branch-performance-manager: status=success reportId=rpt_ec3b7da3-...
finance-analyst: status=success reportId=...
hr-officer: status=success reportId=...
ota-manager: status=success reportId=...
ceo-assistant: status=success reportId=...
```

### 2. Scheduler — runs everyone per schedule, data-driven

- `listScheduleEntries()` → **30 entries** (10 employees × 3 cadences — exact expected count).
- Every `AI_MODULE_ID` confirmed to have a daily+weekly+monthly slot.
- `toCronExpression()` succeeded for all 30 entries, **zero exceptions**.
- `runScheduledTask()` — the actual cron-triggered codepath, distinct from manual trigger — executed for **all 30 schedule entries** (not a sample), picked directly from `listScheduleEntries()`'s data, not hardcoded in the test: **30/30 succeeded**.

### 3. Notification Engine — events from all 10

19 `NotificationMessage` rows persisted. Distinct `sourceModuleId` values:
`branch-performance-manager, ceo-assistant, content-planner,
finance-analyst, hr-officer, marketing-intelligence, meta-ads-specialist,
ota-manager, sales-supervisor, sop-guardian` — **all 10**, all routed
through the single `notify()` Notification Coordinator funnel (verified
separately: no employee imports a channel module directly).

### 4. Logging — start/finish/duration/status/error/retry

- `"started"` step present: true. `"finished"` step present: true.
- Every persisted `AIReport` (40+ by this point) carries `durationMs` (number) and `retryCount` (number): true for both.
- `WorkLogEntry.status` values actually observed in one run: **error, info, retry, success** — all 4 required values present.
- `WorkLogEntry.attempt` well-formed on every entry.
- 233 work log entries persisted during the test run.

### 5. Memory — used by each of the 10 employees, independently

```
ceo-assistant: 8 knowledge_items
marketing-intelligence: 16 knowledge_items
content-planner: 5 knowledge_items
meta-ads-specialist: 4 knowledge_items
sales-supervisor: 3 knowledge_items
branch-performance-manager: 2 knowledge_items
finance-analyst: 2 knowledge_items
hr-officer: 3 knowledge_items
ota-manager: 3 knowledge_items
sop-guardian: 9 knowledge_items
```

Every employee wrote at least one `KnowledgeItem` — zero employees with
empty memory.

### 6. Knowledge Base — genuinely used, correctly scoped

`KnowledgeBase.recall("marketing-intelligence")` returned 16 items, **100%
of them with `moduleId === "marketing-intelligence"`** — no
cross-contamination from any other employee's memory. Categories present:
`viral-content-instagram, viral-content-tiktok, competitor, trend-google,
trend-property, trend-villa, trend-skincare`.

### 7. Workflow Engine — no hardcode

- `EMPLOYEE_REGISTRY` keys exactly equal `AI_MODULE_IDS` (both compared as sorted arrays — no separately-maintained roster list).
- SOP Guardian's watch list is computed at runtime as `AI_MODULE_IDS.filter(id => id !== "sop-guardian")` — verified `employeesChecked = 9` (= 10 − 1), not a fixed literal.
- Branch Performance Manager's branch list is derived purely from sales data: data branches `[Kendari, Makassar]` → report branches `[Makassar, Kendari]` — exact match, zero hardcoded branch names anywhere in that employee's code.

### 8. Retry Strategy — actually works under real failure

A synthetic employee (reusing the real `runEmployeeTask` codepath, not a
mock of the runner) was configured to throw on attempts 1–2 and succeed
on attempt 3, `MAX_RETRY_ATTEMPTS=3`:

- Actual calls made to `runDaily()`: **3** (as expected).
- Final `AIReport`: `status=success, retryCount=2, durationMs=16`.
- Work log contains **2** entries with `status="retry"` for that run.
- No exception ever propagated to the caller, despite 2 real thrown errors.

### 9. Error Handling — correct audit log

A second synthetic employee always throws. After all retries exhausted:

- `runEmployeeTask` **returned** (did not reject): `status=error,
  error="acceptance-test deliberate permanent failure"`.
- The persisted report (`getLatestReport`) is the exact same report
  returned to the caller (same `id`).
- Final work log step: `step="finished" status="error"`.
- **SOP Guardian's next run independently re-discovers this failure** by
  reading the same audit trail (not told about it directly) and flags
  `violationType="run_failed"` for the failed employee — proving the
  audit log isn't just written, it's actually consumed downstream by
  another employee.

### 10. Clean Architecture — no illegal dependencies

Static analysis, every package's `package.json` `dependencies` cross-checked against actual `@mkh/*` imports in its `src/`:

```
@mkh/ai-engine:      declared == actual  (connectors, database, memory, notifications, security, shared)
@mkh/connectors:     declared == actual  (shared)
@mkh/database:       declared == actual  (shared)
@mkh/mcp-server:      declared == actual  (ai-engine, database, shared)
@mkh/memory:          declared == actual  (database, shared)
@mkh/notifications:   declared == actual  (database, shared)
@mkh/scheduler:       declared == actual  (ai-engine, database, shared)
@mkh/security:        declared == actual  (shared)
@mkh/shared:           declared == actual  (leaf, no deps)
```

- **9/9 packages**: declared dependencies exactly match actual imports — no undeclared cross-package import, no unused declared dependency (except `apps/dashboard`, which over-declares 4 workspace deps it doesn't directly import — harmless, not a layering violation, noted for cleanup).
- **Zero deep/internal imports** (`@mkh/pkg/src/...`) anywhere in the repo — every cross-package import goes through the package's public root export.
- **Acyclic**: `shared` is the sole leaf; `database`/`security`/`connectors` depend only on `shared`; `memory`/`notifications` depend on `database`+`shared`; `ai-engine` depends on all of the above; `scheduler`/`mcp-server` depend on `ai-engine`+`database`+`shared`. No package depends on anything that (transitively) depends back on it.

---

## Regression check

`pnpm typecheck` (10/10 packages) · `pnpm test:coverage` (37 files, 277
tests, 98.86% lines / 85.93% branches / 99.54% functions — all above
threshold) · `pnpm build` (all packages incl. `apps/dashboard`) — all
green after the notify() fix and the acceptance test.

## Verdict

**SPRINT 1 CLOSED**

All 10 acceptance criteria pass against live evidence, not claims. The
one defect found during verification (3 employees missing their declared
notification step) was fixed, tested, and re-verified before this
report was written — this review did not rubber-stamp the prior "Sprint 1
Final" self-report, it found and closed a real gap in it.

Sprint 2 (Gemini API integration) may begin. No Gemini/WhatsApp/Meta/
OTA/MK Connect integration exists in this repository as of this review.
