-- Default schedule (see packages/database/src/seed-data.ts DEFAULT_SCHEDULE) —
-- kept in sync manually; this is the same data InMemoryRepository seeds.
-- Every employee gets a daily, weekly (Monday), and monthly (1st) slot.
insert into schedule_entries (id, module_id, cadence, time, day_of_week, day_of_month, label, enabled) values
  ('sch_mi_daily', 'marketing-intelligence', 'daily', '06:00', null, null, 'Marketing Intelligence — Daily Research', true),
  ('sch_mo_daily', 'marketing-operation', 'daily', '07:30', null, null, 'Marketing Operation — Daily Checklist & Reminders', true),
  ('sch_ma_daily', 'meta-ads-operator', 'daily', '08:00', null, null, 'Meta Ads AI — Daily Campaign Analysis', true),
  ('sch_ss_daily', 'sales-supervisor', 'daily', '12:00', null, null, 'Sales Supervisor — Daily Progress', true),
  ('sch_fa_daily', 'finance-analyst', 'daily', '15:00', null, null, 'Finance Analyst — Daily Analysis', true),
  ('sch_ceo_daily', 'ceo-assistant', 'daily', '18:00', null, null, 'CEO Assistant — Daily Executive Summary', true),

  ('sch_mi_weekly', 'marketing-intelligence', 'weekly', '06:30', 1, null, 'Marketing Intelligence — Weekly Strategy', true),
  ('sch_mo_weekly', 'marketing-operation', 'weekly', '07:45', 1, null, 'Marketing Operation — Weekly Checklist Rebuild', true),
  ('sch_ma_weekly', 'meta-ads-operator', 'weekly', '09:00', 1, null, 'Meta Ads AI — Weekly Campaign Comparison', true),
  ('sch_ss_weekly', 'sales-supervisor', 'weekly', '12:30', 1, null, 'Sales Supervisor — Weekly Pace Check', true),
  ('sch_fa_weekly', 'finance-analyst', 'weekly', '15:30', 1, null, 'Finance Analyst — Weekly Summary', true),
  ('sch_ceo_weekly', 'ceo-assistant', 'weekly', '18:30', 1, null, 'CEO Assistant — Weekly Rollup', true),

  ('sch_mi_monthly', 'marketing-intelligence', 'monthly', '06:00', null, 1, 'Marketing Intelligence — Monthly Knowledge Base Retrospective', true),
  ('sch_mo_monthly', 'marketing-operation', 'monthly', '07:30', null, 1, 'Marketing Operation — Monthly Completion Recap', true),
  ('sch_ma_monthly', 'meta-ads-operator', 'monthly', '08:00', null, 1, 'Meta Ads AI — Monthly Ads Recap', true),
  ('sch_ss_monthly', 'sales-supervisor', 'monthly', '12:00', null, 1, 'Sales Supervisor — Monthly Target Recap', true),
  ('sch_fa_monthly', 'finance-analyst', 'monthly', '15:00', null, 1, 'Finance Analyst — Monthly Financial Report', true),
  ('sch_ceo_monthly', 'ceo-assistant', 'monthly', '19:00', null, 1, 'CEO Assistant — Monthly Board Report', true)
on conflict (id) do nothing;

insert into markom_checklist_completion (day_index, completed) values
  (0, true), (1, true), (2, false), (3, false), (4, false), (5, false), (6, false)
on conflict (day_index) do nothing;
