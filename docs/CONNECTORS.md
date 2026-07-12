# Connectors needed at real-integration time

All connectors currently live in `packages/connectors/` and return mocked,
realistic-looking data. This is the list of what each one becomes once
integration is authorized (see `docs/ROADMAP.md`, Post-MVP section).

| Connector (file) | Used by | Real integration target | Auth needed |
|---|---|---|---|
| `social.ts` — `getInstagramSnapshot` | Marketing Strategist AI | Instagram Graph API (Business account, via Meta Graph API) | Long-lived Page/IG access token |
| `social.ts` — `getTikTokSnapshot` | Marketing Strategist AI | TikTok for Business API / TikTok Content API | OAuth app + business account token |
| `social.ts` — `getCompetitorSnapshots` | Marketing Strategist AI | No official "competitor" API — realistically a scheduled scraper or a 3rd-party social-listening tool (e.g. Socialbakers/Iconosquare-style service) | Vendor API key, or an internal scraper (needs its own ToS/compliance review) |
| `social.ts` — `getTrendSignals` | Marketing Strategist AI | TikTok Trending API / manual curation feed until a reliable trends API is chosen | Vendor-dependent |
| `meta-ads.ts` — `getAdCampaigns` | Meta Ads Operator AI | Meta Marketing API `GET /{ad-account-id}/campaigns` + `/insights` | Meta Business app, ads_management or ads_read permission |
| `meta-ads.ts` — `executeMetaAdsAction` | Meta Ads Operator AI (Stage 2, post-approval only) | Meta Marketing API `POST /{campaign-id}` (budget/status updates) | Meta Business app, ads_management permission — **do not enable until Stage 2 execution is explicitly turned on** |
| `mk-connect.ts` — `callMkConnect` | Sales Supervisor AI, Finance Analyst AI (future) | MK Connect — the integration layer to `mkh.haluoleo.id` / internal ERP | Internal API key, scoped to read-only endpoints for sales targets/transactions |

## Notification connectors (`packages/notifications/src/channels/`)

| Channel | Real integration target | Auth needed |
|---|---|---|
| `whatsapp.ts` | WhatsApp Business Cloud API (`POST /{phone-number-id}/messages`) | Meta Business app, WhatsApp Business Account, permanent access token |
| `telegram.ts` | Telegram Bot API (`sendMessage`) | Bot token from BotFather + target chat/group id |
| `email.ts` | Transactional email provider (Resend, SendGrid, or similar) | Provider API key + verified sender domain |
| `push.ts` | Web Push (VAPID) or FCM for mobile | VAPID keys or FCM server key |

## Data connector (already implemented, opt-in)

| Connector | Purpose | Auth needed |
|---|---|---|
| `@mkh/database` `SupabaseRepository` | Persist reports/approvals/logs/notifications when `DATA_MODE=supabase` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
