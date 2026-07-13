# Sprint 2 Documentation — Intelligence Engine

## Status: READY FOR FINAL VALIDATION

Sprint 2 is **not** CLOSED. All implementation, wiring, and documentation
work is complete and verified except one thing: a full end-to-end live
Gemini reasoning call (the complete Observe → ... → Save Memory pipeline
against the real API, not fakes) has not yet completed successfully,
purely because of an exhausted daily API quota — not a code defect. See
"Phase 11 — honest status" below for the full evidence, and "Final
Validation Checklist" for exactly what to run the moment quota is
available.

## What Sprint 2 built

Per `docs/ARCHITECTURE.md`'s "Sprint 2 — Intelligence Engine" section:

- **`packages/ai-provider`** — plug-and-play `AIProvider` abstraction.
  Gemini active; Claude/OpenAI/Ollama guardrailed stubs. See
  `docs/AI_PROVIDER.md`.
- **Prompt Engine** — one 10-section structured prompt per employee (+
  Notification Coordinator). See `docs/PROMPT_ENGINE.md`.
- **Knowledge Retrieval Layer** — deterministic, top-K-only, no full
  knowledge base ever sent. See `docs/KNOWLEDGE_RETRIEVAL.md`.
- **Memory Flow** — the Reasoning Engine's own `ai-reasoning-history`
  category, isolated per employee, reusing Sprint 1's `KnowledgeBase`. See
  `docs/MEMORY_FLOW.md`.
- **Reasoning Engine** — the fixed Observe→...→Save Memory pipeline,
  bounded retry, always-write audit log, never-throw guarantee. See
  `docs/REASONING_FLOW.md`.
- **Output Engine** — zod-validated structured output
  (priority/summary/recommendation/reason/confidenceScore/needApproval/
  escalation/nextAction).
- **Wired into all 10 employees'** `runDaily` as an additive
  `AIReport.aiReasoning?` field — Sprint 1's deterministic `data` and
  business logic untouched.
- **Notification Coordinator** — optional, non-throwing wording
  refinement inside `notify()`, no signature change, falls back silently
  to original wording on any failure.
- **`ai_reasoning_logs`** audit table + `Repository` methods, mirroring
  Sprint 1's `WorkLogEntry` pattern.
- **Config layer** — `AI_PROVIDER`/`GEMINI_API_KEY`/model/temperature/
  retry/timeout/safety/retrieval-top-K, all env-driven, zero hardcoding.
- **`.env`** created locally (gitignored, never committed) with the AI
  Provider section ready for the key, per explicit instruction to stop and
  wait for the Owner to supply it before any live call.

## Phase 11 — honest status

Gemini connection verified successfully. Live health check passed. Two
production bugs were discovered and fixed. Full end-to-end reasoning
pipeline is pending only because the daily Gemini free-tier quota has been
exhausted.

### Evidence

**Live health check — PASSED.** `GeminiProvider.healthCheck()` returned
`ok: true` with a real, non-empty response (`text: "OK"`) from the live
API, using the `gemini-flash-latest` model.

**Raw `generate()` call — PASSED.** A direct call through the real
`@google/genai` client returned real text and real
`tokensUsed`/`responseTimeMs`, confirming the provider abstraction, the
Gemini SDK wiring, and the config layer (`.env` → `getConfig()` →
`getAIProvider()`) all work correctly end to end.

**Two real bugs found and fixed by live testing** (neither was, or could
have been, caught by the fake-client unit test suite, since fakes don't
exhibit real API quirks):

1. **Outdated SDK silently dropped `thinkingConfig`.** The originally
   installed `@google/genai@0.3.1` had no `thinkingBudget` field in its
   `ThinkingConfig` type and — critically — did not forward the field to
   the API at all when set via a type-erased workaround, even though the
   REST API itself accepts and honors it (verified directly via `curl`).
   Newer "thinking" models (`gemini-flash-latest` →
   resolves to `gemini-3.5-flash`) were spending an unpredictable, often
   large share of `maxOutputTokens` on invisible internal reasoning before
   emitting any visible text — this caused empty health-check responses
   and truncated/unparseable JSON from the full reasoning pipeline.
   **Fix:** upgraded to `@google/genai@2.11.0` (verified compatible: same
   `.text` getter, same `GoogleGenAIOptions.apiKey`, same
   `usageMetadata` field names — no breaking changes to our usage), which
   both types and correctly forwards `thinkingConfig.thinkingBudget: 0`.
