# Production Readiness Audit

**Auditor role**: CTO, PT Maha Karya Haluoleo
**Scope**: Full repository — Sprint 1 (Digital Workforce foundation) + Sprint 2
(Intelligence Engine), as it stands with Sprint 2 marked READY FOR FINAL
VALIDATION.
**Explicitly out of scope**: WhatsApp, Meta, OTA, MK Connect integration.
Sprint 3 implementation. This audit prepares the system for Sprint 3 to
**safely start after production approval** — it does not start Sprint 3.

## Overall Score: 78 / 100 — Strong Foundation, Not Yet Production-Ready for Unattended External Operation

The engineering foundation (architecture, testing, governance, retry/audit
discipline) is genuinely strong and well above what's typical for a
two-sprint build. The score is held back by a small number of concrete,
fixable gaps — most already closed during this audit — plus one item that
cannot be closed by code review alone: live end-to-end proof that the
Reasoning Engine works against the real Gemini API.

## Go / No-Go Decision

| Question | Decision |
|---|---|
| Safe to continue Sprint 2 close-out and Sprint 3 **planning/prep** work (no real external side effects)? | **GO** |
| Safe to open **real external integrations** (WhatsApp, Meta, OTA, MK Connect) today? | **NO-GO** |
| Safe to deploy with `DATA_MODE=dummy` (the default) as a "production" instance? | **NO-GO** — see Critical Issue #2 |
| Safe to deploy with the current Next.js dashboard exposed to any untrusted network? | **NO-GO** — see Major Issue #1 |

**Conditions to flip to GO for real integrations**: close all Critical
Issues below, and Major Issues #1–#3 at minimum, before Sprint 3 connects
anything external.

---

## 1. AI Worker Component Verification

Every one of the 10 `AIEmployee`s was checked against the required
component list by reading `module.ts` directly (not inferred) — see
evidence commands below. **Result: 10/10 have all 9 components.**

| Component | Verification method | Result |
|---|---|---|
| Role | `role:` field on the `AIEmployee` export | 10/10 present |
| Objective | `description:` field + Prompt Engine `objective` field | 10/10 present |
| SOP | `const sop: EmployeeSOP` object | 10/10 present |
| Memory | `KnowledgeBase` import + `kb.remember()` call | 10/10 present |
| Knowledge Retrieval | `runReasoning()` call (internally calls `retrieveKnowledge`) | 10/10 present |
| Prompt | Registered in `PROMPT_DEFINITIONS` | 10/10 + Notification Coordinator (11/11) |
| Reasoning Pipeline | `runReasoning()` call in `runDaily` | 10/10 present |
| Output Formatter | `aiReasoning` field attached to the returned `AIReport` (Output Engine schema applied inside `runReasoning`) | 10/10 present |
| Audit Log | `AIReasoningLogEntry` written by every `runReasoning()` call (unconditional, success or failure) | 10/10 present (centrally guaranteed, not per-employee code) |

Evidence commands (reproducible):
```
grep -L "runReasoning" packages/ai-engine/src/modules/*/module.ts   # empty = all pass
grep -L "role:" packages/ai-engine/src/modules/*/module.ts          # empty = all pass
grep -L "const sop: EmployeeSOP" packages/ai-engine/src/modules/*/module.ts  # empty = all pass
grep -L "KnowledgeBase" packages/ai-engine/src/modules/*/module.ts  # empty = all pass
grep -L "aiReasoning" packages/ai-engine/src/modules/*/module.ts    # empty = all pass
```

## 2. AI Governance Layer

Built this pass — see `docs/AI_GOVERNANCE.md` and
`packages/security/src/governance.ts` (15 tests,
`governance.test.ts`). Summary:

- **Approval Matrix** (Level 0–4) defined as a shared type
  (`ApprovalLevel`, `packages/shared/src/types.ts`) and enforced via
  `isActionWithinPermission()`/`requiresHumanApproval()`.
- **11 governance profiles** (10 employees + Notification Coordinator),
  each declaring Permission Level, Auto Action Level, Requires Approval
  Level, Forbidden Actions, Escalation Rules, Owner/Dir Ops/Branch Manager
  Approval Rules.
