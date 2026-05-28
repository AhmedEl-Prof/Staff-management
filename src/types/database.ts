// Database types for the Staff Management System.
//
// Hand-written to mirror supabase/migrations/*.sql. Once the schema is applied
// to a live project, you can regenerate this file (and overwrite it) with:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts
//
// Keep this in sync with the migrations until generation is wired up.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// -- Enums --------------------------------------------------------------------
export type AppRole = "super_admin" | "team_leader" | "team_member";
export type EmploymentType = "full_time" | "part_time" | "freelance";
export type DepartmentMemberRole = "manager" | "member";
export type ProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled";
export type PriorityLevel = "low" | "medium" | "high" | "urgent";
export type ProjectMemberRole = "lead" | "member" | "observer";
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "review"
  | "done"
  | "cancelled";
export type KpiPeriod = "weekly" | "monthly";
export type EvaluationPeriodType = "weekly" | "monthly";
export type EvaluationStatus = "draft" | "finalized" | "sent";
export type StandupMood = "great" | "good" | "okay" | "stressed" | "blocked";

// Helper to derive Insert/Update shapes: optional fields become optional, and
// columns with DB defaults can be omitted on insert.
type WithDefaults<Row, Optional extends keyof Row> = Omit<Row, Optional> &
  Partial<Pick<Row, Optional>>;

