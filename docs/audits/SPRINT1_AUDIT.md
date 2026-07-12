# Sprint 1 Technical Audit — CTO Report

**Date:** 2026-07-12
**Scope:** Full repository — architecture, AI worker roster, workflow engine,
scheduler, notification engine, memory, knowledge base, logging,
configuration, security, performance, testing, business logic.
**Constraint honored:** No new features, no API integrations (Gemini,
WhatsApp, Meta, OTA, MK Connect), no UI added. Fixes applied are limited to
verified defects and behavior-preserving refactors.

---

## Method

This audit was done by reading the actual source (dependency graph traced
via import statements, not assumed), running `pnpm audit`, grepping for
dangerous patterns (`eval`, `child_process`, hardcoded secrets, retry
logic), and cross-checking the AI worker roster against the 11 roles
specified as the enterprise minimum. Every claim below is backed by a
command or file reference, not recollection.

## 1. Architecture

**Dependency graph (verified, not assumed):**

```
shared (leaf)
  ← database, security, connectors
    ← memory, notifications
      ← ai-engine
        ← scheduler, mcp-server
```

Confirmed acyclic — no package imports anything that (transitively) imports
it back. `database` does NOT depend on `ai-engine`/`memory`/`security`
despite docstrings mentioning those packages by name (verified those are
comments, not imports). This is genuinely clean layered architecture.

**Extensibility gap:** `AIModuleId` is a compile-time string union
(`packages/shared/src/types.ts`). Adding a 7th employee requires editing
exactly 3 code files (`shared/types.ts`, `ai-engine/registry.ts`,
`mcp-server/index.ts` validates against the same union) plus schedule
entries in `seed-data.ts`. This is safe (type-checked, can't typo a module
id) but not dynamic/plugin-based — you cannot register a worker via config
alone. Acceptable tradeoff for a system this size; would need
reconsideration past ~20 workers.

**Verdict:** ✅ Production-ready as a foundation. 🟡 Not yet "fully
generic" in the plugin-registration sense the brief asks for — currently
"generic in behavior, additive in registration."

## 2. AI Worker Roster

| Required role | Status | Existing implementation |
|---|---|---|
| Executive Assistant | ✅ | `ceo-assistant` (name: "CEO Assistant AI") |
| Marketing Intelligence | ✅ | `marketing-intelligence` |
| Markom Supervisor | 🟡 partial | `marketing-operation` covers checklist/reminders but wasn't built under this name |
| Sales Supervisor | ✅ | `sales-supervisor` |
| Finance Analyst | ✅ | `finance-analyst` |
| Meta Ads Specialist | ✅ | `meta-ads-operator` (name: "Meta Ads AI") |
| Branch Performance Manager | 🔴 missing | does not exist in any form |
| Content Planner | 🔴 missing | does not exist as a distinct worker (Marketing Intelligence produces raw content *ideas*, not a content calendar/creative brief) |
| HR Officer | 🔴 missing | does not exist — first time this role has appeared in any brief for this project |
| OTA Manager | 🔴 missing | does not exist — no OTA (Booking.com/Airbnb/Traveloka-style) concept anywhere in the codebase |
| SOP Guardian | 🔴 missing | does not exist — no worker audits whether other workers completed their SOP |

**6 of 11 required roles exist. 5 are completely absent — not
placeholders, not stubs, simply not present in the repository.**

Of the 6 that do exist, quality is consistently high: every one implements
`AIEmployee` with `runDaily` (+ `runWeekly`/`runMonthly`), a declared SOP
(`docs/SOP.md`), genuine calculation logic (not mocked math), and dedicated
unit tests. There is no "fake" worker in the 6 — where the roster is
built, it's built to a real standard.

**Verdict:** 🔴 Roster completeness is the single biggest gap in this
audit. Quality-where-present is ✅; breadth is 45% short of the stated
minimum.

## 3. Workflow Engine

