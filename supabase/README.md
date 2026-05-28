# Supabase — Database & RLS

Phase 1 of the roadmap: schema, RLS policies, triggers, and seed data for the
Staff Management System.

## محتويات المجلد

```
supabase/
├── migrations/
│   ├── 0001_extensions_and_enums.sql      الـ extensions و enum types
│   ├── 0002_core_tables.sql               profiles, departments, projects, members
│   ├── 0003_task_tables.sql               tasks, comments, attachments, deps, time logs
│   ├── 0004_integration_tables.sql        drive, notifications, preferences
│   ├── 0005_evaluation_tables.sql         KPIs, evaluations, peer reviews, standups
│   ├── 0006_gamification_audit_tables.sql points, badges, audit logs
│   ├── 0007_functions_and_triggers.sql    updated_at, new-user, audit triggers
│   ├── 0008_rls_helpers.sql               SECURITY DEFINER helper functions
│   ├── 0009_rls_policies.sql              RLS policies (the permission matrix)
│   └── 0010_storage_and_realtime.sql      task-attachments bucket + realtime
└── seed.sql                               departments + KPI catalogue + badges
```

**22 جدول** إجمالاً، مطابقة للـ schema في `docs/ROADMAP.md`.

## التطبيق على مشروع Supabase

### الطريقة 1 — Supabase CLI (مفضّلة)

```bash
# مرة واحدة: اربط المشروع المحلي بمشروعك على Supabase
npx supabase link --project-ref <your-project-ref>

# طبّق كل الـ migrations
npx supabase db push

# (اختياري) شغّل بيانات الـ seed
psql "$DATABASE_URL" -f supabase/seed.sql
```

### الطريقة 2 — SQL Editor في لوحة Supabase

نفّذ ملفات `migrations/*.sql` بالترتيب (0001 → 0009)، وبعدها `seed.sql`.

## توليد الـ TypeScript types

بعد تطبيق الـ schema، ولّد الأنواع الحقيقية بدل الـ placeholder:

```bash
npx supabase gen types typescript --project-id <your-project-ref> \
  > src/types/database.ts
```

> الملف `src/types/database.ts` حالياً نسخة مكتوبة يدوياً مطابقة للـ schema،
> لحد ما تولّد الأنواع من مشروعك الفعلي.

## ملاحظات الأمان (RLS)

- **كل جدول** عليه `enable row level security`.
- الصلاحيات معرّفة عبر دوال `SECURITY DEFINER` (في `0008`) لتفادي الـ recursion:
  `is_super_admin()`, `manages_department()`, `can_access_project()`، إلخ.
- الـ **service role** (سيرفر) ومحفّزات `SECURITY DEFINER` بتتخطى الـ RLS، فإنشاء
  الـ audit logs والإشعارات والبروفايلات بيشتغل من غير policies للكتابة من العميل.
- **الأدوار:** أضفنا عمود `role` (enum `app_role`) على `profiles` —
  `super_admin` / `team_leader` / `team_member` — لأن مصفوفة الصلاحيات تحتاج دور
  عام لكل مستخدم (مش موجود صراحةً في الـ schema الأصلي بالخريطة).
