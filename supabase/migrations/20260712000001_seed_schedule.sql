-- Default schedule (see packages/database/src/seed-data.ts DEFAULT_SCHEDULE) —
-- kept in sync manually; this is the same data the InMemoryRepository seeds.
insert into schedule_entries (id, module_id, time, label, enabled) values
  ('sch_marketing', 'marketing-strategist', '08:00', 'Marketing AI', true),
  ('sch_meta_ads', 'meta-ads-operator', '09:00', 'Meta Ads AI', true),
  ('sch_sales', 'sales-supervisor', '12:00', 'Sales AI', true),
  ('sch_finance', 'finance-analyst', '15:00', 'Finance AI', true),
  ('sch_ceo', 'ceo-assistant', '18:00', 'CEO AI Report', true)
on conflict (id) do nothing;
