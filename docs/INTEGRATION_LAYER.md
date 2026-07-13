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

---

## Sprint 4B — Live WhatsApp Cloud API Connector

Sprint 4B replaces the WhatsApp mock with a real connector against Meta's
WhatsApp Cloud API (`https://graph.facebook.com/v23.0`). Every other
connector (Telegram/Email/Meta/MK Connect/OTA) is still mock-only.

### New environment variables

```
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_VERIFY_TOKEN=
```

These are distinct from the older `WHATSAPP_BUSINESS_TOKEN`/
`WHATSAPP_BUSINESS_PHONE_ID` pair, which belong to the separate Sprint 1
Notification Coordinator channel (`packages/notifications/src/channels/whatsapp.ts`)
— untouched by this sprint. **`registry.ts`'s `createWhatsAppConnector`
activates the real `WhatsAppCloudConnector` only once all four Sprint 4B
vars are set; leaving any one unset keeps `MockWhatsAppConnector` active.**
This is checked on every `createConnectorRegistry()` call (i.e. every
`ConnectorManager` construction), so filling in credentials and
restarting the process is enough to go live — no code change.

### New files

- `packages/integrations/src/connectors/whatsapp-http-client.ts` — narrow,
  injectable HTTP client interface (`get`/`post`) plus
  `createFetchWhatsAppHttpClient`, the real Bearer-token/JSON
  implementation over `fetch`. Mirrors `packages/ai-provider`'s
  `GeminiClientLike` pattern so tests never make a real network call.
- `packages/integrations/src/connectors/whatsapp-cloud-connector.ts` —
  `WhatsAppCloudConnector implements Connector`, plus `connect()`/
  `disconnect()` (optional `Connector` lifecycle hooks — see below),
  `verifyWebhook()`, `normalizeIncomingMessage()`, and the public
  `normalizeOutgoingMessage()` mapper.
- `packages/integrations/src/whatsapp-webhook-handler.ts` —
  `handleWhatsAppWebhookEvent(repo, manager, rawPayload)`, the full
  receive-a-message pipeline, and `verifyWhatsAppWebhookChallenge(mode,
  token, manager)` for the `GET` handshake. Framework-independent (no
  Next.js import) specifically so it's testable with plain vitest.

### `Connector` interface addition

`connect?(): Promise<void>` / `disconnect?(): Promise<void>` were added as
**optional** methods on the shared `Connector` interface (`connector.ts`)
— every mock connector leaves them undefined (nothing to connect to for a
one-shot REST mock call), so this is additive and doesn't change any
existing connector's behavior. `WhatsAppCloudConnector.connect()` proves
credentials work by running `healthCheck()` up front and throwing if it
fails; `disconnect()` is a documented no-op (the Cloud API is stateless
REST — there is no persistent connection to close).

### Real Graph API calls made

| Connector method | Graph API call |
|---|---|
| `healthCheck()` | `GET /{phoneNumberId}?fields=verified_name,display_phone_number` |
| `sendMessage()` (text) | `POST /{phoneNumberId}/messages` with `type: "text"` |
| `sendTemplate()` | same endpoint, `type: "template"` (params mapped positionally to `{{1}}`, `{{2}}`, ... body parameters — Meta templates have no named-parameter concept) |
| `sendMedia()` | same endpoint, `type: "image"` |
| `broadcast()` | loops `sendMessage()` per recipient |

Every call — success, a non-2xx Graph API response, or a thrown network
error — is logged via `Repository.saveIntegrationLog`, including
round-trip latency (`latencyMs`, a new optional field on
`IntegrationLogEntry`). This is what powers the Admin Dashboard's Last
Webhook/Last Incoming/Last Outgoing/Latency/Last Error columns
(`ConnectorManager.getTelemetry(type)`, derived entirely from the log —
no separate telemetry storage).

### Webhook endpoint

**File:** `apps/dashboard/src/app/api/integrations/whatsapp/webhook/route.ts`.