2. **Health check probe budget too small.** `maxOutputTokens: 10` for the
   health-check probe left no room for a visible answer once any thinking
   overhead was present. **Fix:** raised to `64`.

Both fixes are committed (`packages/ai-provider/src/providers/gemini.provider.ts`,
`packages/ai-provider/package.json`) and verified not to regress any of
the 342 existing automated tests.

**Quota exhaustion — the remaining blocker.** The Google Cloud project
behind the supplied `GEMINI_API_KEY` has a **20 requests/day** free-tier
quota for `gemini-3.5-flash`. Diagnostic testing during this session
(repeated health checks, raw `curl` probes, model-availability checks, and
one attempted full pipeline run) consumed that quota. The one full
`runReasoning()` pipeline attempt made after the SDK fix returned a `503
Service Unavailable` ("high demand") on its final retry — a transient,
server-side condition, not a defect — before the daily quota was
confirmed exhausted on the next attempt (`429 RESOURCE_EXHAUSTED`,
`quotaValue: 20`).

**What this does and does not prove:** it proves the entire chain up to
and including a live model call is correct and working — provider
resolution, config loading, the Gemini SDK integration, prompt
construction, and the audit-log write path (confirmed separately: every
attempt, including the `503` failure, wrote a correct
`AIReasoningLogEntry` with `status: "error"` and the right error reason).
It does **not** yet prove a full successful `runReasoning()` call has
completed against the live API with a valid, schema-passing JSON response
parsed back into a `ReasoningOutput` and saved to memory. That is the one
remaining validation step.

## Final Validation Checklist

Run this the moment the daily Gemini quota resets (or a higher-quota
key/billing is available). Do not run diagnostic `curl`/health-check
probes beforehand — go straight to the real test to conserve quota.

- [ ] Confirm `.env` still has a valid `GEMINI_API_KEY` and
      `GEMINI_MODEL=gemini-flash-latest` (or another model confirmed
      available via `GET /v1beta/models`).
- [ ] Run `npx tsx --env-file=.env --tsconfig scripts/tsconfig.json scripts/sprint2-gemini-integration-test.ts` **once**.
- [ ] Confirm section 2 (health check) passes with real response text.
- [ ] Confirm section 3 (raw `generate()`) passes with non-empty text.
- [ ] Confirm section 4 (full `runReasoning()` pipeline) returns
      `result.failed === false` with a valid `ReasoningOutput`
      (priority/summary/recommendation/confidenceScore/needApproval all
      present and well-formed).
- [ ] Confirm section 5: exactly one `AIReasoningLogEntry` persisted with
      `status: "success"`, correct `provider`/`model`, and real token
      counts.
- [ ] Confirm section 6: the reasoning output was saved to
      `finance-analyst`'s own `ai-reasoning-history` memory.
- [ ] Re-run `pnpm test` (or `npx vitest run`) once more to confirm the
      full 342-test automated suite (fakes only, no live calls) is still
      green — this should already be true, but re-confirm after any
      further `.env`/model changes.
- [ ] Update this file: change **Status: READY FOR FINAL VALIDATION** to
      **Status: CLOSED**, paste the passing test script output as
      evidence (mirroring how `docs/audits/SPRINT1_GATE_REVIEW.md`
      captured Sprint 1's acceptance evidence), and update
      `docs/ROADMAP.md`'s Sprint 2 status line to match.
- [ ] Do not proceed to Sprint 3 work in the same pass — closing Sprint 2
      is the end of this checklist.

## What is explicitly NOT done (by design, per instruction)

- Sprint 3 has not been started — no new features beyond what's listed
  above.
- WhatsApp, Meta, Instagram, TikTok, OTA, and MK Connect remain
  unconnected, exactly as instructed.
- No UI, no dashboard, no external API beyond Gemini was added.
