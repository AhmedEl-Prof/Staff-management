# 📋 خريطة عمل سيستم إدارة الموظفين

## Everest Ads — Staff Management System

> وثيقة مرجعية شاملة لتطوير سيستم إدارة موظفين شركة Everest Ads
> **آخر تحديث:** 28 مايو 2026 | **الإصدار:** 1.0

---

## 📑 الفهرس

1. [نظرة عامة](#نظرة-عامة)
2. [التقنيات المستخدمة](#التقنيات-المستخدمة)
3. [المميزات الأساسية](#المميزات-الأساسية)
4. [الأدوار والصلاحيات](#الأدوار-والصلاحيات)
5. [Database Schema](#database-schema)
6. [خريطة العمل المرحلية](#خريطة-العمل-المرحلية)
7. [مؤشرات الأداء (KPIs)](#مؤشرات-الأداء-kpis)
8. [التكاليف المتوقعة](#التكاليف-المتوقعة)
9. [ملاحظات تقنية](#ملاحظات-تقنية)
10. [Git Workflow](#git-workflow)

---

## 📌 نظرة عامة

سيستم متكامل لإدارة موظفين شركة **Everest Ads** (شركة تسويق إلكتروني) بكل أقسامها، مع إدارة المشاريع والتاسكات وتقييم الأداء بشكل آلي.

### معلومات أساسية

| البند | التفاصيل |
|-------|----------|
| **اسم المشروع** | Staff Management System |
| **الشركة** | Everest Ads |
| **النوع** | Internal Tool (Single Tenant) |
| **عدد المستخدمين المتوقع** | 20-25 موظف |
| **عدد الأقسام** | 4 (SEO, Ads/Social, Development, Content) |
| **اللغة الأساسية** | العربية (مع دعم الإنجليزية) |
| **GitHub Repository** | Staff-management |
| **استراتيجية التطوير** | MVP First |

---

## 🛠️ التقنيات المستخدمة

### Frontend

- **Framework:** Next.js 15 (App Router) + Turbopack
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **i18n:** next-intl (RTL Support)
- **Forms:** React Hook Form + Zod
- **Data Fetching:** TanStack Query (React Query)
- **Icons:** Lucide React
- **PWA:** next-pwa

### Backend

- **BaaS:** Supabase
- **Database:** PostgreSQL + Row Level Security (RLS)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **Realtime:** Supabase Realtime
- **Functions:** Supabase Edge Functions

### الخدمات الخارجية

- **Email Service:** Resend
- **File Management:** Google Drive API v3
- **Cron Jobs:** Vercel Cron / pg_cron
- **PDF Generation:** React-PDF

### النشر و DevOps

- **Frontend Hosting:** Vercel
- **Version Control:** GitHub
- **CI/CD:** Vercel Auto-deployment

---

## ✨ المميزات الأساسية

### 1️⃣ إدارة الأقسام والمشاريع

- إضافة/تعديل/حذف الأقسام
- إنشاء المشاريع داخل كل قسم
- ربط المشاريع بالعملاء
- إدارة فريق كل مشروع

### 2️⃣ نظام التاسكات المتقدم

- 3 طرق عرض: **Kanban / List / Calendar**
- Subtasks و Dependencies
- Time Tracking (متوقع/فعلي)
- Comments & Mentions (@username)
- File Attachments
- Real-time Updates

### 3️⃣ تكامل Google Drive

- OAuth Integration
- إنشاء فولدر تلقائي لكل مشروع
- رفع/تحميل الملفات من السيستم
- مزامنة الصلاحيات

### 4️⃣ نظام الإشعارات

- Email Notifications (عربي)
- In-app Notifications (Real-time)
- إعدادات مخصصة لكل مستخدم

### 5️⃣ تقييمات الأداء الآلية

- KPIs مختلفة لكل قسم
- تقييم أسبوعي تلقائي
- تقييم شهري تلقائي
- تقارير PDF تُرسل للمدير

### 6️⃣ المميزات الذكية

#### 🧠 Smart Workload Balancer

- حساب الحمل لكل موظف
- تنبيهات بصرية:
  - 🟢 أخضر (تحت 70%)
  - 🟡 أصفر (70-90%)
  - 🔴 أحمر (فوق 90%)
- اقتراحات إعادة توزيع التاسكات

#### 🌅 Daily Standup Bot

- إيميل صباحي يومي (9 ص بتوقيت القاهرة)
- يطلب من الموظف:
  - شغل أمس
  - خطة اليوم
  - أي عوائق (Blockers)
- ملخص يومي للـ Team Leader

#### 🔄 Peer Review (360°)

- تقييم شهري للزملاء
- اختيار 3 زملاء عشوائياً
- تقييمات مجهولة (اختياري)
- يؤثر على التقييم العام

#### 🏆 Gamification

- نظام نقاط:
  - تاسك في الموعد: **+10**
  - تاسك قبل الموعد: **+15**
  - تقييم Peer Review عالي: **+20**
  - Daily Standup مكتمل: **+5**
- Badges و Achievements
- Leaderboard شهري

#### 📜 Audit Log

- تسجيل كل تعديل تلقائياً (Postgres Triggers)
- مين، إمتى، إيه التغيير
- فلاتر متقدمة للبحث

#### ⏰ نوع التوظيف

- Full-time / Part-time / Freelance
- ساعات العمل الأسبوعية
- يؤثر على Workload Calculations

### 7️⃣ Mobile-First PWA

- يشتغل على الموبايل كتطبيق
- يعمل بدون إنترنت (Offline Mode الأساسي)
- Push Notifications

---

## 🔐 الأدوار والصلاحيات

### نموذج المصادقة (Authentication)

- ❌ **مفيش Public Signup**
- ✅ **Login فقط**
- ✅ الـ Admin/Team Leader هو اللي ينشئ الحسابات

### آلية إنشاء حساب جديد

1. الـ Admin/Team Leader يدخل صفحة "إدارة الموظفين"
2. يدخل بيانات الموظف (الاسم، الإيميل، القسم، الدور، نوع التوظيف)
3. السيستم يبعت إيميل دعوة بـ Magic Link أو كلمة سر مؤقتة
4. الموظف يدخل ويغير كلمة السر
5. يكمل بياناته الشخصية

### مصفوفة الصلاحيات

| الميزة | Super Admin | Team Leader | Team Member |
|--------|:-----------:|:-----------:|:-----------:|
| إدارة الأقسام | ✅ | ❌ | ❌ |
| إضافة موظفين | ✅ (الكل) | ✅ (قسمه) | ❌ |
| إنشاء مشاريع | ✅ | ✅ (قسمه) | ❌ |
| رؤية كل المشاريع | ✅ | ✅ (قسمه) | ❌ |
| رؤية المشاريع المُسنَدة | ✅ | ✅ | ✅ |
| إنشاء/حذف تاسكات | ✅ | ✅ (قسمه) | ❌ |
| تحديث تاسكاته | ✅ | ✅ | ✅ |
| رؤية التقييمات | ✅ (الكل) | ✅ (قسمه) | ✅ (نفسه) |
| Audit Log | ✅ | ❌ | ❌ |
| إعدادات النظام | ✅ | ❌ | ❌ |

### مميزات أمنية إضافية

- 🔒 **2FA** اختياري للـ Admin والـ Team Leaders
- 🔄 **Password Reset** عبر إيميل
- ⏱️ **Session Timeout** بعد فترة عدم نشاط
- 🚫 **حظر IPs** عند محاولات دخول فاشلة متكررة
- 📝 **سجل تسجيلات الدخول** في الـ Audit Log

---

## 🗄️ Database Schema

### الجداول الأساسية (Core Tables)

#### `profiles`

```
- id (UUID, PK, FK → auth.users)
- full_name (text)
- arabic_name (text)
- avatar_url (text)
- phone (text)
- employment_type (enum: full_time, part_time, freelance)
- weekly_hours (int)
- hire_date (date)
- is_active (boolean)
- created_at, updated_at
```

#### `departments`

```
- id (UUID, PK)
- name, name_ar (text)
- description (text)
- color, icon (text)
- manager_id (UUID → profiles)
- created_at, updated_at
```

#### `department_members`

```
- id (UUID, PK)
- department_id (UUID → departments)
- user_id (UUID → profiles)
- role (enum: manager, member)
- joined_at
```

#### `projects`

```
- id (UUID, PK)
- department_id (UUID → departments)
- name, name_ar (text)
- description (text)
- client_name (text)
- status (enum: planning, active, on_hold, completed, cancelled)
- priority (enum: low, medium, high, urgent)
- start_date, end_date (date)
- drive_folder_id (text)
- created_by (UUID → profiles)
- created_at, updated_at
```

#### `project_members`

```
- id (UUID, PK)
- project_id (UUID → projects)
- user_id (UUID → profiles)
- role (enum: lead, member, observer)
- assigned_at
```

### جداول التاسكات

#### `tasks`

```
- id (UUID, PK)
- project_id (UUID → projects)
- parent_task_id (UUID → tasks, nullable)
- title, description (text)
- status (enum: todo, in_progress, review, done, cancelled)
- priority (enum)
- assigned_to (UUID → profiles)
- created_by (UUID → profiles)
- estimated_hours, actual_hours (decimal)
- start_date, due_date (date)
- completed_at (timestamp)
- created_at, updated_at
```

#### `task_comments`

```
- id, task_id, user_id, content, mentions (array), created_at
```

#### `task_attachments`

```
- id, task_id, file_name, file_url, file_size, uploaded_by, created_at
```

#### `task_dependencies`

```
- id, task_id, depends_on_task_id
```

#### `time_logs`

```
- id, task_id, user_id, hours, description, logged_date
```

### جداول التكامل

#### `drive_connections`

```
- id, user_id, access_token (encrypted), refresh_token (encrypted), expires_at
```

#### `drive_folders`

```
- id, project_id, folder_id, folder_url, synced_at
```

#### `notifications`

```
- id, user_id, type, title, message, link, is_read, created_at
```

#### `notification_preferences`

```
- id, user_id
- email_task_assigned (bool)
- email_task_deadline (bool)
- email_mentions (bool)
- email_evaluations (bool)
- in_app_notifications (bool)
```

### جداول التقييم

#### `kpi_definitions`

```
- id, department_id, name, name_ar, description, unit, weight, period (weekly/monthly)
```

#### `kpi_logs`

```
- id, user_id, kpi_id, value, period_start, period_end, recorded_at
```

#### `evaluations`

```
- id, user_id, evaluator_id
- period_type (weekly/monthly)
- period_start, period_end
- total_score
- kpi_scores (jsonb)
- notes
- status (draft/finalized/sent)
- generated_at
```

#### `peer_reviews`

```
- id, reviewer_id, reviewee_id
- period_start, period_end
- ratings (jsonb)
- comments (text)
- is_anonymous (bool)
- created_at
```

#### `standup_responses`

```
- id, user_id, date
- yesterday_work (text)
- today_plan (text)
- blockers (text)
- mood (enum)
- submitted_at
```

### جداول إضافية

#### `points_log`

```
- id, user_id, points, reason, source_type, source_id, created_at
```

#### `badges`

```
- id, name, name_ar, description, icon, criteria (jsonb)
```

#### `user_badges`

```
- id, user_id, badge_id, earned_at
```

#### `audit_logs`

```
- id, user_id, action, entity_type, entity_id
- changes (jsonb)
- ip_address, user_agent
- created_at
```

**إجمالي الجداول: 22 جدول**

---

## 📅 خريطة العمل المرحلية

### 🚀 المرحلة 0: التأسيس (3-4 أيام)

- [x] إنشاء GitHub Repository (Staff-management)
- [ ] Setup بيئة العمل المحلية (Node.js, VS Code, Git)
- [ ] إنشاء مشروع Next.js 15 + TypeScript + Tailwind
- [ ] إنشاء مشروع Supabase
- [ ] ربط Vercel + GitHub
- [ ] أول Deployment
- [ ] إعداد Resend والـ DNS
- [ ] إعداد Google Cloud Console

### 🗄️ المرحلة 1: قاعدة البيانات و RLS (أسبوع)

- [ ] إنشاء كل الـ Tables (22 جدول)
- [ ] كتابة RLS Policies
- [ ] Postgres Functions للـ Audit Log Triggers
- [ ] توليد TypeScript types من Supabase
- [ ] بيانات تجريبية (Seed Data) للاختبار

### 👤 المرحلة 2: المصادقة وإدارة الموظفين (أسبوع)

- [ ] صفحة Login
- [ ] نظام دعوات بالإيميل
- [ ] صفحة Profile (مع نوع التوظيف)
- [ ] صفحة إدارة الموظفين
- [ ] نظام تعطيل/تفعيل الحساب
- [ ] Password Reset Flow
- [ ] 2FA للـ Admins

### 🏢 المرحلة 3: الأقسام والمشاريع (أسبوع)

- [ ] CRUD الأقسام
- [ ] تعيين Team Leaders
- [ ] CRUD المشاريع
- [ ] تعيين الموظفين للمشاريع
- [ ] صفحة تفاصيل المشروع

### 📝 المرحلة 4: نظام التاسكات (أسبوعين)

- [ ] CRUD التاسكات
- [ ] Kanban Board
- [ ] List View
- [ ] Calendar View
- [ ] Subtasks
- [ ] Dependencies
- [ ] Comments & Mentions
- [ ] File Attachments
- [ ] Real-time Updates

### 📁 المرحلة 5: Google Drive Integration (أسبوع)

- [ ] OAuth Flow
- [ ] Auto-create فولدرات للمشاريع
- [ ] رفع/تحميل الملفات
- [ ] مزامنة الصلاحيات

### 🔔 المرحلة 6: الإشعارات (5 أيام)

- [ ] Email Templates عربية
- [ ] Email Triggers
- [ ] In-app Notifications (Real-time)
- [ ] Notification Preferences

> **🎯 نقطة MVP:** بعد المرحلة 6 يمكن إطلاق نسخة أولية للفريق للاستخدام

### 🧠 المرحلة 7: المميزات الذكية (أسبوع ونصف)

- [ ] Smart Workload Balancer
- [ ] Daily Standup Bot
- [ ] Audit Log System

### 📊 المرحلة 8: التقييمات والتقارير (أسبوعين)

- [ ] KPIs لكل قسم
- [ ] Weekly Evaluations (Cron Job)
- [ ] Monthly Evaluations (Cron Job)
- [ ] Peer Review System
- [ ] PDF Reports Generation
- [ ] Analytics Dashboard

### 🏆 المرحلة 9: Gamification (5 أيام)

- [ ] Points System
- [ ] Badges
- [ ] Leaderboard
- [ ] Achievement Triggers

### 📱 المرحلة 10: PWA والتشطيب (أسبوع)

- [ ] PWA Configuration
- [ ] Mobile Optimization
- [ ] Performance Tuning
- [ ] User Documentation (دليل استخدام بالعربي)
- [ ] Final Testing

### ⏱️ إجمالي الوقت المتوقع

| السيناريو | المدة |
|-----------|------|
| Full-time (40 ساعة/أسبوع) | **12-14 أسبوع** |
| Part-time (20 ساعة/أسبوع) | **22-26 أسبوع** |
| Side project (10 ساعات/أسبوع) | **40+ أسبوع** |

---

## 📈 مؤشرات الأداء (KPIs)

### قسم SEO

- عدد المقالات المنشورة
- عدد الكلمات المفتاحية اللي رنكت
- عدد الباك لينكس المُحقَّقة
- تحسين سرعة المواقع
- تنفيذ Schema markup
- Internal/External SEO Audits

### قسم Ads / Social Media

- عدد الحملات المُشغَّلة
- متوسط CTR (Click-Through Rate)
- ROAS (Return on Ad Spend)
- عدد البوستات المنشورة
- Engagement Rate
- نمو المتابعين

### قسم Development

- عدد التاسكات المُنجَزة
- عدد الـ Deployments
- عدد الـ Bugs المُصلَحة
- Code Reviews
- Documentation
- Uptime Maintenance

### قسم Content

- عدد الكلمات المكتوبة
- عدد المقالات المُسلَّمة في الموعد
- Approval Rate
- جودة المحتوى (تقييم Team Leader)
- التزام بالـ SEO Guidelines

---

## 💰 التكاليف المتوقعة

### المرحلة الأولى (Free Tier) 🆓

| الخدمة | التكلفة |
|--------|---------|
| Supabase Free | $0 |
| Vercel Hobby | $0 |
| Resend Free (100 إيميل/يوم) | $0 |
| Google Drive API | $0 |
| **الإجمالي** | **$0/شهر** |

### مرحلة النمو (Production) 💼

| الخدمة | التكلفة |
|--------|---------|
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Resend Pro (50K إيميل) | $20 |
| Google Drive API | $0 |
| **الإجمالي** | **~$65/شهر** |

---

## ⚠️ ملاحظات تقنية

### 1. Google Drive Setup

- إنشاء Google Cloud Project
- تفعيل Drive API
- إنشاء OAuth Credentials
- مرحلة الـ Testing أولاً، Verification لاحقاً

### 2. DNS للإيميلات (Resend)

- ضبط **SPF Records**
- ضبط **DKIM**
- ضبط **DMARC**
- إثبات ملكية الـ Domain في Resend

### 3. Timezone

- **التخزين:** UTC
- **العرض:** Africa/Cairo (UTC+2)

### 4. اللغة

- الـ UI والـ Emails: **عربي**
- الـ DB Columns: **إنجليزي** (Best Practice)

### 5. النسخ الاحتياطي

- **Supabase Pro:** Point-in-Time Recovery تلقائي
- **Export أسبوعي يدوي** للأمان الإضافي

### 6. الأمان

- كل الـ Secrets في **Vercel Environment Variables**
- مفيش API Keys في الكود أبداً
- **RLS Policies** على كل جدول
- **HTTPS** فقط
- **Rate Limiting** على الـ APIs

### 7. المتصفحات المدعومة

- Chrome / Edge (Chromium): آخر إصدارين
- Firefox: آخر إصدارين
- Safari: آخر إصدارين
- موبايل: iOS Safari 14+, Chrome Android

---

## 🔄 Git Workflow

### استراتيجية الفروع

```
main      ← Production (Auto-deploy to Live URL)
  ↑
dev       ← Staging (Auto-deploy to Preview URL)
  ↑
feature/* ← Feature Branches
```

### النشاط اليومي

1. تشتغل على **Feature Branch** من `dev`
2. تـ **Push** للـ GitHub
3. **Pull Request** إلى `dev`
4. اختبار على **Preview URL**
5. **Merge** إلى `main` بعد التأكد
6. **Production Deploy** تلقائي

### Best Practices

- ✅ Commit بانتظام (Commits صغيرة وواضحة)
- ✅ اكتب رسائل Commits بالإنجليزي
- ✅ اعمل Branch لكل ميزة جديدة
- ✅ راجع الـ Code قبل الـ Merge
- ✅ Document الـ Code المعقد
- ✅ Backup أسبوعي لـ Supabase
- ✅ راقب الـ Errors عبر Vercel Analytics

---

## 🎯 الخطوات الحالية

### ✅ المُنجَز

1. تحديد الـ Scope والمتطلبات
2. اختيار التقنيات والمعمارية
3. إنشاء GitHub Repository
4. وضع خريطة العمل التفصيلية

### 🔄 المرحلة الحالية

1. Setup بيئة العمل المحلية
2. إنشاء مشروع Next.js
3. أول Push للـ GitHub
4. ربط Supabase
5. ربط Vercel وأول Deployment

### ⏭️ القادم

1. تصميم Database Schema تفصيلي
2. كتابة RLS Policies
3. توليد TypeScript Types
4. بناء نظام Auth

---

## 📞 ملاحظات نهائية

> **استراتيجية MVP First:**
> هنبني الأساسيات الأول (المراحل 0-6) عشان الفريق يبدأ يستخدم السيستم في 6-7 أسابيع، نجمع feedback، وبعدين نضيف المميزات الذكية (المراحل 7-10).

> **الأولوية في كل مرحلة:**
> 1. الوظيفة الأساسية تشتغل صح
> 2. الـ UX سلس وبسيط
> 3. الأمان والصلاحيات محكمة
> 4. الأداء سريع

---

**المطور:** أحمد الجمل
**الشركة:** Everest Ads
**Repository:** Staff-management (private)
**آخر تحديث:** 28 مايو 2026