`runEmployeeTask(employee, cadence, context)`
(`packages/ai-engine/src/core/agent-runner.ts`) is generic: it doesn't
branch on which employee it's running, always persists a report (even on
throw), and always writes a work-log trail. `EMPLOYEE_REGISTRY` is a
lookup table, not a chain of if/else. Verified: zero occurrences of an
employee id being special-cased inside the runner or scheduler.

**Verdict:** ✅ Structurally generic and correctly free of hardcoding. 🟡
Registration is additive-file-based, not zero-code (see Architecture).

## 4. Scheduler

`toCronExpression()` correctly handles daily/weekly/monthly (6/6 tests
passing, including malformed-input error cases). `local-runner.ts` arms
every enabled schedule entry regardless of cadence — confirmed generic.

**Manual trigger — confirmed gap.** `AIRunContext.triggeredBy` has
`"manual"` as a valid value, and `runEmployeeTask`/`runScheduledTask` can
technically be called directly, but **there is no exposed script, CLI
command, or entrypoint** for an operator to actually do this — verified
zero matching command in `package.json` scripts across the repo. Today,
"manual trigger" means "write a throwaway TypeScript file," not an
operational capability.

**Verdict:** ✅ Daily/weekly/monthly generation is solid and tested. 🔴
Manual trigger is not an operator-usable capability yet, despite the
underlying function supporting it.

## 5. Notification Engine

`NotificationChannel` interface + a `CHANNELS` registry
(`packages/notifications/src/notification-service.ts`) — `notify()` never
references WhatsApp/Telegram/Email/Push by name, only by looking up
`config.NOTIFY_CHANNEL_DEFAULT` in the registry. All 4 real channels are
inert-but-safe (return `delivered: false` and log a warning when
unconfigured, confirmed by new test coverage — never throw). This is the
strongest-built abstraction in the repo relative to what was asked.

**Verdict:** ✅ Production-ready abstraction. Swapping in a real WhatsApp
integration later is "fill in one file," not a redesign.

## 6. Memory

`@mkh/memory`'s `KnowledgeBase` class and the underlying
`Repository.upsertKnowledgeItem`/`listKnowledgeItems` are already
per-`moduleId` scoped — nothing prevents Sales or HR from getting their
own memory today; the mechanism is generic. **But only Marketing
Intelligence actually uses it.** Sales Supervisor, Finance Analyst, and
the not-yet-built HR Officer have no persistent memory of their own —
each daily run only has access to its own `AIReport` history via
`aggregateRecentReports`, which is not the same as a knowledge base.

**Verdict:** ✅ Abstraction is real, tested (13 tests), and reusable. 🟡
Adoption is 1 of 6 existing employees — "setiap AI dapat memiliki memory
sendiri" is proven possible but not yet demonstrated broadly.

## 7. Knowledge Base

Confirmed: the only consumer (`marketing-intelligence/module.ts`) accesses
knowledge exclusively through `new KnowledgeBase(getRepository())`, never
calling `getRepository().listKnowledgeItems()` directly. No bypass found
anywhere in the codebase.

