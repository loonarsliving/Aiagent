# Infrastructure — Sprint 3B (AI Infrastructure, No External API)

Sprint 3B builds the production infrastructure the AI Operating System
needs *before* any external integration (WhatsApp, Meta, OTA, MK Connect,
Gmail, Telegram, or a live Gemini call in a background job) is authorized.
Nothing in this document sends anything anywhere — every "dispatch" or
"delivery" concept here stops at "durably queued," never "sent." That
boundary is deliberate and enforced by the code, not just documented: grep
this repo for an outbound `fetch`/HTTP client call in any file listed below
and you won't find one.

## 1. Distributed Scheduler Lock

**Files:** `packages/scheduler/src/distributed-lock.ts`,
`packages/database` (`SchedulerLock` type, `Repository.acquireLock`/
`releaseLock`/`getLock`), `supabase/migrations/20260713000001_sprint3b_infrastructure.sql`
(`scheduler_locks` table + `acquire_scheduler_lock()` Postgres function).

Two scheduler processes can end up alive at once — a redeploy that
overlaps the old instance, a developer running `pnpm scheduler:dev`
against the same Supabase project as production. Without a lock, both
would run the same employee's same time slot, producing duplicate Gemini
calls (once that's wired) and duplicate reports.

`withDistributedLock(lockKey, fn, options)` acquires a lease-based lock
(`acquireLock` with a TTL-derived `expiresAt`), runs `fn`, and always
releases in a `finally`. If the lock is already held by a live holder, it
throws `LockNotAcquiredError` **without calling `fn`** — no silent partial
execution.

`runScheduledTask` (`packages/scheduler/src/executor.ts`) wraps every run
in this lock, keyed `scheduler:{moduleId}:{cadence}` — daily/weekly/monthly
slots for the same employee never contend with each other, only identical
slots do. A lost race records a `ScheduleRunRecord` with
`status: "skipped"` (a new status value, alongside `running`/`success`/
`error`) instead of silently doing nothing — the audit trail shows *why*
nothing happened.

**Crash recovery:** the lock is a lease, not a mutex — `expiresAt` bounds
how long a crashed holder can block others. `acquireLock` succeeds if the
lock is free, already expired, or already held by the caller (idempotent
renewal); it only fails when genuinely held live by someone else.

**Concurrency guarantee, by data mode:**
- `SupabaseRepository.acquireLock` calls the `acquire_scheduler_lock`
  Postgres function — an `INSERT ... ON CONFLICT (lock_key) DO UPDATE ...
  WHERE <expired or same holder>` guarded by `GET DIAGNOSTICS ROW_COUNT`,
  fully atomic under concurrent callers.
- `InMemoryRepository.acquireLock` is a single-threaded Map check — atomic
  by construction (Node has no real concurrency within one process).

## 2. Job Queue

**Files:** `packages/queue/src/job-queue.ts`, `packages/database`
(`QueueJob`/`JobStatus`/`JobPriority` types, `Repository.enqueueJob`/
`getJob`/`listJobs`/`updateJob`/`claimNextPendingJob`), `priority-rank.ts`
(shared priority ordering), the `jobs` table in the same Sprint 3B
migration.

One generic mechanism backs every asynchronous job kind — `type` is the
discriminator (e.g. `"notification-dispatch"`), so a new job kind never
means a new table. `JobQueue` wraps `Repository`:

- `enqueue(type, payload, options)` — `priority` defaults to `"normal"`,
  `runAt` defaults to now (immediate), `maxAttempts` defaults to
  `config.QUEUE_MAX_ATTEMPTS`.
- `claimNext(type?)` — atomically claims the highest-priority, earliest-due
  pending job.
- `complete(jobId)` / `fail(jobId, error)`.
- `listDeadLetters(type?)`, `countByStatus(status, type?)`.

**Concurrency, deliberately asymmetric with the scheduler lock:**
`claimNextPendingJob` is a "best-effort" claim — select the top candidate
client-side, then a conditional update that only succeeds if the job is
still `"pending"`. A double-claim means a job runs twice, which is a
tolerable, low-stakes outcome for queued work (unlike the scheduler lock,
where a double-run means duplicate Gemini calls against a real employee
slot). This trade-off is intentional, not an oversight — see the code
comments in `supabase-repository.ts` for both sides of the comparison.

## 3. Retry Engine

**Files:** `packages/shared/src/retry-policy.ts` (`computeBackoffMs`,
`isPermanentFailure`, `sleep`).

One formula, one place: `computeBackoffMs(baseMs, attempt) = baseMs *
2^attempt`. Previously duplicated identically in `agent-runner.ts` (task
retries) and `reasoning-engine.ts` (reasoning-call retries) — consolidated
here so the Job Queue's retry logic is the third consumer of the same
tested function, not a fourth reimplementation.

`JobQueue.fail()` uses `isPermanentFailure(attempts - 1, job.maxAttempts)`
to decide: re-queue with `runAt = now + computeBackoffMs(...)` while
attempts remain, or move to `status: "dead"` (the Dead Letter Queue) once
exhausted. `listDeadLetters()` is how a future operator (or the monitoring
snapshot below) finds permanently-failed jobs.

## 4. Persistence Layer

**Files:** `packages/database/src/repository.ts` (interface),
`in-memory-repository.ts` / `supabase-repository.ts` (the two
implementations, kept in exact behavioral parity by a shared test suite).

Sprint 3B adds three new persisted record kinds, all reachable identically
whether `DATA_MODE=dummy` (in-memory) or `DATA_MODE=supabase` (Postgres):

- **Job persistence** — `QueueJob` (backs the Job Queue above).
- **Scheduler lock persistence** — `SchedulerLock` (backs the distributed
  lock above).
- **Conversation persistence** — `ConversationLogEntry`: the verbatim
  `systemPrompt`/`userPrompt`/`responseText` for a reasoning attempt
  sequence, saved by `runReasoning()` (`packages/ai-engine/src/reasoning/
  reasoning-engine.ts`) whenever the provider returned any text — even a
  malformed/failed-validation response is worth keeping for debugging. This
  is deliberately a *separate* table from `AIReasoningLogEntry` (Sprint
  2's metadata-only audit log: provider/model/tokens/timing/status) — one
  stays cheap to query for dashboards, the other exists to replay a
  specific decision.
- **AI task persistence** — already existed (`AIReport`,
  `AIReasoningLogEntry`, `WorkLogEntry`); unchanged this sprint.
- **Notification persistence** — already existed for `notify()`'s
  synchronous `NotificationMessage` log; Sprint 3B adds the *queued* side
  (see §6).

## 5. Manual Trigger Engine

**Files:** `packages/scheduler/src/manual-trigger.ts`, `trigger-cli.ts`.

- **Trigger by Worker / by Employee** — `triggerEmployee({ moduleId,
  cadence, requestedBy, dryRun? })`. In this system's model "employee" and
  "worker" are the same concept (a digital worker *is* an AIEmployee), so
  there's no separate trigger path for one vs. the other.
- **Trigger by Company** — `triggerAllWorkers({ cadence, requestedBy,
  dryRun? })` loops every registered employee (`AI_MODULE_IDS`) and
  triggers each, sequentially (so one employee's failure or slow run never
  blocks or races another's `ScheduleRunRecord` writes). The system models
  exactly one company today, so "by company" and "all workers" are the
  same operation.
- **Trigger by Branch** — **explicitly out of scope.** There is no
  per-branch worker instantiation anywhere in this codebase — e.g. Branch
  Performance Manager already analyzes every branch in a single run.
  Building a distinct branch-level trigger would require a real
  architecture change (per-branch employee instances or a branch parameter
  threaded through every module) out of proportion to this sprint. Revisit
  if/when a future sprint needs true per-branch isolation.
- **Dry Run mode** — `dryRun: true` validates the request (employee id
  exists, the requested cadence has a task method — checked via the new
  exported `cadenceMethodExists()`) and returns a `DryRunResult` describing
  what *would* run, without calling `runEmployeeTask` or writing a
  `ScheduleRunRecord`. Any side effect at all (a report, a work log entry,
  a schedule run row) means it wasn't a dry run.
- **CLI** — `pnpm employee:trigger -- --module=<id> [--cadence=...] [--by=...] [--dry-run]`
  and `pnpm employee:trigger -- --all [--cadence=...] [--dry-run]`.

## 6. Notification Queue

**Files:** `packages/notifications/src/notification-queue.ts`.

**This class never sends anything.** `NotificationQueue` is a thin
domain-specific wrapper over the generic Job Queue: `enqueue(notification)`
stores a Sprint 3A `NotificationObject` as the payload of a
`type: "notification-dispatch"` job (mapping `ReasoningPriority` ->
`JobPriority`), and `claimNext()`/`complete()`/`fail()` manage its
lifecycle exactly like any other job. `NotificationObject.channel` is
always the Sprint 1 placeholder value (`"dummy"` today; WhatsApp/Telegram/
Email/Dashboard remain unimplemented connector *ports*, not adapters) —
there is no connector call anywhere in this file, and there won't be until
an external integration is explicitly authorized.

This is deliberately a second, distinct thing from Sprint 1's `notify()`
(`packages/notifications/src/notification-service.ts`), which still fires
synchronously through the existing inert channel adapters. `notify()` is
"log it and attempt immediate delivery" (still a no-op today since every
adapter is inert); `NotificationQueue` is "hold it durably, with retry/DLQ
semantics, for something else to process later." Neither replaces the
other.

## 7. AI Monitoring

**Files:** `packages/monitoring/src/snapshot.ts`.

`getMonitoringSnapshot(repo?)` is a pure read-side aggregator — no new
storage, backend-only, no UI. One call returns:

| Brief item | Field |
|---|---|
| Worker status | `workers[]` — per `AI_MODULE_ID`, last report's status/cadence/time |
| Queue length / Failed jobs | `queue` — counts by `JobStatus` across every job type |
| Retry count | `queue.retrying` — pending jobs with `attempts > 0` |
| Average reasoning time | `reasoning.averageResponseTimeMs` (today, company timezone) |
| Scheduler heartbeat | `scheduler` — most recent `ScheduleRunRecord`'s time/status |
| Memory usage | `memoryUsage` — `process.memoryUsage()` |
| Token usage | `reasoning.totalTokensToday` |
| Daily AI execution count | `reasoning.executionsToday` |

`notificationQueue` reuses the same `QueueHealth` shape, scoped to
`type: "notification-dispatch"`, so the Notification Queue's health is
visible independently of every other job type.

## 8. Health Check

**Files:** `packages/monitoring/src/health-check.ts`.

`runHealthCheck(repo?)` runs nine independent, individually-wrapped checks
— one failing never prevents the others from reporting — and returns
`{ ok, checkedAt, items[] }`:

| Check | What it verifies |
|---|---|
| `scheduler` | At least one `ScheduleEntry` is configured |
| `queue` | A real enqueue → claim → complete round-trip on a throwaway self-test job |
| `memory` | `AIReasoningLogEntry` history is readable |
| `knowledge` | The shared knowledge base is readable |
| `workers` | Every `AI_MODULE_ID` resolves via the employee registry |
| `notification_queue` | `NotificationQueue.countPending()` succeeds |
| `persistence` | Core business-data fixtures (sales/finance/HR) are readable |
| `config` | `getConfig()` parses (zod validation passes) |
| `timezone` | `COMPANY_TIMEZONE` is a valid IANA timezone `Intl` can format against |

## Config additions (infrastructure only — no business values, no secrets)

Added to `packages/shared/src/config.ts`, all with safe defaults:

- `QUEUE_MAX_ATTEMPTS` (default 5), `QUEUE_RETRY_BACKOFF_MS` (default 1000)
- `SCHEDULER_LOCK_TTL_MS` (default 300000 — 5 minutes)

## What Sprint 3B explicitly did not build

Per the brief's rules: no UI, no dashboard page, no API integration, no
WhatsApp/Meta/OTA/MK Connect/Gmail/Telegram connector implementation, no
outbound HTTP call to any external service, no new secrets or API keys.
`NotificationChannelType` still only has the Sprint 1 placeholder
adapters — none of them do anything different after this sprint.