- **Verified finding**: every worker is Level 0/1 (Read Only /
  Suggestion Only) today **except** Meta Ads Specialist (Level 4 — its
  proposals require Owner approval, already enforced in real code via
  `@mkh/security`'s `canApprove()`, not just a governance label). No AI
  Worker in this codebase can currently execute a real mutating action —
  confirmed by the fact that `Repository` has no write method for sales,
  finance, HR, or OTA data, and Meta Ads/OTA both stop at "propose," never
  "execute."
- Added the `branch_manager` role (`packages/security/src/roles.ts`) —
  previously Level 2 of the matrix named a decision-maker with no
  corresponding role, which would have made that level unenforceable.

**This layer is declarative and tested, not yet wired into a runtime
enforcement gate for every future action** — because no code path in this
repository currently needs one beyond what `assertApproved()` already
gates. The explicit discipline going forward (documented in
`docs/AI_GOVERNANCE.md`'s closing section): **no new execute() path may
ship in Sprint 3 without calling `isActionWithinPermission()` /
`requiresHumanApproval()` first.**

## 3. Dimension-by-Dimension Review

### Architecture — Strong
Clean layered dependency graph (`docs/ARCHITECTURE.md`), verified
acyclic: `ai-engine` → `notifications`/`memory`/`security`/`connectors`/
`database`/`ai-provider` → `shared`. `notifications` deliberately depends
on `ai-provider` directly (not `ai-engine`) specifically to avoid a cycle
— a real design decision, not an oversight. No employee imports another
employee's internals; all cross-employee reads go through `Repository`.

### Security — Adequate for current scope, gaps for external exposure
- RBAC (`@mkh/security`) correctly gates the one real mutating action
  (Meta Ads approval) to the `owner` role, enforced in code.
- `.env`/`.env.local` correctly gitignored; no secrets found in tracked
  files (verified via `git status`/`git check-ignore` throughout this
  session).
- **Gap**: no authentication/authorization layer exists for a
  hypothetical external caller. Acceptable today because nothing external
  calls in (`triggerEmployee()`'s only caller is the CLI/tests); becomes a
  blocker the moment MK Connect integration starts. Already correctly
  flagged in `docs/ROADMAP.md`'s "Known limitations."
- **Gap (Minor)**: `CRON_SECRET` defaults to the literal string
  `change-me-in-production` in `.env.example` — correct as a template
  default, but there's no runtime check that rejects this default value
  if it's still set in an environment claiming to be production.

### Maintainability — Good, one process gap
- Consistent patterns throughout (every employee's `module.ts` follows
  the identical shape; every new package follows the same
  `package.json`/`tsconfig.json` skeleton).
- 47 test files, 370 tests, all packages typed strictly (`strict: true`
  inherited from `tsconfig.base.json`).
- **Gap (Minor)**: `pnpm lint` is defined in `package.json` scripts but
  no ESLint/Biome config exists anywhere in the repo — the script is a
  no-op today. CI does not run a lint step. Recommend adding real lint
  config before Sprint 3 grows the codebase further.

### Scalability — Real limitation for multi-instance deployment
- `packages/scheduler`'s `local-runner.ts` uses `node-cron` in a single
  Node process with no distributed lock or leader election. **If ever run
  as more than one instance** (horizontal scaling, multiple deploy
  targets), the same employee/cadence slot could fire twice
  concurrently — nothing today prevents a double-run.
- `InMemoryRepository` (the default, `DATA_MODE=dummy`) is
  process-local — state doesn't survive a restart and can't be shared
  across instances at all.
- `SupabaseRepository` scales normally (stateless application layer,
  state lives in Postgres) but has not been load-tested.

### Reliability — Strong
- Two independent, consistent retry layers: `runEmployeeTask`'s outer
  retry (task-level) and `runReasoning`'s inner retry (Gemini-call-level),
  both exponential backoff, both config-driven, neither hardcoded.
- "Never throw to the caller" is upheld at both layers — verified by
  `reasoning-engine.test.ts`'s explicit malformed-JSON/exhausted-retry
  tests and Sprint 1's Gate Review acceptance tests.
- `notify()`'s AI refinement never blocks delivery — falls back to
  original wording on any failure, verified by
  `ai-refinement.test.ts` (added this pass; previously untested).

### Observability — Good, no alerting layer
- Structured JSON logging (`createLogger`) used consistently across every
  package — every log line carries `scope`, `level`, `ts`, and relevant
  context fields.
- Granular `WorkLogEntry`/`AIReasoningLogEntry` audit trails are
  queryable directly and via the MCP server's read-only tools.
- **Gap (Minor)**: no alerting/paging exists on repeated failures (e.g.
  if `notify()` itself starts failing, or if an employee's retries are
  exhausted every day for a week) — everything is log/table-based, no
  active push beyond the notifications the system generates about
  business conditions, not about itself.

### Recoverability — Adequate, standard infra caveats
- Both retry layers plus the "always persist a failure report" pattern
  mean a single bad run self-heals on the next scheduled run without
  operator intervention.
- Supabase migrations exist and are additive/forward-only; no rollback
  scripts exist, which is standard for this maturity stage but should be
  revisited before real data volume exists.
- No documented backup/restore runbook — relies on Supabase's platform-
  level point-in-time recovery, which is not verified as configured
  (infra concern, not a code gap).

### AI Safety — Good, with one real gap found and fixed
- **Found and fixed this pass**: `AI_SAFETY_THRESHOLD` was defined,
  validated, and documented but **never actually passed to the Gemini
  API** — a "declared but not enforced" gap. Fixed:
  `GeminiProvider.generate()` now sets `safetySettings` for all four harm
  categories (harassment, hate speech, sexually explicit, dangerous
  content) to the configured threshold, verified by a new test
  (`gemini.provider.test.ts`).
- **Positive finding**: every prompt input today (`observation`,
  `contextData`, retrieved knowledge/memory) is internally generated —
  deterministic business logic, mocked connector data, or the system's
  own prior reasoning output. **No live, human/external-writable text
  reaches a Gemini prompt anywhere in this codebase today** — meaningful
  because it means prompt injection is not a live risk yet. This
  changes the moment Sprint 3 wires a real connector (Instagram comments,
  scraped competitor text, etc.) — recommend a prompt-injection review
  and input-sanitization pass specifically gated to that future work,
  not deferred silently.
- Every reasoning failure (malformed JSON, provider error, timeout)
  degrades to a structured `ReasoningFailure`, never a crash, never
  partial/corrupted state — verified by `output-schema.test.ts` and
  `reasoning-engine.test.ts`.

### Prompt Quality — Strong
- All 11 `PromptDefinition`s (10 employees + Notification Coordinator)
  declare all 9 required fields with real, domain-specific content — spot-
  checked Finance Analyst's `restriction` field enforces "READ ONLY
  MUTLAK" in the prompt itself, matching the code-level invariant (no
  write method exists) — a genuine belt-and-suspenders design.
  `prompt-engine.test.ts` verifies all 11 resolve and all sections appear.

### Knowledge Retrieval — Strong
- Verified top-K-only, never-whole-knowledge-base behavior via
  `retrieval.test.ts` (8 tests, real `InMemoryRepository`, not mocks).
- Deterministic scoring (recency + frequency + keyword overlap) is a
  reasonable, explicitly-justified trade-off against embeddings at this
  data volume (see `docs/KNOWLEDGE_RETRIEVAL.md`) — correctly documented
  as an upgrade path, not a permanent design.

### Memory Isolation — Strong, verified not just claimed
- `reasoning-engine.test.ts`'s "never leaks another employee's knowledge/
  memory into the prompt" test actively seeds a different employee's
  knowledge item and confirms it never surfaces — this is a real,
  adversarial-style test, not just a code-review assertion.
- Every memory item's `id` is namespaced `${moduleId}:${category}:...`,
  consistent between Sprint 1's business memory and Sprint 2's
  `ai-reasoning-history` category.

### Reasoning Engine — Strong, one unresolved validation gap
- The fixed 8-step pipeline (Observe → ... → Save Memory) is implemented
  exactly as specified, tested with fakes (9 tests, all pass), and
  **partially validated live**: health check and a raw `generate()` call
  both succeeded against the real Gemini API this sprint.
- **Critical gap**: a full live `runReasoning()` call (real API, real
  parse, real memory save) has **not yet completed successfully** — see
  Critical Issue #1.

### Scheduler — Adequate, single-process assumption
- `toCronExpression()` correctly handles daily/weekly/monthly cadences
  for all 10 employees (30 schedule slots), unit tested.
- See "Scalability" above for the single-process/no-distributed-lock gap.

### Notification Engine — Good, one real operational risk found and mitigated
- `notify()` is the sole funnel every employee routes through — verified
  no employee imports a `NotificationChannel` directly.
- **Found this pass**: the AI wording-refinement layer added in Sprint 2
  had **zero test coverage** (61.7% lines, 9% branches, no dedicated test
  file) despite being new production code on every notification path.
  **Fixed**: added dependency injection (`providerOverride` parameter,
  mirroring `runReasoning`'s existing pattern) and a full test file
  (8 tests, now 100% lines / 95% branches).
- **Found this pass, real operational risk**: the refinement layer is
  unconditionally enabled, meaning **every single `notify()` call across
  all 10 employees attempts a live Gemini call**. This session directly
  observed a 20-requests/day free-tier quota being exhausted by
  diagnostic testing — in normal daily operation, up to ~10 reasoning
  calls + up to ~10 notification-refinement calls could be attempted in
  one day, which is uncomfortably close to that same quota tier. **Fixed**:
  added `NOTIFY_AI_REFINEMENT_ENABLED` config flag (default `true`,
  matching prior behavior) so operators can disable it without a code
  change if quota is tight — tested (`notification-service.test.ts`,
  2 new tests).
- **Found and fixed while adding that flag**: the first implementation
  used `z.coerce.boolean()`, which is a well-known Zod footgun —
  JavaScript's `Boolean("false")` evaluates to `true` (any non-empty
  string is truthy), so setting `NOTIFY_AI_REFINEMENT_ENABLED=false`
  would have silently done nothing. Caught by writing the test first,
  fixed with an explicit `.transform((v) => v !== "false")`, and a
  regression test now guards this exact failure mode
  (`config.test.ts`).

### Retry Strategy — Strong
- Two consistent, independently-tested exponential-backoff retry loops
  (task-level and reasoning-level), both config-driven
  (`MAX_RETRY_ATTEMPTS`/`RETRY_BACKOFF_MS` and
  `AI_RETRY_ATTEMPTS`/`AI_RETRY_BACKOFF_MS`), non-retryable errors
  (e.g. missing API key) correctly skip straight to the audit log instead
  of wasting attempts.

### Configuration — Strong, one class of bug found and fixed
- Every tunable value is read through `getConfig()`'s zod-validated
  schema — grepped for stray `process.env` reads outside `config.ts`:
  none found in application code.
- **Found and fixed this pass**: the `z.coerce.boolean()` footgun
  described above. Worth a broader note: this is a **class** of bug, not
  a one-off — any future boolean env var added the same way would have
  the identical silent-failure mode. Recommend a lint rule or code-review
  checklist item banning `z.coerce.boolean()` repo-wide.

### Testing — Strong
- 370 tests across 47 files, 98.94% lines / 86.5% branches / 99.6%
  functions / 98.94% statements — all above the CI-enforced thresholds
  (90/90/90/85).
- Coverage gaps found and closed during this audit (not just measured):
  `ai-refinement.ts` (61.7%→100% lines), safety settings (0%→covered).
- CI (`.github/workflows/*.yml`) runs typecheck → test:coverage → build
  on every push/PR — no lint step (see "Maintainability").

---

## 4. Issues

### Critical (block Go for production external operation)

1. **Live end-to-end Reasoning Engine validation incomplete.** Health
   check and a raw `generate()` call succeeded against the real Gemini
   API; a full `runReasoning()` pipeline call (real parse, real memory
   save) has not yet succeeded, blocked by the test key's exhausted daily
   quota. Tracked in `docs/audits/SPRINT2_DOCUMENTATION.md`'s Final
   Validation Checklist. **Must close before Sprint 2 → CLOSED, and
   before any production reliance on AI reasoning output.**

2. **`DATA_MODE=dummy` is the default and is non-persistent.**
   `InMemoryRepository` discards all reports, memory, knowledge, and
   audit logs on every process restart. This is correct and safe as a
   *default* (matches "safe by default" design intent), but means: any
   deployment intended to actually retain memory/knowledge/audit history
   — which is the entire point of Sprint 2 — **must** explicitly set
   `DATA_MODE=supabase` with a provisioned, migrated Supabase project.
   No such project is provisioned today (confirmed: no live Supabase
   credentials exist anywhere in this session's `.env`).

### Major (should close before opening real external integrations)

1. **Next.js dependency vulnerabilities unpatched.** `pnpm audit --prod`
   reports 16 advisories against `apps/dashboard`'s `next@14.2.35` (5
   high, including DoS and SSRF advisories), all patched only in
   `>=15.5.16`. Already flagged in `docs/ROADMAP.md`'s "Known
   limitations" as a deliberate deferral (major-version bump risk for a
   frozen app); re-flagging here because "internal debug viewer, no live
   deployment" stops being a mitigating factor the moment any deployment
   exists.

2. **No distributed lock in the scheduler.** `local-runner.ts` assumes
   exactly one running instance. Any production deployment topology with
   more than one instance (blue/green, horizontal scaling, multiple
   regions) needs a real distributed lock (e.g. a Postgres advisory lock
   via `SupabaseRepository`, or a dedicated leader-election mechanism)
   before going live with more than one process.

3. **No authentication on `triggerEmployee()`'s eventual external
   entry point.** Correctly scoped out of Sprint 1/2 (no external caller
   exists yet), but must be resolved as a precondition of MK Connect
   integration, not discovered during it.

### Minor (track, not blocking)

1. No lint/static-analysis config despite a `lint` script existing in
   every `package.json` — CI does not enforce style or catch the class of
   bug described in Configuration's `z.coerce.boolean()` finding via
   tooling (only via a human noticing during this audit).
2. `uuid@8.3.2` (transitive, via `node-cron`) has a moderate advisory
   (buffer bounds check); low real-world exposure since it's only used
   for internal job-id generation, not attacker-reachable input.
3. No alerting/paging on the system's own failures (as opposed to the
   business-condition alerts it generates) — everything is log/table-
   based today.
