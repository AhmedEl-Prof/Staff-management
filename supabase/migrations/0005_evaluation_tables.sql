-- =============================================================================
-- Migration 0005 — Evaluation tables
-- kpi_definitions, kpi_logs, evaluations, peer_reviews, standup_responses
-- =============================================================================

-- -----------------------------------------------------------------------------
-- kpi_definitions — KPI catalogue per department
-- -----------------------------------------------------------------------------
create table public.kpi_definitions (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments (id) on delete cascade,
  name          text not null,
  name_ar       text,
  description   text,
  unit          text,
  weight        numeric(5, 2) not null default 1,
  period        kpi_period not null default 'monthly',
  created_at    timestamptz not null default now()
);

create index kpi_definitions_department_id_idx on public.kpi_definitions (department_id);

-- -----------------------------------------------------------------------------
-- kpi_logs — recorded KPI values per user/period
-- -----------------------------------------------------------------------------
create table public.kpi_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kpi_id       uuid not null references public.kpi_definitions (id) on delete cascade,
  value        numeric(12, 2) not null,
  period_start date not null,
  period_end   date not null,
  recorded_at  timestamptz not null default now()
);

create index kpi_logs_user_id_idx on public.kpi_logs (user_id);
create index kpi_logs_kpi_id_idx on public.kpi_logs (kpi_id);

-- -----------------------------------------------------------------------------
-- evaluations — weekly/monthly evaluation, auto-generated
-- -----------------------------------------------------------------------------
create table public.evaluations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  evaluator_id uuid references public.profiles (id) on delete set null,
  period_type  evaluation_period_type not null,
  period_start date not null,
  period_end   date not null,
  total_score  numeric(6, 2),
  kpi_scores   jsonb not null default '{}',
  notes        text,
  status       evaluation_status not null default 'draft',
  generated_at timestamptz not null default now()
);

create index evaluations_user_id_idx on public.evaluations (user_id);

-- -----------------------------------------------------------------------------
-- peer_reviews — 360° monthly peer reviews
-- -----------------------------------------------------------------------------
create table public.peer_reviews (
  id           uuid primary key default gen_random_uuid(),
  reviewer_id  uuid not null references public.profiles (id) on delete cascade,
  reviewee_id  uuid not null references public.profiles (id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  ratings      jsonb not null default '{}',
  comments     text,
  is_anonymous boolean not null default false,
  created_at   timestamptz not null default now(),
  check (reviewer_id <> reviewee_id)
);

create index peer_reviews_reviewee_id_idx on public.peer_reviews (reviewee_id);
create index peer_reviews_reviewer_id_idx on public.peer_reviews (reviewer_id);

-- -----------------------------------------------------------------------------
-- standup_responses — daily standup bot answers
-- -----------------------------------------------------------------------------
create table public.standup_responses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  date          date not null default current_date,
  yesterday_work text,
  today_plan    text,
  blockers      text,
  mood          standup_mood,
  submitted_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index standup_responses_user_id_idx on public.standup_responses (user_id);
create index standup_responses_date_idx on public.standup_responses (date);
