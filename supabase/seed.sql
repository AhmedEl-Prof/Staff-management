-- =============================================================================
-- Seed data — reference rows for local development & first deploy
-- Safe to run multiple times (idempotent via stable ids / ON CONFLICT).
--
-- NOTE: This seeds departments, the per-department KPI catalogue, and badge
-- definitions. It does NOT seed users — accounts are provisioned through
-- Supabase Auth by an administrator (no public signup).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Departments (the 4 Everest Ads departments)
-- -----------------------------------------------------------------------------
insert into public.departments (id, name, name_ar, color, icon) values
  ('11111111-1111-1111-1111-111111111111', 'SEO',          'تحسين محركات البحث', '#22c55e', 'search'),
  ('22222222-2222-2222-2222-222222222222', 'Ads / Social', 'الإعلانات والسوشيال',  '#3b82f6', 'megaphone'),
  ('33333333-3333-3333-3333-333333333333', 'Development',  'البرمجة',              '#a855f7', 'code'),
  ('44444444-4444-4444-4444-444444444444', 'Content',      'المحتوى',              '#f59e0b', 'pen-tool')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- KPI definitions per department (from the roadmap)
-- -----------------------------------------------------------------------------

-- SEO
insert into public.kpi_definitions (department_id, name, name_ar, unit, weight, period) values
  ('11111111-1111-1111-1111-111111111111', 'Published articles',  'عدد المقالات المنشورة',      'article', 1, 'monthly'),
  ('11111111-1111-1111-1111-111111111111', 'Ranked keywords',     'كلمات مفتاحية رنكت',         'keyword', 1, 'monthly'),
  ('11111111-1111-1111-1111-111111111111', 'Backlinks acquired',  'باك لينكس محققة',            'link',    1, 'monthly'),
  ('11111111-1111-1111-1111-111111111111', 'Site speed gains',    'تحسين سرعة المواقع',         'score',   1, 'monthly'),
  ('11111111-1111-1111-1111-111111111111', 'Schema implemented',  'تنفيذ Schema markup',        'page',    1, 'monthly'),
  ('11111111-1111-1111-1111-111111111111', 'SEO audits',          'مراجعات SEO',                'audit',   1, 'monthly');

-- Ads / Social
insert into public.kpi_definitions (department_id, name, name_ar, unit, weight, period) values
  ('22222222-2222-2222-2222-222222222222', 'Campaigns launched',  'حملات مُشغَّلة',             'campaign', 1, 'monthly'),
  ('22222222-2222-2222-2222-222222222222', 'Average CTR',         'متوسط CTR',                  '%',        1, 'monthly'),
  ('22222222-2222-2222-2222-222222222222', 'ROAS',                'العائد على الإنفاق',         'x',        1, 'monthly'),
  ('22222222-2222-2222-2222-222222222222', 'Posts published',     'بوستات منشورة',              'post',     1, 'monthly'),
  ('22222222-2222-2222-2222-222222222222', 'Engagement rate',     'معدل التفاعل',               '%',        1, 'monthly'),
  ('22222222-2222-2222-2222-222222222222', 'Follower growth',     'نمو المتابعين',              'follower', 1, 'monthly');

-- Development
insert into public.kpi_definitions (department_id, name, name_ar, unit, weight, period) values
  ('33333333-3333-3333-3333-333333333333', 'Tasks completed',     'تاسكات مُنجَزة',             'task',       1, 'weekly'),
  ('33333333-3333-3333-3333-333333333333', 'Deployments',         'عمليات نشر',                 'deployment', 1, 'monthly'),
  ('33333333-3333-3333-3333-333333333333', 'Bugs fixed',          'باجات مُصلَحة',              'bug',        1, 'monthly'),
  ('33333333-3333-3333-3333-333333333333', 'Code reviews',        'مراجعات كود',                'review',     1, 'monthly'),
  ('33333333-3333-3333-3333-333333333333', 'Documentation',       'توثيق',                      'doc',        1, 'monthly'),
  ('33333333-3333-3333-3333-333333333333', 'Uptime maintenance',  'صيانة التشغيل',              '%',          1, 'monthly');

-- Content
insert into public.kpi_definitions (department_id, name, name_ar, unit, weight, period) values
  ('44444444-4444-4444-4444-444444444444', 'Words written',       'كلمات مكتوبة',               'word',    1, 'monthly'),
  ('44444444-4444-4444-4444-444444444444', 'On-time delivery',    'تسليم في الموعد',            'article', 1, 'monthly'),
  ('44444444-4444-4444-4444-444444444444', 'Approval rate',       'معدل القبول',                '%',       1, 'monthly'),
  ('44444444-4444-4444-4444-444444444444', 'Content quality',     'جودة المحتوى',               'score',   1, 'monthly'),
  ('44444444-4444-4444-4444-444444444444', 'SEO guideline compliance', 'الالتزام بإرشادات SEO', '%',       1, 'monthly');

-- -----------------------------------------------------------------------------
-- Badge definitions (gamification)
-- -----------------------------------------------------------------------------
insert into public.badges (name, name_ar, description, icon, criteria) values
  ('Early Bird',    'الطائر المبكر',  'Completed 10 tasks ahead of deadline', 'sunrise', '{"early_tasks": 10}'),
  ('Standup Streak','مواظب الستاندب', '30-day daily standup streak',          'flame',   '{"standup_streak": 30}'),
  ('Top Performer', 'الأعلى أداءً',   'Ranked #1 on the monthly leaderboard', 'trophy',  '{"leaderboard_rank": 1}'),
  ('Team Player',   'روح الفريق',     'High peer-review scores',              'users',   '{"peer_review_avg": 4.5}')
on conflict do nothing;
