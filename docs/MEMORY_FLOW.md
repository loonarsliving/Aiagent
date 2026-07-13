# Memory Flow — the Reasoning Engine's own memory

The brief's requirement is exact: *"Setiap Digital Employee mempunyai
memory sendiri. Memory dipisahkan. Tidak boleh saling menggunakan memory."*
— every Digital Employee has its own memory, memory is separated, and no
employee may use another's.

Sprint 1 already established this guarantee for deterministic business
memory (see `docs/ARCHITECTURE.md`'s memory table — Finance Analyst's
`anomaly-history`, HR Officer's `staff-flag-history`, etc., all namespaced
`${moduleId}:${category}:...` and always accessed through
`KnowledgeBase`). Sprint 2 extends the *same* mechanism one category
further, rather than inventing new storage:

## `ai-reasoning-history` — a new category, not a new table

`AI_REASONING_HISTORY_CATEGORY = "ai-reasoning-history"`
(`packages/ai-engine/src/reasoning/retrieval.ts`) is the category the
Reasoning Engine writes to and reads from for its own continuity. It's
just another `KnowledgeItem` category in the same `knowledge_items` table
Sprint 1 already built — no schema change, no new package.

## Write path — `runReasoning()`'s last step

After a successful reasoning call, `runReasoning()`
(`packages/ai-engine/src/reasoning/reasoning-engine.ts`) does:

```ts
const kb = new KnowledgeBase(repo);
await kb.remember([{
  id: `${moduleId}:${AI_REASONING_HISTORY_CATEGORY}:${runId}`,
  moduleId,
  category: AI_REASONING_HISTORY_CATEGORY,
  title: parsedOutput.summary,
  metadata: { priority, confidenceScore, needApproval, recommendation },
}]);
```

The `id` is keyed by `runId`, so every run's reasoning output is a distinct
memory item (unlike Sprint 1's business-fact categories, which dedupe
rediscovered facts via `mergeKnowledgeItem`'s `timesSeen` bump — reasoning
history is a log of distinct decisions, not a set of recurring facts).

## Read path — `retrieveMemory()`

`retrieveMemory(repo, moduleId, limit?)` (see `docs/KNOWLEDGE_RETRIEVAL.md`)
fetches this employee's own `ai-reasoning-history` items, most-recent-first,
and feeds them into the next run's user prompt as "riwayat reasoning
Anda sendiri" (your own reasoning history) — so an employee's Nth run can
say things like "as I noted yesterday, X was already trending toward Y."

## Isolation guarantee

Because every read/write goes through `KnowledgeBase`/`Repository` filtered
by `moduleId`, and every item's `id` and `moduleId` field are stamped with
the calling employee's own id, one employee's Reasoning Engine memory is
structurally unreachable from another's — the same guarantee Sprint 1's
Gate Review already proved for business memory
(`docs/audits/SPRINT1_GATE_REVIEW.md`, criterion 5), now extended to
reasoning history. `reasoning-engine.test.ts`'s "never leaks another
employee's knowledge/memory into the prompt" test exercises exactly this.

## Failure path — no memory write on failure

If reasoning fails (retries exhausted, or the model's output fails Output
Engine validation), `runReasoning()` returns before ever calling
`kb.remember()` — a failed run leaves no trace in memory, only in the
audit log (see `docs/REASONING_FLOW.md`). This keeps memory a record of
genuine conclusions, never partial or malformed ones.
