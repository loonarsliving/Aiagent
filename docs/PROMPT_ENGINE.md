# Prompt Engine — every Digital Employee's own prompt

Every Digital Employee that reasons (the 10 `AIEmployee`s + Notification
Coordinator) has its own `PromptDefinition`
(`packages/ai-engine/src/reasoning/prompts/*.prompt.ts`) — never a shared,
generic prompt. Each one declares exactly these fields:

| Field | Purpose |
|---|---|
| `role` | Who the AI is for this employee ("Anda adalah Finance Analyst AI...") |
| `objective` | What this reasoning call is trying to accomplish |
| `sop` | How to approach the task, mirroring the employee's real `EmployeeSOP` |
| `restriction` | Hard boundaries — e.g. Finance Analyst's "READ ONLY MUTLAK — jangan pernah menyarankan atau menyiratkan perubahan transaksi apa pun" |
| `decisionRule` | How to decide priority/escalation for this domain |
| `outputRule` | Formatting/tone constraints on the answer |
| `escalationRule` | When and how to flag `needApproval`/`escalation` |
| `memoryRule` | How this employee should use its own past reasoning history |
| `knowledgeRule` | How this employee should use retrieved knowledge |

`getPromptDefinition(moduleId)` (`prompt-engine.ts`) looks up the
registered definition; `PROMPT_DEFINITIONS`
(`prompts/index.ts`) is a `Record` keyed by every reasoning-capable
`moduleId`, so registering an 11th employee later is "add one file, add one
entry" — no `if`/`else` chain to extend.

## Building the system prompt

`buildSystemPrompt(promptDefinition, companyContext?)` assembles all 9
fields plus `COMPANY_CONTEXT` (`company-context.ts` — company name,
industry, timezone, owner title) into one structured, section-headed
prompt, and appends an explicit JSON output contract matching the Output
Engine's schema (see `docs/REASONING_FLOW.md`). Token optimization: a
section is only included if it has content — no empty `# MEMORY RULE`
boilerplate sent for nothing.

## Building the user prompt

`buildUserPrompt({ observation, contextData?, knowledge?, memory? })`
assembles the per-run material:

- `observation` — normally the employee's own deterministic `AIReport.summary`,
  already computed by `logic.ts` before reasoning ever runs.
- `contextData` — a small, hand-picked object of the most relevant
  deterministic fields (e.g. Finance Analyst passes
  `{ netCashflowIdr, cashflowProjectionNext7dIdr, anomalyCount }`, never the
  whole `FinanceAnalysisData` object) — this is the Sprint 2 brief's
  "Bangun Retrieval Layer, ambil hanya informasi yang relevan" applied to
  deterministic context, not just knowledge/memory retrieval.
- `knowledge` / `memory` — the Retrieval Layer's top-K results (see
  `docs/KNOWLEDGE_RETRIEVAL.md`), rendered as compact bullet lists, omitted
  entirely if empty.

## Notification Coordinator's prompt

`notification-coordinator.prompt.ts` is the one `PromptDefinition` that
isn't a cadence-scheduled `AIEmployee` (same reason it's excluded from
`AI_MODULE_IDS` — see `docs/ARCHITECTURE.md`). Its prompt is intentionally
narrow: refine a message's wording before dispatch, never invent facts,
never change severity. Because `packages/notifications` cannot import from
`packages/ai-engine` without creating a circular dependency (`ai-engine`
already depends on `notifications`), the *canonical* `PromptDefinition`
lives in `ai-engine/src/reasoning/prompts/notification-coordinator.prompt.ts`
for documentation/registration purposes, while the actual runtime prompt
used inside `notify()` is a small, self-contained copy in
`packages/notifications/src/ai-refinement.ts` — see
`docs/AI_PROVIDER.md` and `docs/REASONING_FLOW.md` for how that call is
wired without touching `notify()`'s public signature.

## Testing

`prompt-engine.test.ts` verifies: all 11 definitions resolve (10 employees
+ Notification Coordinator), an unregistered `moduleId` throws, every one
of the 10 prompt sections plus the JSON output contract appears in the
assembled system prompt, company context is embedded, and empty sections
are omitted from the user prompt (token optimization).
