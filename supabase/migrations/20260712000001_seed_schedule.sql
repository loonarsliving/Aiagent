-- Default schedule (see packages/database/src/seed-data.ts DEFAULT_SCHEDULE) —
-- kept in sync manually; this is the same data InMemoryRepository seeds.
-- Every employee gets a daily, weekly (Monday), and monthly (1st) slot.
insert into schedule_entries (id, module_id, cadence, time, day_of_week, day_of_month, label, enabled) values
  ('sch_mi_daily', 'marketing-intelligence', 'daily', '06:00', null, null, 'Marketing Intelligence — Daily Research', true),
  ('sch_cp_daily', 'content-planner', 'daily', '07:30', null, null, 'Content Planner — Daily Checklist & Reminders', true),
  ('sch_mas_daily', 'meta-ads-specialist', 'daily', '08:00', null, null, 'Meta Ads Specialist — Daily Campaign Analysis', true),
  ('sch_ss_daily', 'sales-supervisor', 'daily', '12:00', null, null, 'Sales Supervisor — Daily Progress', true),
  ('sch_bpm_daily', 'branch-performance-manager', 'daily', '12:15', null, null, 'Branch Performance Manager — Daily Branch Review', true),
  ('sch_fa_daily', 'finance-analyst', 'daily', '15:00', null, null, 'Finance Analyst — Daily Analysis', true),
  ('sch_hr_daily', 'hr-officer', 'daily', '15:15', null, null, 'HR Officer — Daily Attendance & KPI Review', true),
  ('sch_ota_daily', 'ota-manager', 'daily', '15:30', null, null, 'OTA Manager — Daily Occupancy & Pricing Review', true),
  ('sch_sop_daily', 'sop-guardian', 'daily', '17:00', null, null, 'SOP Guardian — Daily Compliance Check', true),
  ('sch_ceo_daily', 'ceo-assistant', 'daily', '18:00', null, null, 'CEO Assistant — Daily Executive Summary', true),

  ('sch_mi_weekly', 'marketing-intelligence', 'weekly', '06:30', 1, null, 'Marketing Intelligence — Weekly Strategy', true),
  ('sch_cp_weekly', 'content-planner', 'weekly', '07:45', 1, null, 'Content Planner — Weekly Checklist Rebuild', true),
  ('sch_mas_weekly', 'meta-ads-specialist', 'weekly', '09:00', 1, null, 'Meta Ads Specialist — Weekly Campaign Comparison', true),
  ('sch_ss_weekly', 'sales-supervisor', 'weekly', '12:30', 1, null, 'Sales Supervisor — Weekly Pace Check', true),
  ('sch_bpm_weekly', 'branch-performance-manager', 'weekly', '12:45', 1, null, 'Branch Performance Manager — Weekly Trend', true),
  ('sch_fa_weekly', 'finance-analyst', 'weekly', '15:30', 1, null, 'Finance Analyst — Weekly Summary', true),
  ('sch_hr_weekly', 'hr-officer', 'weekly', '15:45', 1, null, 'HR Officer — Weekly Trend', true),
  ('sch_ota_weekly', 'ota-manager', 'weekly', '16:00', 1, null, 'OTA Manager — Weekly Occupancy Trend', true),
  ('sch_sop_weekly', 'sop-guardian', 'weekly', '17:30', 1, null, 'SOP Guardian — Weekly Compliance Trend', true),
  ('sch_ceo_weekly', 'ceo-assistant', 'weekly', '18:30', 1, null, 'CEO Assistant — Weekly Rollup', true),

  ('sch_mi_monthly', 'marketing-intelligence', 'monthly', '06:00', null, 1, 'Marketing Intelligence — Monthly Knowledge Base Retrospective', true),
  ('sch_cp_monthly', 'content-planner', 'monthly', '07:30', null, 1, 'Content Planner — Monthly Completion Recap', true),
  ('sch_mas_monthly', 'meta-ads-specialist', 'monthly', '08:00', null, 1, 'Meta Ads Specialist — Monthly Ads Recap', true),
  ('sch_ss_monthly', 'sales-supervisor', 'monthly', '12:00', null, 1, 'Sales Supervisor — Monthly Target Recap', true),
  ('sch_bpm_monthly', 'branch-performance-manager', 'monthly', '12:30', null, 1, 'Branch Performance Manager — Monthly Recap', true),
  ('sch_fa_monthly', 'finance-analyst', 'monthly', '15:00', null, 1, 'Finance Analyst — Monthly Financial Report', true),
  ('sch_hr_monthly', 'hr-officer', 'monthly', '15:30', null, 1, 'HR Officer — Monthly Recap', true),
  ('sch_ota_monthly', 'ota-manager', 'monthly', '16:00', null, 1, 'OTA Manager — Monthly Recap', true),
  ('sch_sop_monthly', 'sop-guardian', 'monthly', '17:00', null, 1, 'SOP Guardian — Monthly Compliance Recap', true),
  ('sch_ceo_monthly', 'ceo-assistant', 'monthly', '19:00', null, 1, 'CEO Assistant — Monthly Board Report', true)
on conflict (id) do nothing;

insert into markom_checklist_completion (day_index, completed) values
  (0, true), (1, true), (2, false), (3, false), (4, false), (5, false), (6, false)
on conflict (day_index) do nothing;
