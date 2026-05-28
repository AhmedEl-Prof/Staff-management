-- =============================================================================
-- Migration 0009 — Row Level Security policies
-- Enables RLS on every table and encodes the roadmap permission matrix.
--
-- Notes:
--  * The service role (server-side) and SECURITY DEFINER triggers bypass RLS,
--    so system inserts (audit logs, profile provisioning, notifications,
--    evaluations) work without client-facing insert policies.
--  * All policies assume an authenticated caller (auth.uid() is not null).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enable RLS
-- -----------------------------------------------------------------------------
alter table public.profiles                 enable row level security;
alter table public.departments               enable row level security;
alter table public.department_members        enable row level security;
alter table public.projects                  enable row level security;
alter table public.project_members           enable row level security;
alter table public.tasks                     enable row level security;
alter table public.task_comments             enable row level security;
alter table public.task_attachments          enable row level security;
alter table public.task_dependencies         enable row level security;
alter table public.time_logs                 enable row level security;
alter table public.drive_connections         enable row level security;
alter table public.drive_folders             enable row level security;
alter table public.notifications             enable row level security;
alter table public.notification_preferences  enable row level security;
alter table public.kpi_definitions           enable row level security;
alter table public.kpi_logs                  enable row level security;
alter table public.evaluations               enable row level security;
alter table public.peer_reviews              enable row level security;
alter table public.standup_responses         enable row level security;
alter table public.points_log                enable row level security;
alter table public.badges                    enable row level security;
alter table public.user_badges               enable row level security;
alter table public.audit_logs                enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check (public.is_super_admin());

create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- departments
-- -----------------------------------------------------------------------------
create policy departments_select on public.departments
  for select to authenticated
  using (public.is_super_admin() or public.is_department_member(id));

create policy departments_admin_write on public.departments
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- department_members
-- -----------------------------------------------------------------------------
create policy department_members_select on public.department_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_department_member(department_id));

create policy department_members_manage on public.department_members
  for all to authenticated
  using (public.manages_department(department_id))
  with check (public.manages_department(department_id));

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create policy projects_select on public.projects
  for select to authenticated
  using (public.can_access_project(id));

create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.manages_department(department_id));

create policy projects_update on public.projects
  for update to authenticated
  using (public.manages_department(department_id))
  with check (public.manages_department(department_id));

create policy projects_delete on public.projects
  for delete to authenticated
  using (public.manages_department(department_id));

-- -----------------------------------------------------------------------------
-- project_members
-- -----------------------------------------------------------------------------
create policy project_members_select on public.project_members
  for select to authenticated
  using (public.can_access_project(project_id));

create policy project_members_manage on public.project_members
  for all to authenticated
  using (public.manages_project(project_id))
  with check (public.manages_project(project_id));

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
create policy tasks_select on public.tasks
  for select to authenticated
  using (public.can_access_project(project_id));

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (public.manages_project(project_id));

-- Managers of the project, or the assignee, may update a task.
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.manages_project(project_id) or assigned_to = auth.uid())
  with check (public.manages_project(project_id) or assigned_to = auth.uid());

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.manages_project(project_id));

-- -----------------------------------------------------------------------------
-- task_comments
-- -----------------------------------------------------------------------------
create policy task_comments_select on public.task_comments
  for select to authenticated
  using (public.can_access_task(task_id));

create policy task_comments_insert on public.task_comments
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_task(task_id));

create policy task_comments_modify_own on public.task_comments
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy task_comments_delete_own on public.task_comments
  for delete to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- task_attachments
-- -----------------------------------------------------------------------------
create policy task_attachments_select on public.task_attachments
  for select to authenticated
  using (public.can_access_task(task_id));

create policy task_attachments_insert on public.task_attachments
  for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_access_task(task_id));

create policy task_attachments_delete on public.task_attachments
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- task_dependencies
-- -----------------------------------------------------------------------------
create policy task_dependencies_select on public.task_dependencies
  for select to authenticated
  using (public.can_access_task(task_id));

create policy task_dependencies_manage on public.task_dependencies
  for all to authenticated
  using (
    exists (select 1 from public.tasks tk
            where tk.id = task_id and public.manages_project(tk.project_id))
  )
  with check (
    exists (select 1 from public.tasks tk
            where tk.id = task_id and public.manages_project(tk.project_id))
  );

