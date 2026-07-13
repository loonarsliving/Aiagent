# AI Provider — plug-and-play LLM abstraction

`packages/ai-provider` is the *only* package in this repo that knows what
"Gemini" or "Claude" mean. Every other package — `ai-engine`'s Reasoning
Engine, `notifications`' wording refinement — calls the same
provider-agnostic interface and has zero knowledge of which vendor is
actually answering.

## The interface

```ts
// packages/ai-provider/src/types.ts
interface AIGenerateRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseFormat?: "text" | "json";
}

interface AIGenerateResponse {
  text: string;
  tokensUsed?: { promptTokens: number; completionTokens: number; totalTokens: number };
  provider: AIProviderName;
  model: string;
  responseTimeMs: number;
}

interface AIProvider {
  readonly name: AIProviderName;
  generate(request: AIGenerateRequest): Promise<AIGenerateResponse>;
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
}
```

No caller ever imports `GoogleGenAI` or any vendor SDK directly. They call
`getAIProvider()` (`packages/ai-provider/src/registry.ts`), which reads
`AI_PROVIDER` from the config layer and returns the matching implementation.

## Providers

| Provider | Status | File |
|---|---|---|
| `gemini` | **Active** — the only implementation that actually calls an external API | `providers/gemini.provider.ts` |
| `claude` | Guardrailed stub — `generate()` always throws a non-retryable `AIProviderError` | `providers/claude.provider.ts` |
| `openai` | Guardrailed stub | `providers/openai.provider.ts` |
| `ollama` | Guardrailed stub | `providers/ollama.provider.ts` |

The stub pattern mirrors Sprint 1's `mock-external-system.adapter.ts`
guardrail: swapping in a real Claude/OpenAI/Ollama implementation later is
"write one new file implementing `AIProvider`, change one line in
`registry.ts`" — zero changes to any employee, the Reasoning Engine, or the
notification refinement layer.

## GeminiProvider

Wraps `@google/genai`'s `GoogleGenAI` client behind a narrow interface
(`GeminiClientLike`) so unit tests inject a fake client instead of hitting
the real API. Concretely:

- `generate()` races the real call against a `setTimeout` bounded by
  `AI_TIMEOUT_MS` — a hung network call can never block a run indefinitely.
- Every call sets `thinkingConfig: { thinkingBudget: 0 }`, disabling the
  model's internal "thinking" pass. This was a real bug found during Sprint
  2's live integration testing: newer Gemini models (e.g.
  `gemini-flash-latest`) spend part of `maxOutputTokens` on invisible
  reasoning tokens before emitting any visible text, which was silently
  truncating or emptying responses. Disabling it makes token usage and
  latency predictable, which also directly serves the "Token Optimization"
  requirement (no wasted tokens on a reasoning trace nobody reads).
- Any client error is wrapped as a **retryable** `AIProviderError`; a
  missing `GEMINI_API_KEY` is wrapped as **non-retryable** (retrying can't
  fix a missing key, so the Reasoning Engine's retry loop skips straight to
  the audit log instead of wasting attempts).
- `healthCheck()` sends a trivial "reply with exactly: OK" probe
  (`maxOutputTokens: 64` — enough headroom even with thinking left enabled
  on models that ignore the override) and reports `ok: true` only if the
  response text is non-empty.
- Every call sets `safetySettings` for all four harm categories
  (harassment, hate speech, sexually explicit, dangerous content) to
  `AI_SAFETY_THRESHOLD`. Found and fixed during the Production Readiness
  Audit: the config value was defined, validated, and documented but never
  actually read by `GeminiProvider` — a real "declared but not enforced"
  gap. See `docs/audits/PRODUCTION_READINESS.md`.

## Configuration — zero hardcoding

All Gemini/reasoning tuning lives in `packages/shared/src/config.ts`,
zod-validated, read from `.env` (never committed — see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `AI_PROVIDER` | `gemini` | Which provider `getAIProvider()` resolves to |
| `GEMINI_API_KEY` | (empty) | Required for `gemini`; missing key throws a clear, non-retryable error naming `.env.example` |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Model id — `gemini-flash-latest` was used for Sprint 2's live validation |
| `AI_TEMPERATURE` | `0.3` | Low temperature — this is business reasoning, not creative writing |
| `AI_MAX_OUTPUT_TOKENS` | `1024` | Output budget per call |
| `AI_RETRY_ATTEMPTS` | `3` | Total attempts including the first try |
| `AI_RETRY_BACKOFF_MS` | `300` | Base backoff, doubles per attempt (mirrors `runEmployeeTask`'s retry strategy) |
| `AI_TIMEOUT_MS` | `15000` | Per-call timeout |
| `AI_SAFETY_THRESHOLD` | `BLOCK_MEDIUM_AND_ABOVE` | Gemini safety filter threshold |
| `AI_RETRIEVAL_TOP_K` | `8` | Default Knowledge Retrieval Layer result count — see `docs/KNOWLEDGE_RETRIEVAL.md` |

## Error handling

`AIProviderError` (`packages/ai-provider/src/errors.ts`) carries
`provider`, `retryable`, and an optional `cause`. This is the one error
type every layer above `ai-provider` checks:

```
Reasoning Engine retry loop:
  catch (err) {
    nonRetryable = err instanceof AIProviderError && !err.retryable
    if (isLastAttempt || nonRetryable) -> stop retrying, write audit log
    else -> retry with exponential backoff
  }
```

This is the concrete implementation of the brief's "Jika Gemini gagal:
Retry. Jika Retry gagal: Audit Log. Jika tetap gagal: Structured Error."