// -- Row shapes ---------------------------------------------------------------
export type ProfileRow = {
  id: string;
  full_name: string | null;
  arabic_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: AppRole;
  employment_type: EmploymentType;
  weekly_hours: number;
  hire_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DepartmentRow = {
  id: string;
  name: string;
  name_ar: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DepartmentMemberRow = {
  id: string;
  department_id: string;
  user_id: string;
  role: DepartmentMemberRole;
  joined_at: string;
}

export type ProjectRow = {
  id: string;
  department_id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  client_name: string | null;
  status: ProjectStatus;
  priority: PriorityLevel;
  start_date: string | null;
  end_date: string | null;
  drive_folder_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectMemberRow = {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  assigned_at: string;
}

export type TaskRow = {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: PriorityLevel;
  assigned_to: string | null;
  created_by: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskCommentRow = {
  id: string;
  task_id: string;
  user_id: string | null;
  content: string;
  mentions: string[];
  created_at: string;
}

export type TaskAttachmentRow = {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export type TaskDependencyRow = {
  id: string;
  task_id: string;
  depends_on_task_id: string;
}

export type TimeLogRow = {
  id: string;
  task_id: string;
  user_id: string | null;
  hours: number;
  description: string | null;
  logged_date: string;
  created_at: string;
}

export type DriveConnectionRow = {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DriveFolderRow = {
  id: string;
  project_id: string;
  folder_id: string;
  folder_url: string | null;
  synced_at: string | null;
  created_at: string;
}

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export type NotificationPreferenceRow = {
  id: string;
  user_id: string;
  email_task_assigned: boolean;
  email_task_deadline: boolean;
  email_mentions: boolean;
  email_evaluations: boolean;
  in_app_notifications: boolean;
}

export type KpiDefinitionRow = {
  id: string;
  department_id: string | null;
  name: string;
  name_ar: string | null;
  description: string | null;
  unit: string | null;
  weight: number;
  period: KpiPeriod;
  created_at: string;
}

export type KpiLogRow = {
  id: string;
  user_id: string;
  kpi_id: string;
  value: number;
  period_start: string;
  period_end: string;
  recorded_at: string;
}

export type EvaluationRow = {
  id: string;
  user_id: string;
  evaluator_id: string | null;
  period_type: EvaluationPeriodType;
  period_start: string;
  period_end: string;
  total_score: number | null;
  kpi_scores: Json;
  notes: string | null;
  status: EvaluationStatus;
  generated_at: string;
}

export type PeerReviewRow = {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  period_start: string;
  period_end: string;
  ratings: Json;
  comments: string | null;
  is_anonymous: boolean;
  created_at: string;
}

export type StandupResponseRow = {
  id: string;
  user_id: string;
  date: string;
  yesterday_work: string | null;
  today_plan: string | null;
  blockers: string | null;
  mood: StandupMood | null;
  submitted_at: string;
}

export type PointsLogRow = {
  id: string;
  user_id: string;
  points: number;
  reason: string | null;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
}

export type BadgeRow = {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  icon: string | null;
  criteria: Json;
  created_at: string;
}

export type UserBadgeRow = {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Maps a Row type to a Supabase-style { Row; Insert; Update } table definition.
type TableDef<Row, InsertOptional extends keyof Row> = {
  Row: Row;
  Insert: WithDefaults<Row, InsertOptional>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<
        ProfileRow,
        | "full_name"
        | "arabic_name"
        | "avatar_url"
        | "phone"
        | "role"
        | "employment_type"
        | "weekly_hours"
        | "hire_date"
        | "is_active"
        | "created_at"
        | "updated_at"
      >;
      departments: TableDef<
        DepartmentRow,
        | "id"
        | "description"
        | "color"
        | "icon"
        | "manager_id"
        | "created_at"
        | "updated_at"
      >;
      department_members: TableDef<
        DepartmentMemberRow,
        "id" | "role" | "joined_at"
      >;
      projects: TableDef<
        ProjectRow,
        | "id"
        | "name_ar"
        | "description"
        | "client_name"
        | "status"
        | "priority"
        | "start_date"
        | "end_date"
        | "drive_folder_id"
        | "created_by"
        | "created_at"
        | "updated_at"
      >;
      project_members: TableDef<
        ProjectMemberRow,
        "id" | "role" | "assigned_at"
      >;
      tasks: TableDef<
        TaskRow,
        | "id"
        | "parent_task_id"
        | "description"
        | "status"
        | "priority"
        | "assigned_to"
        | "created_by"
        | "estimated_hours"
        | "actual_hours"
        | "start_date"
        | "due_date"
        | "completed_at"
        | "created_at"
        | "updated_at"
      >;
      task_comments: TableDef<
        TaskCommentRow,
        "id" | "user_id" | "mentions" | "created_at"
      >;
      task_attachments: TableDef<
        TaskAttachmentRow,
        "id" | "file_size" | "uploaded_by" | "created_at"
      >;
      task_dependencies: TableDef<TaskDependencyRow, "id">;
      time_logs: TableDef<
        TimeLogRow,
        "id" | "user_id" | "description" | "logged_date" | "created_at"
      >;
      drive_connections: TableDef<
        DriveConnectionRow,
        "id" | "expires_at" | "created_at" | "updated_at"
      >;
      drive_folders: TableDef<
        DriveFolderRow,
        "id" | "folder_url" | "synced_at" | "created_at"
      >;
      notifications: TableDef<
        NotificationRow,
        "id" | "message" | "link" | "is_read" | "created_at"
      >;
      notification_preferences: TableDef<
        NotificationPreferenceRow,
        | "id"
        | "email_task_assigned"
        | "email_task_deadline"
        | "email_mentions"
        | "email_evaluations"
        | "in_app_notifications"
      >;
      kpi_definitions: TableDef<
        KpiDefinitionRow,
        | "id"
        | "department_id"
        | "name_ar"
        | "description"
        | "unit"
        | "weight"
        | "period"
        | "created_at"
      >;
      kpi_logs: TableDef<KpiLogRow, "id" | "recorded_at">;
      evaluations: TableDef<
        EvaluationRow,
        | "id"
        | "evaluator_id"
        | "total_score"
        | "kpi_scores"
        | "notes"
        | "status"
        | "generated_at"
      >;
      peer_reviews: TableDef<
        PeerReviewRow,
        "id" | "ratings" | "comments" | "is_anonymous" | "created_at"
      >;
      standup_responses: TableDef<
        StandupResponseRow,
        | "id"
        | "date"
        | "yesterday_work"
        | "today_plan"
        | "blockers"
        | "mood"
        | "submitted_at"
      >;
      points_log: TableDef<
        PointsLogRow,
        "id" | "reason" | "source_type" | "source_id" | "created_at"
      >;
      badges: TableDef<
        BadgeRow,
        "id" | "name_ar" | "description" | "icon" | "criteria" | "created_at"
      >;
      user_badges: TableDef<UserBadgeRow, "id" | "earned_at">;
      audit_logs: TableDef<
        AuditLogRow,
        | "id"
        | "user_id"
        | "entity_id"
        | "changes"
        | "ip_address"
        | "user_agent"
        | "created_at"
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
      employment_type: EmploymentType;
      department_member_role: DepartmentMemberRole;
      project_status: ProjectStatus;
      priority_level: PriorityLevel;
      project_member_role: ProjectMemberRole;
      task_status: TaskStatus;
      kpi_period: KpiPeriod;
      evaluation_period_type: EvaluationPeriodType;
      evaluation_status: EvaluationStatus;
      standup_mood: StandupMood;
    };
    CompositeTypes: Record<string, never>;
  };
}
