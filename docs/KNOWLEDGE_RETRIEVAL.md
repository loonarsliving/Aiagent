# Knowledge Retrieval Layer

The brief is explicit: *"Jangan mengirim seluruh Knowledge Base. Bangun
Retrieval Layer. Ambil hanya informasi yang relevan."* — never send the
whole knowledge base to Gemini; retrieve only what's relevant.

`packages/ai-engine/src/reasoning/retrieval.ts` is that layer. It sits
between the Reasoning Engine and the existing `Repository`/`KnowledgeBase`
primitives from Sprint 1 — no new storage, no vector database.

## `retrieveKnowledge(repo, { moduleId, query?, topK? })`

1. Fetches every `KnowledgeItem` for `moduleId` (scoped — never another
   employee's rows, same guarantee as Sprint 1's memory isolation).
2. Excludes the `ai-reasoning-history` category (that's Memory, not
   Knowledge — see `docs/MEMORY_FLOW.md`).
3. Scores each remaining item with `scoreKnowledgeItem(item, query, now)`:
   - **Recency**: `max(0, 10 - ageInDays)` — a fact seen today scores
     higher than one from two weeks ago.
   - **Frequency**: `min(item.timesSeen, 10)` — a fact rediscovered many
     times (Sprint 1's `mergeKnowledgeItem` bumps this) is weighted as more
     durably true than a one-off observation.
   - **Keyword overlap**: exact title match (or substring) adds +15; a
     token-overlap count between the query and the item's title adds +5
     per shared token.
4. Sorts by score, descending, and returns only the top `AI_RETRIEVAL_TOP_K`
   (default 8, config-layer, see `docs/AI_PROVIDER.md`) items.

## `retrieveMemory(repo, moduleId, limit?)`

Simpler by design: fetches this employee's own `ai-reasoning-history`
items, most-recent-first, capped at the same top-K default. No scoring —
memory is "what did I conclude recently," not "what's most relevant to
this specific query," so plain recency ordering is the right, simpler
choice here.

## Why deterministic scoring, not embeddings

This is a deliberate trade-off, stated up front per the brief's
instruction to explain trade-offs before implementing: embeddings/vector
search would need a new dependency (a vector DB or an in-memory index),
extra Gemini embedding API calls (more cost, more latency, more failure
surface), and meaningful data volume to be worth it. At this stage —
seeded/dummy data, a handful of items per employee per day — deterministic
recency+frequency+keyword scoring is cheap, fully explainable (every score
can be hand-verified), requires zero new infrastructure, and is a strict
upgrade path: swapping in embeddings later means implementing a new
`retrieveKnowledge` internals with the exact same function signature —
zero change to the Reasoning Engine or any employee.

## Testing

`retrieval.test.ts` (8 tests, real `InMemoryRepository`, no mocks) verifies:
top-K is capped even with more matching items available, the
`ai-reasoning-history` category is always excluded from Knowledge results,
results are scoped to the requesting `moduleId` only, higher-relevance
items rank above lower-relevance ones, `retrieveMemory` never returns
another employee's memory, and an explicit `limit` overrides the config
default.