-- -----------------------------------------------------------------------------
-- time_logs
-- -----------------------------------------------------------------------------
create policy time_logs_select on public.time_logs
  for select to authenticated
  using (user_id = auth.uid() or public.can_access_task(task_id));

create policy time_logs_insert on public.time_logs
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_task(task_id));

create policy time_logs_modify_own on public.time_logs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy time_logs_delete_own on public.time_logs
  for delete to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- drive_connections — strictly personal
-- -----------------------------------------------------------------------------
create policy drive_connections_own on public.drive_connections
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- drive_folders
-- -----------------------------------------------------------------------------
create policy drive_folders_select on public.drive_folders
  for select to authenticated
  using (public.can_access_project(project_id));

create policy drive_folders_manage on public.drive_folders
  for all to authenticated
  using (public.manages_project(project_id))
  with check (public.manages_project(project_id));

-- -----------------------------------------------------------------------------
-- notifications — personal inbox
-- -----------------------------------------------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

create policy notifications_admin_insert on public.notifications
  for insert to authenticated
  with check (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- notification_preferences
-- -----------------------------------------------------------------------------
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid() or public.is_super_admin())
  with check (user_id = auth.uid() or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- kpi_definitions
-- -----------------------------------------------------------------------------
create policy kpi_definitions_select on public.kpi_definitions
  for select to authenticated
  using (
    public.is_super_admin()
    or department_id is null
    or public.is_department_member(department_id)
  );

create policy kpi_definitions_manage on public.kpi_definitions
  for all to authenticated
  using (public.is_super_admin() or public.manages_department(department_id))
  with check (public.is_super_admin() or public.manages_department(department_id));

-- -----------------------------------------------------------------------------
-- kpi_logs
-- -----------------------------------------------------------------------------
create policy kpi_logs_select on public.kpi_logs
  for select to authenticated
  using (user_id = auth.uid() or public.manages_user(user_id));

create policy kpi_logs_manage on public.kpi_logs
  for all to authenticated
  using (public.manages_user(user_id))
  with check (public.manages_user(user_id));

-- -----------------------------------------------------------------------------
-- evaluations
-- -----------------------------------------------------------------------------
create policy evaluations_select on public.evaluations
  for select to authenticated
  using (user_id = auth.uid() or public.manages_user(user_id));

create policy evaluations_manage on public.evaluations
  for all to authenticated
  using (public.manages_user(user_id))
  with check (public.manages_user(user_id));

-- -----------------------------------------------------------------------------
-- peer_reviews
-- -----------------------------------------------------------------------------
create policy peer_reviews_select on public.peer_reviews
  for select to authenticated
  using (
    reviewer_id = auth.uid()
    or public.manages_user(reviewee_id)
  );

create policy peer_reviews_insert on public.peer_reviews
  for insert to authenticated
  with check (reviewer_id = auth.uid());

create policy peer_reviews_modify_own on public.peer_reviews
  for update to authenticated
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid());

create policy peer_reviews_delete on public.peer_reviews
  for delete to authenticated
  using (reviewer_id = auth.uid() or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- standup_responses
-- -----------------------------------------------------------------------------
create policy standup_responses_select on public.standup_responses
  for select to authenticated
  using (user_id = auth.uid() or public.manages_user(user_id));

create policy standup_responses_insert on public.standup_responses
  for insert to authenticated
  with check (user_id = auth.uid());

create policy standup_responses_update_own on public.standup_responses
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy standup_responses_delete on public.standup_responses
  for delete to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- points_log — readable company-wide for the leaderboard; system writes only
-- -----------------------------------------------------------------------------
create policy points_log_select on public.points_log
  for select to authenticated
  using (auth.uid() is not null);

create policy points_log_admin_write on public.points_log
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- badges — catalogue readable to all; managed by admins
-- -----------------------------------------------------------------------------
create policy badges_select on public.badges
  for select to authenticated
  using (auth.uid() is not null);

create policy badges_admin_write on public.badges
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- user_badges — readable to all; awarded by the system
-- -----------------------------------------------------------------------------
create policy user_badges_select on public.user_badges
  for select to authenticated
  using (auth.uid() is not null);

create policy user_badges_admin_write on public.user_badges
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- audit_logs — super admins read only; writes happen via SECURITY DEFINER
-- triggers (which bypass RLS). No insert/update/delete policy on purpose.
-- -----------------------------------------------------------------------------
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_super_admin());