4. `CRON_SECRET`'s documented default (`change-me-in-production`) has no
   runtime guard rejecting that literal value in a deployment that claims
   to be production.
5. No backup/restore runbook documented for the Supabase data mode.

---

## 5. Recommendations (priority order)

1. Run the Final Validation Checklist in
   `docs/audits/SPRINT2_DOCUMENTATION.md` the moment Gemini quota resets;
   flip Sprint 2 to CLOSED only after it passes.
2. Before any deployment intended to persist state: provision a Supabase
   project, run `supabase/migrations/`, and set `DATA_MODE=supabase`
   explicitly — do not rely on the dummy default.
3. Add a distributed lock (or document a hard "exactly one instance"
   constraint and enforce it operationally) before Sprint 3 considers any
   multi-instance deployment topology.
4. Add real ESLint/Biome config and wire it into CI — this audit found a
   real, silent, easy-to-miss bug (`z.coerce.boolean()`) that a lint rule
   or stricter type could have caught mechanically instead of by manual
   review.
5. Before Sprint 3 wires any real external connector (Instagram, Meta,
   OTA, MK Connect): run a dedicated prompt-injection review, since
   today's "all prompt input is internally generated" safety property
   will no longer hold.
6. Plan the Next.js 14→15 upgrade for `apps/dashboard` (or its formal
   retirement in favor of MK Connect's UI) as an explicit, scoped piece
   of Sprint 3 work rather than continuing to defer it.
7. Monitor real Gemini quota/usage once live traffic starts — the
   `NOTIFY_AI_REFINEMENT_ENABLED` flag added this pass is the immediate
   lever; a longer-term fix could gate refinement to `warning`/`critical`
   severity only, reducing call volume further without losing signal on
   the notifications that matter most.

---

## 6. What Was Fixed During This Audit (not just found)

This audit did not stop at documentation — every gap below was closed and
verified (typecheck + full test suite + coverage all green,
370/370 tests passing, before and after):

1. `packages/notifications/src/ai-refinement.ts` — added dependency
   injection + a full test file (8 tests), closing a 61.7%→100% line
   coverage gap on live production code.
2. `AI_SAFETY_THRESHOLD` — was configured and documented but never
   actually sent to the Gemini API; now wired into `safetySettings`,
   tested.
3. `NOTIFY_AI_REFINEMENT_ENABLED` — new config flag closing the
   "unbounded Gemini call volume from notifications" operational risk
   identified during this audit.
4. The `z.coerce.boolean()` bug found while implementing #3 — fixed with
   an explicit string-comparison transform, plus a regression test.
5. `branch_manager` role added — Level 2 of the Approval Matrix
   previously named a decision-maker with no corresponding role.

None of these were "add a feature" — all five are fixes to gaps between
what was already declared/intended and what the code actually did,
directly in scope for a production-readiness pass.
