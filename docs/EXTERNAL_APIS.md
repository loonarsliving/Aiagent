# External APIs

None of these are called today — everything runs against
`packages/connectors` mocks. This is the reference list for when each one
gets wired in (tracked per connector in `docs/CONNECTORS.md`).

| API | Purpose | Auth method | Docs |
|---|---|---|---|
| Meta Graph API (Instagram) | Read IG account/post insights for Marketing Strategist AI | OAuth 2.0, long-lived Page access token | developers.facebook.com/docs/instagram-api |
| Meta Marketing API | Read Meta Ads campaign performance; execute budget/status changes (Stage 2 only) | OAuth 2.0, System User token with `ads_read` / `ads_management` | developers.facebook.com/docs/marketing-apis |
| TikTok for Business API | Read TikTok account/post insights | OAuth 2.0, business account token | business-api.tiktok.com/portal/docs |
| WhatsApp Business Cloud API | Send notifications to Owner/Dir Ops/Markom | Meta Business app, permanent access token | developers.facebook.com/docs/whatsapp/cloud-api |
| Telegram Bot API | Send notifications | Bot token (BotFather) | core.telegram.org/bots/api |
| Email provider (Resend / SendGrid / etc.) | Send email notifications & reports | Provider API key | provider-specific |
| Web Push / FCM | Push notifications | VAPID keys / FCM server key | web.dev/push-notifications, firebase.google.com/docs/cloud-messaging |
| Supabase | Persistence (reports, approvals, logs, notifications, schedule) | Project URL + service role key (server-side only) | supabase.com/docs |
| MK Connect (internal, not yet built) | Read sales targets / finance transactions from the production ERP | Internal API key, scoped read-only | to be defined when Owner authorizes integration |

## Handling secrets

- All tokens above are read from environment variables only (see
  `.env.example`) — never hardcoded, never committed.
- Every adapter/connector treats a missing credential as "stay
  mocked/inert," not as an error — so partial configuration is always safe.
- `SUPABASE_SERVICE_ROLE_KEY` and any Meta/WhatsApp/Telegram tokens must
  only be set as server-side env vars (never `NEXT_PUBLIC_*`).
