# Connectors

`packages/connectors` is structured as ports (interfaces) + mock adapters.
Every employee calls a `registry.ts` factory function
(`getSocialResearchConnector()`, `getTrendConnector()`,
`getMetaAdsConnector()`, `getOTAConnector()`, `getExternalSystemConnector()`)
— never an adapter directly — so swapping mock for real is: write a new
adapter file implementing the same port, change one return statement in
`registry.ts`. No employee logic changes.

| Port (`ports/*.port.ts`) | Used by | Real integration target | Auth needed |
|---|---|---|---|
| `SocialResearchConnector.getViralContent` | Marketing Intelligence AI | Instagram Graph API / TikTok for Business API | Long-lived access token per platform |
| `SocialResearchConnector.getCompetitorActivity` | Marketing Intelligence AI | No official "competitor" API — realistically a social-listening vendor or an internal scraper (needs its own compliance review) | Vendor API key |
| `TrendConnector.getTrends("google")` | Marketing Intelligence AI | Google Trends API (or a trend-data vendor) | Vendor-dependent |
| `TrendConnector.getTrends("property"\|"villa"\|"skincare")` | Marketing Intelligence AI | Same as above — category is just a query parameter, not a different API | Vendor-dependent |
| `MetaAdsConnector.getCampaigns` | Meta Ads Specialist AI | Meta Marketing API `GET /{ad-account-id}/insights` | Meta Business app, `ads_read` |
| `OTAConnector.getPropertySnapshots` | OTA Manager AI | OTA channel manager partner API (Booking.com/Agoda/Airbnb) — occupancy, ADR, competitor price, booking pace, dynamic pricing | Partner API key per channel |
| `ExternalSystemConnector.call` | (guardrail only — nothing calls this yet) | MK Connect — the bridge to `mkh.haluoleo.id` / internal ERP | Internal API key, scoped read-only initially |

**Deliberately not a port yet:** Meta Ads "execute" (budget/status
mutation). Building this requires its own future phase and sign-off — see
`docs/ROADMAP.md`. Adding it means adding an `execute()` method to
`MetaAdsConnector` and a real audit-log table, not touching anything else.

## Notification channels (`packages/notifications/src/channels/`)

| Channel | Real integration target | Auth needed |
|---|---|---|
| `whatsapp.ts` | WhatsApp Business Cloud API (`POST /{phone-number-id}/messages`) | Meta Business app, WhatsApp Business Account, permanent access token |
| `telegram.ts` | Telegram Bot API (`sendMessage`) | Bot token from BotFather + target chat/group id |
| `email.ts` | Transactional email provider (Resend, SendGrid, ...) | Provider API key + verified sender domain |
| `push.ts` | Web Push (VAPID) or FCM | VAPID keys or FCM server key |

All four are inert skeletons today — `send()` checks for the relevant env
var and no-ops (logging a warning) if it's unset, so partial configuration
is always safe.

## Data connector (already implemented, opt-in)

| Connector | Purpose | Auth needed |
|---|---|---|
| `@mkh/database` `SupabaseRepository` | Persist reports/approvals/work-log/knowledge-base/notifications when `DATA_MODE=supabase` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

## Claude / MCP

`packages/mcp-server` exposes the system's current state (status, reports,
knowledge base, work log, pending approvals, notifications) as read-only
MCP tools — connect it to Claude Desktop, Claude Code, or eventually MK
Connect via `pnpm mcp:dev` (stdio transport). No write tools exist yet.
