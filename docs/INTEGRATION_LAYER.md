# Integration Layer — Sprint 4A (no external API)

Sprint 4A builds the Integration Layer so every external channel (WhatsApp
Cloud API, Telegram Bot API, an email provider, the Meta Marketing API, MK
Connect, an OTA API) can be plugged in later with almost zero code changes.
**Nothing in this sprint calls a real external API.** Every connector is a
fully working mock that stores every request/response, supports retry, and
is directly testable — swapping a mock for a real adapter is "add one
class implementing `Connector`, change one line in `registry.ts`."

All new code lives in `packages/integrations`, alongside the Sprint 3B
infrastructure it builds on (`@mkh/queue`'s Job Queue/Retry Engine,
`@mkh/database`'s Repository).

## 1. Connector Interfaces

**File:** `packages/integrations/src/connector.ts`.

One `Connector` interface for every channel — `sendMessage`,
`sendTemplate`, `sendMedia`, `broadcast`, `receiveWebhook`, `healthCheck`.
`ConnectorType` (`packages/shared/src/types.ts`) enumerates the six
channels: `whatsapp`, `telegram`, `email`, `meta`, `mkconnect`, `ota`.

## 2. Mock Connectors

**Files:** `packages/integrations/src/connectors/base-mock-connector.ts` +
`connectors/mock/*.mock.ts` (one trivial subclass per channel).

`BaseMockConnector` implements the full `Connector` interface once;
every channel-specific class just supplies its `ConnectorType`. Every
outgoing call and every incoming webhook is persisted via
`Repository.saveIntegrationLog` (`IntegrationLogEntry` — connector,
direction, payload, status, synthetic response status, timestamp). No
network call exists anywhere in this class. A `shouldFail` test-only hook
lets tests simulate a delivery failure deterministically without any
timing dependency.

## 3. Connector Manager

**File:** `packages/integrations/src/connector-manager.ts`.

- `getConnector(type)` — load the connector implementation for a type.
- `validateConfig(type)` — is a real adapter's env-var credentials present
  (never validates them against a live API — there is no live API).
- `checkHealth(type)` / `getStatus(type)` / `getAllStatuses()` — derives
  one of `connected` (env configured) / `mock` (unconfigured, still fully
  operable) / `error` (health check failing) / `disconnected` (operator
  disabled).
- `route(type, action, input)` — dispatches immediately; on failure,
  enqueues a retry job through `@mkh/queue`'s `JobQueue`
  (`type: "connector-dispatch"`) rather than reimplementing backoff/DLQ.
- `retryNext()` — claims and retries whatever connector-dispatch job is
  globally next due (a background worker's drain loop).
- `retryAllPendingFor(type)` — retries specifically one connector's due
  jobs (what the dashboard's per-connector Retry button calls).
- `disable(type)` / `enable(type)` / `disableIfUnhealthy(type)` — take a
  connector out of rotation without touching its configuration.

**Singleton:** `packages/integrations/src/get-connector-manager.ts`'s
`getConnectorManager()` mirrors `@mkh/database`'s `getRepository()`
pattern — one instance per process, so `disable()`/`enable()` state
(in-memory only) is consistent across every caller in that process,
including the dashboard's server actions.

## 4. Admin Dashboard — AI Integrations

**Files:** `apps/dashboard/src/app/admin/integrations/page.tsx` + `actions.ts`.

A new page (does not touch the existing static `/integrations` env-var
checklist from Sprint 1) showing, per connector: status badge
(Connected/Disconnected/Mock/Error), last sync time (from the most recent
`IntegrationLogEntry`), pending queue count, failed (dead-lettered) queue
count, and three buttons — Retry, Health Check, Disable/Enable — each a
plain HTML `<form>` posting to a Next.js Server Action, so the page needs
no client-side JavaScript.

## 5. Configuration

**Files:** `packages/integrations/src/connector-config.ts`, `.env.example`.

Each connector's expected env vars are declared as data
(`CONNECTOR_REQUIRED_ENV`), read from `process.env` directly — the same
convention `packages/notifications/src/channels/*.ts` already established
in Sprint 1, not the zod-validated `@mkh/shared` config schema, since
these are per-external-service credentials rather than core app
configuration. Nothing here is a secret; only the variable *names* are
declared. No code path reads or requires any of them to be set.

## 6. Webhook Engine

**File:** `packages/integrations/src/webhook-engine.ts`.

`receive(input)`: validate signature (HMAC-SHA256 over the JSON payload,
`computeWebhookSignature` — skipped entirely when no secret is
configured, which is every case today) → the connector's own
`receiveWebhook()` parses/normalizes the payload (and already logs the
incoming request) → push the normalized message into the Job Queue
(`type: "webhook-inbound"`). `claimNext()`/`complete()`/`fail()` expose
the same claim-then-resolve lifecycle as `JobQueue` itself, so a consumer
(the Conversation Engine) controls whether a processing failure gets
retried.

## 7. Notification Engine

**File:** `packages/integrations/src/notification-engine.ts`.

`send({ connector, recipient, content })` dispatches any
`OutboundMessageContent` (`text` / `image` / `pdf` / `template` /
`buttons` — extensible for future interactive-message kinds) through
`ConnectorManager.route()`, picking `sendMessage`/`sendMedia`/
`sendTemplate` based on the content kind. Nothing in this class is
WhatsApp-specific (or specific to any one channel) — the same call shape
works identically for all six connector types.

## 8. Conversation Engine

**File:** `packages/integrations/src/conversation-engine.ts`.

`ingestMessage(connector, normalized)` finds the sender's active
(`open`/`routed`) conversation on that connector, or opens a new one, and
appends the message to `ChatConversation.history`. Every field the brief
asks for is on `ChatConversation` (`packages/shared/src/types.ts`):
sender, connector, intent, assignedAgent, status, history, timestamps.
`close(id)` ends a conversation so the next message from that sender
starts fresh rather than reopening old context. `processNextWebhookJob()`
drives this from the Webhook Engine's queue, completing or failing the
underlying job depending on whether ingestion succeeded.

## 9. AI Router

**File:** `packages/integrations/src/ai-router.ts`.

`route(text)` resolves a destination agent via the Agent Registry's
keyword matching — deterministic today (no external AI call, per this
sprint's rules), structured so swapping in an LLM-based classifier later
(through the existing Reasoning Engine) only means replacing `route()`'s
implementation, not any caller.

## 10. Agent Registry

**Files:** `packages/integrations/src/agent-registry.ts` (the mechanism) +
`default-agents.ts` (the data).

Agents self-register via `AgentRegistry.register({ moduleId, keywords,
description })` — `register()` validates the id against the real employee
registry (`@mkh/ai-engine`'s `getEmployee`), so a typo fails loudly at
startup rather than silently routing nowhere. `default-agents.ts`
registers all ten digital employees with representative keyword sets;
`ceo-assistant` is registered with broad fallback keywords, matching its
existing executive-summary role elsewhere in the system. No `ai-router.ts`
code changes are needed to add an 11th agent or retune an existing one's
keywords.

## What Sprint 4A explicitly did not build

Per the brief's strict rules: no real WhatsApp/Meta/Telegram/Email/OTA/MK
Connect API call anywhere. No changes to CRM, Finance, or HR logic. The
existing `/integrations` (Sprint 1 static env checklist) and every other
dashboard page are untouched. `packages/connectors` (Sprint 1's
research/social/trend connectors, used by the AI employees themselves) is
a separate, unrelated system from this sprint's messaging/webhook
Integration Layer — the two were not merged.