**Verdict:** ✅ Correctly abstracted where used. Narrow adoption is the
same caveat as Memory (#6), not a separate defect.

## 8. Logging

`WorkLogEntry` (`packages/shared/src/types.ts`) carries: `step` (implicit
start via `"started"` step), `status`, `detail` (output/error text),
`loggedAt`. `AIReport` separately carries `status` and `error`.

| Required attribute | Status |
|---|---|
| Start Time | ✅ first `WorkLogEntry` per run |
| Finish Time | ✅ last `WorkLogEntry` per run |
| Status | ✅ `WorkLogEntry.status` + `AIReport.status` |
| Output | ✅ `AIReport.summary`/`data` |
| Error | ✅ `AIReport.error` |
| Retry | 🔴 **does not exist anywhere in the codebase** (verified via grep for retry/backoff/maxAttempts — zero matches) |
| Duration | 🟡 computed (`durationMs` in `agent-runner.ts`) but only passed to the console logger — never persisted as a field on `WorkLogEntry` or `ScheduleRunRecord`. Derivable from `startedAt`/`finishedAt` but not a first-class stored value. |

**Verdict:** 5 of 7 required attributes are solid. Retry is a confirmed,
complete gap — a transient failure today just fails, once, with no
automatic recovery. This is a real reliability gap for a system meant to
run unattended for years.

## 9. Configuration

`packages/shared/src/config.ts` — zod-validated, single source of truth,
confirmed zero hardcoded secrets anywhere in the codebase (grepped for
API-key/secret/password literal patterns — clean) and `.env.example` has
no real values.

Two constants live in code rather than config: `COMPANY_TIMEZONE`
("Asia/Makassar", now centralized in `packages/shared/src/timezone.ts` as
part of this audit — previously duplicated) and per-employee business
thresholds (e.g. `CPL_TARGET_IDR`, `ANOMALY_MULTIPLIER`). These are
legitimate named constants for business logic, not secrets or
environment-specific values — acceptable, but worth listing since the
brief asked for zero hardcoding without qualification.

**Verdict:** ✅ Secrets/environment config is clean and centralized. 🟡
Business-tuning constants are code, not config — fine for now, flag if
non-engineers will need to tune them without a deploy.

## 10. Security

- No `eval`/`child_process`/`new Function` anywhere (grepped, clean).
- No hardcoded secrets anywhere (grepped, clean); `.env.example` has only
  empty placeholders.
- MK Connect guardrail (`mockExternalSystemAdapter.call()`) confirmed to
  always throw — no code path reaches `mkh.haluoleo.id`.
- RBAC (`@mkh/security`) confirmed enforced and tested — only the `owner`
  role can decide a Meta Ads approval.
- **Dependency vulnerabilities found and partially fixed during this
  audit:** `pnpm audit` found 25 vulnerabilities in `next@14.2.15`
  (1 critical — Authorization Bypass in Next.js Middleware, GHSA-f82v-jwr5-mffw
  — plus 7 high). Bumped to `14.2.35` (still Next 14, no breaking changes,
  build/tests re-verified green): now 0 critical, 5 high remaining. The
  remaining 5 require a Next.js **15** major-version migration, which is a
  real migration with breaking-change risk — correctly out of scope for a
  same-version patch during an audit; flagged for a deliberate Sprint 2
  task, not rushed here.
- **Latent (not active) concurrency risk:** `KnowledgeBase.remember()`
  reads all existing items once, then writes; if the same employee's
  `runDaily` were ever triggered twice concurrently (e.g. manual + a
  scheduled run overlapping), the second run's write could be based on a
  stale read. Not currently reachable — the scheduler only fires one
  instance per slot — but worth a guard before any HTTP-triggered or
  multi-instance deployment.

**Verdict:** 🟡 Real vulnerabilities existed and are now substantially
addressed (critical → 0). No code-level security bugs found. One
forward-looking concurrency risk documented, not yet exploitable.

## 11. Performance

- `ceo-assistant` and `marketing-intelligence` already parallelize
  independent connector calls via `Promise.all` — good practice already in
  place before this audit.
- **Found and fixed:** `KnowledgeBase.remember()` was upserting facts one
  at a time in a sequential `for`-`await` loop — N round-trips in series
  against `SupabaseRepository` once that's live. Parallelized via
  `Promise.all`; output is provably identical (each fact's dedup key is
  independent), verified by the existing + new test suite still passing.
- No queue system exists. Not currently a bottleneck — every trigger today
  is a single cron firing, not concurrent request load — but worth
  planning for once an HTTP-triggered path (Vercel/MK Connect webhook) is
  activated.

**Verdict:** ✅ One real bottleneck found and fixed with zero behavior
change. No other bottlenecks found at current scale.

## 12. Testing

| Package | Before this audit | After this audit |
|---|---|---|
| shared | 0 test files | ✅ `config.test.ts`, `timezone.test.ts` |
| database | 0 test files | ✅ `in-memory-repository.test.ts` (19 tests), `supabase-repository.test.ts` (8 tests, pure row-mapping) |
| security | 1 test file (approval-gate only) | ✅ + `roles.test.ts` |
| memory | 1 test file (merge only) | ✅ + `knowledge-base.test.ts` |
| notifications | 0 test files | ✅ `notification-service.test.ts` |
| connectors | 0 test files | 🔴 still untested (mock adapters — lower risk, static fixtures) |
| mcp-server | 0 test files | 🔴 still untested (thin wrapper over already-tested repository methods — lower risk) |
| ai-engine | 8 test files | unchanged, already solid |
| scheduler | 2 test files | unchanged, already solid |

**Total: 72 → 125 passing tests, 12 → 19 test files.** No mock data or
dummy implementation found masquerading as real logic — every "mock" in
the codebase (connectors) is clearly labeled and isolated behind the ports
abstraction (see `docs/CONNECTORS.md`).

**Verdict:** 🟡 Materially improved this session. `connectors` and
`mcp-server` remain untested but are the lowest-risk packages in the
repo (static data / thin delegation).

## 13. Business Logic

All tested calculation logic (CPL/CTR/CPC thresholds, anomaly detection,
sales lagging classification, cashflow projection, checklist priority
assignment) reviewed — no correctness bugs found beyond the one below.
Thresholds are simple and explainable by design (documented in each
`logic.ts`), appropriate for pre-real-data tuning.

**Found and fixed:** `ceo-assistant`'s "is today's report still fresh"
check (`getOrRunLatestDaily`) compared dates using
`Date.prototype.toDateString()`, which uses the **server's local
timezone**, not the company's `Asia/Makassar` timezone the scheduler
itself uses. This was flagged in the previous audit and never fixed.
Fixed this session via a new shared `isSameCompanyDay()` helper
(`packages/shared/src/timezone.ts`), tested, and applied at both call
sites (`ceo-assistant` and `scheduler/local-runner.ts`, which had the same
timezone string duplicated as a local constant).

**Verdict:** ✅ Logic is sound. One real, previously-flagged, unfixed bug
is now closed.

## 14. Refactor Log (this session)

All changes below are behavior-preserving or bug-fixing — no new
features, no new integrations, no UI.

1. **Fixed:** `isSameDay` in `ceo-assistant/module.ts` used server-local
   time instead of `Asia/Makassar` — replaced with a new, tested,
   centralized `isSameCompanyDay()` in `@mkh/shared`.
2. **Refactored:** Centralized the duplicated `"Asia/Makassar"` string
   constant (`ceo-assistant` and `scheduler/local-runner.ts`) into
   `COMPANY_TIMEZONE` in `@mkh/shared`.
3. **Fixed (performance):** `KnowledgeBase.remember()` now upserts facts
   concurrently (`Promise.all`) instead of sequentially — identical
   output, faster once a real database is behind it.
4. **Fixed (security):** `next` bumped `14.2.15` → `14.2.35` — resolves 1
   critical + 2 high CVEs, no breaking changes, build/tests re-verified.
5. **Refactored (testability):** Exported four previously-private
   row-mapping functions in `supabase-repository.ts`
   (`mapReportRow`, `mapScheduleRunRow`, `toApprovalRow`, `mapApprovalRow`,
   plus the `Row` type) — visibility-only change, enables direct unit
   testing of the Supabase column mapping without a live database.
6. **Added tests** (no behavior change) closing 0%-coverage gaps in
   `shared`, `database`, `security`, `memory`, `notifications` — see
   Testing section above for the full breakdown.

## 15. Documentation

- This report: `docs/audits/SPRINT1_AUDIT.md` (new).
- `docs/ROADMAP.md` updated with the Sprint 2 prerequisite list distilled
  from this audit (see below).
- `docs/ARCHITECTURE.md`, `docs/SOP.md`, `docs/CONNECTORS.md`,
  `docs/TESTING_CHECKLIST.md` reviewed against current code during this
  audit — found accurate, no corrections needed beyond what's captured
  here.

---

## CTO Scorecard

| Dimension | Score | Basis |
|---|---|---|
| **Architecture quality** | **78/100** | Verified acyclic, cleanly layered, real abstractions (ports/adapters, RBAC-over-storage). Docked for non-dynamic worker registration and the ongoing drag of a frozen-but-still-built dashboard. |
| **Maintainability** | **76/100** | Consistent patterns across all 6 workers, now-solid test coverage in previously-untested packages, clear docs. Docked for 5-file registration cost per new employee and code-level business constants. |
| **Scalability** | **70/100** | Clean swap path to Supabase already proven (same interface, zero employee-code changes). Docked for `InMemoryRepository`'s unbounded in-process growth (dev-mode only, but real) and the absence of any queue for when trigger volume grows. |
| **Security** | **75/100** | Zero hardcoded secrets, no dangerous code patterns, guardrails enforced and tested. Started this audit with a critical CVE in a pinned dependency (now fixed); 5 high-severity items remain pending a deliberate Next 15 migration. One latent concurrency risk documented. |
| **Business readiness** | **50/100** | This is the deciding number. Where the roster is built (6/11), it's built to real enterprise standard — no shortcuts, no fake mocks passed off as logic. But 5 of 11 required workers (Branch Performance Manager, Content Planner, HR Officer, OTA Manager, SOP Guardian) are completely absent, Retry logic doesn't exist, there is no operator-usable manual-trigger entrypoint, and memory/knowledge-base is proven but only adopted by 1 employee. A Digital Management Team that's missing HR, OTA, and SOP oversight, with no retry and no manual trigger, is not yet ready to have Gemini/WhatsApp/Meta/OTA wired in on top. |

---

## Verdict: Sprint 1 is **NOT** ready to close.

The engineering foundation itself — architecture, workflow engine,
notification abstraction, scheduler mechanics, and (as of this session)
test discipline — is genuinely strong and worth building on for years, not
months. That part of the brief ("saya ingin software yang menjadi Digital
Management Team selama bertahun-tahun") is being honored.

But "Sprint 1 closed" has to mean the **foundation is complete**, not just
**high quality where it exists**. Right now:

- **5 of 11 required AI Workers don't exist** — not placeholders, absent.
- **Retry logic doesn't exist** — any transient failure in any worker,
  forever, just fails once with no recovery.
- **No operator can manually trigger a worker** without writing code —
  the capability exists in the function signature, not as a usable tool.
- **Memory is proven but adopted by 1 of 6 workers** — Sales, Finance, and
  the not-yet-built HR Officer have no persistent memory of their own.

Connecting Gemini, WhatsApp, Meta, OTA, or MK Connect on top of this today
would mean building real integrations against a workforce that's less than
half staffed, with no safety net for failures. That's the wrong order of
operations for software meant to run a company's operations for years.

**Recommendation: stay in Sprint 1.** Do not proceed to the AI Provider
(Gemini) integration or any other API work until, at minimum:

1. The remaining 5 AI Workers exist with the same structural standard as
   the current 6 (SOP, 3 cadences, tests, real — not mocked — logic).
2. A retry mechanism exists in `runEmployeeTask` (bounded attempts,
   backoff, and the outcome recorded in the work log).
3. A manual-trigger entrypoint exists (a CLI script is the minimum bar) so
   an operator — not just a test file — can run any employee on demand.
4. Memory is extended to at least Sales and Finance, proving the
   abstraction generalizes beyond its one current adopter.

None of the above was implemented in this session, per the explicit
instruction to audit and refactor only, not add features. This report is
the basis for scoping that work as the next deliverable, on your
direction.