- `GET` — Meta's verification handshake. Reads `hub.mode`/
  `hub.verify_token`/`hub.challenge` query params, delegates to
  `verifyWhatsAppWebhookChallenge()`, and echoes `hub.challenge` back on
  success (`200`) or returns `403` otherwise. In mock mode (no
  credentials set) this **always** returns `403` — there is no real
  verify token to check a request against, so verification correctly
  never succeeds until the connector is actually live.
- `POST` — receives every WhatsApp event. Always acknowledges with `200`
  (per Meta's guidance — a non-200 response triggers retries and,
  eventually, subscription disablement) except for a genuinely
  unparseable JSON body (`400`). Delegates entirely to
  `handleWhatsAppWebhookEvent()`.

**Pipeline inside `handleWhatsAppWebhookEvent`:** `WebhookEngine.receive()`
(validate/normalize/log via the active connector, push into the Job
Queue) -> `ConversationEngine.processNextWebhookJob()` (claim the queued
message, open/continue the sender's `ChatConversation`, run the `AIRouter`
to resolve a destination agent) -> `NotificationEngine.send()` sends a
routing acknowledgment back to the sender through the same
`ConnectorManager` (so the reply goes out via the real Graph API once
live, or is logged as a mock send otherwise). The reply text names the
assigned agent, or gives a generic acknowledgment when no agent matched —
this is the deterministic Agent Registry's routing decision, **not** an
LLM-generated response; wiring the Reasoning Engine into chat replies is
future work, not part of this sprint's explicit method list.

### Meta Developer setup (once real credentials exist)

1. Deploy this app (or run it somewhere Meta can reach over HTTPS —
   `ngrok`/similar for local testing).
2. In the Meta App Dashboard → WhatsApp → Configuration, set:
   - **Callback URL:** `https://<your-domain>/api/integrations/whatsapp/webhook`
   - **Verify Token:** the same value as `WHATSAPP_VERIFY_TOKEN`
3. Subscribe to the `messages` webhook field.
4. Meta immediately sends a `GET` with `hub.mode=subscribe` to confirm —
   the route above handles it automatically.

**Manual verification test:**
```bash
curl "https://<your-domain>/api/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<WHATSAPP_VERIFY_TOKEN>&hub.challenge=12345"
# expect: 200 with body "12345"
```

**Example inbound payload** (what Meta's `POST` body looks like for a text message):
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "<business_account_id>",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "+62...", "phone_number_id": "<phone_number_id>" },
        "contacts": [{ "profile": { "name": "Budi" }, "wa_id": "62812xxxxxxx" }],
        "messages": [{ "from": "62812xxxxxxx", "id": "wamid.XXX", "timestamp": "1699999999", "type": "text", "text": { "body": "Halo" } }]
      }
    }]
  }]
}
```

**Manual send test** (once credentials are set, exercises the pipeline exactly like a real Meta webhook call would):
```bash
curl -X POST https://<your-domain>/api/integrations/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[{"id":"1","changes":[{"field":"messages","value":{"messages":[{"from":"62812xxxxxxx","type":"text","text":{"body":"saya mau ajukan cuti"}}]}}]}]}'
# expect: 200 with {"status":"processed","conversationId":"...","assignedAgent":"hr-officer","replySent":true}
```

### What Sprint 4B explicitly did not build

No other connector went live (Telegram/Email/Meta/MK Connect/OTA are
still mock). No LLM-generated reply content — the "AI result" sent back
is the Agent Registry's deterministic routing decision. No signature
verification is enforced by default (Meta doesn't require it for basic
webhook receipt, and `WHATSAPP_VERIFY_TOKEN` already gates the
subscription handshake itself) — `WebhookEngine`'s existing
`computeWebhookSignature`/HMAC path from Sprint 4A is still available and
wired up if a `secret` is ever passed to `WebhookEngine.receive()`, but
`handleWhatsAppWebhookEvent()` doesn't pass one today. CRM, Finance, HR,
and every other dashboard page are untouched.
