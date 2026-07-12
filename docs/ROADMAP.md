# Roadmap

## Stage 1 — Project structure ✅

Monorepo scaffold: `apps/dashboard` + 8 packages, tsconfig path aliases,
Turborepo pipeline, CI (typecheck/test/build), `.env.example`, Supabase
migrations (unused until `DATA_MODE=supabase`).

## Stage 2 — All modules on dummy data ✅

- Modul 1 Marketing Strategist AI — mocked IG/TikTok/competitor analysis,
  weekly checklist, daily recommendation, content strategy.
- Modul 2 Meta Ads Operator AI — Stage 1 analysis (CPL/CTR/CPC +
  recommendations); Stage 2 approval workflow (propose → owner
  approve/reject → execute → audit log), all still against a mocked
  connector.
- Modul 3 Sales Supervisor AI — target vs progress, lagging-rep detection,
  follow-up recommendations, Dir Ops notification. Read-only.
- Modul 4 Finance Analyst AI — cashflow projection, anomaly detection,
  Owner report. Read-only.
- Modul 5 CEO Assistant AI — daily Executive Summary aggregating the other
  four + Villa/Perumahan breakdown + "needs Owner decision" list.
- Scheduler (default 08/09/12/15/18 WITA slots, modular — add a module by
  adding one entry to `DEFAULT_SCHEDULE`).
- Notification service (dummy channel default; WhatsApp/Telegram/Email/Push
  adapters scaffolded but inert until credentials are supplied).
- Dashboard with the 6 requested menus, all reading dummy data.
- MCP server exposing read-only system state (Claude-ready).

## Stage 3 — Testing ✅

Vitest unit tests for CPL/CTR/CPC calc, approval-gate role enforcement,
sales target/progress classification, finance anomaly detection & cashflow
projection, and the scheduler executor end-to-end against
`InMemoryRepository`. CI runs typecheck + test + build on every push.

## Stage 4 — Stability (this delivery)

`pnpm install && pnpm typecheck && pnpm test && pnpm build` all green
before pushing (see `docs/TESTING_CHECKLIST.md` for the full checklist,
including manual dashboard QA).

## Stage 5 — Documentation ✅

This roadmap + `ARCHITECTURE.md` + `CONNECTORS.md` + `EXTERNAL_APIS.md` +
`TESTING_CHECKLIST.md`.

---

## Post-MVP: real integration (requires explicit Owner go-ahead)

Nothing below happens automatically — each phase is a separate, reviewable
change:

1. **Provision real infrastructure.** Create an actual Supabase project,
   run `supabase/migrations/`, set `DATA_MODE=supabase` + Supabase env vars
   in Vercel. Deploy `apps/dashboard` to Vercel, enable `vercel.json` crons,
   set `CRON_SECRET`.
2. **Wire one notification channel** (start with WhatsApp Business API or
   Telegram — lowest setup cost) by filling in the adapter's `TODO(integration)`
   in `packages/notifications/src/channels/*.ts`.
3. **Wire Marketing connectors** (Instagram Graph API, TikTok API) —
   replace the mocked bodies in `packages/connectors/src/social.ts`,
   keeping the same return types so `marketing-strategist` doesn't change.
4. **Wire Meta Ads connector** (read-only first — campaign insights),
   validate CPL/CTR/CPC against real numbers, retune the thresholds in
   `packages/ai-engine/src/modules/meta-ads-operator/logic.ts`.
5. **Enable Meta Ads Stage 2 execution** — replace the mocked
   `executeMetaAdsAction()` with a real Marketing API call, only after
   Stage 4's read-only numbers have been validated for at least one
   reporting cycle.
6. **MK Connect integration** — replace `packages/connectors/src/mk-connect.ts`'s
   guardrail with a real client once the Owner authorizes connecting to
   `mkh.haluoleo.id`. This is the point where Sales/Finance snapshots switch
   from seed fixtures to real ERP data.
7. **Auth & RBAC on the dashboard** — currently unauthenticated (dummy-data
   stage only); add real auth (Supabase Auth is the natural fit given the
   stack) and enforce `@mkh/security` roles before any credentialed
   deployment.
8. **Expand MCP server** — once the approval workflow has run in production
   for a while, consider adding gated write-tools (e.g. propose an action)
   behind the same RBAC checks used by the dashboard.
