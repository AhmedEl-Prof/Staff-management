# Staff-management

Internal staff management system for **Everest Ads** — مبني بـ Next.js 16 و Supabase.

> - الخطة الكاملة (المعمارية، الـ schema، المراحل): [`docs/ROADMAP.md`](./docs/ROADMAP.md)
> - دليل الاستخدام بالعربي: [`docs/USER_GUIDE_AR.md`](./docs/USER_GUIDE_AR.md)

## التقنيات

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (RTL / عربي)
- **Supabase** (Auth + Postgres + RLS + Storage + Realtime)
- **next-intl** (عربي افتراضي، مع إنجليزي)
- **TanStack Query**، **React Hook Form** + **Zod**
- **Resend** (إيميل)، **Google Drive API**، **PWA**

## المميزات

- 🔐 مصادقة بدون تسجيل عام + دعوات بالإيميل + إعادة تعيين كلمة السر
- 🏢 إدارة الأقسام والمشاريع وفرق العمل (مع RLS كامل)
- 📝 تاسكات: Kanban / قائمة، مهام فرعية، اعتماديات، تعليقات + منشن، مرفقات، تحديثات لحظية
- 📁 تكامل Google Drive (فولدر تلقائي لكل مشروع + مزامنة صلاحيات)
- 🔔 إشعارات داخل التطبيق + إيميل، مع تفضيلات لكل مستخدم
- 🧠 موازن حمل العمل + بوت الستاندب اليومي + سجل التغييرات
- 📊 مؤشرات أداء + تقييمات (أسبوعي/شهري) + تقارير PDF + تحليلات
- 🤝 تقييم الزملاء السلوكي (360°)
- 🏆 نقاط + أوسمة + لوحة صدارة
- 📱 PWA يعمل على الموبايل مع وضع offline

## التشغيل محلياً

```bash
# 1. نصب الـ dependencies
npm install

# 2. انسخ ملف البيئة واملأ مفاتيح Supabase
cp .env.example .env.local

# 3. شغّل التطوير
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000). أي صفحة محمية بتحوّل لـ `/login`
طالما مفيش جلسة (مفيش تسجيل عام — الحسابات بينشئها المدير).

## أوامر مفيدة

| الأمر | الوظيفة |
|------|---------|
| `npm run dev` | خادم التطوير |
| `npm run build` | بناء الإنتاج |
| `npm run lint` | فحص ESLint |
| `npm run typecheck` | فحص أنواع TypeScript |

## بنية المشروع

```
src/
├── app/                # صفحات App Router
│   ├── (app)/          # الصفحات المحمية (dashboard, projects, tasks, …)
│   └── api/            # OAuth + cron endpoints
├── components/         # مكونات الواجهة (ui/ = shadcn)
├── i18n/               # إعداد next-intl
├── lib/                # المنطق (supabase clients, gamification, evaluations, …)
└── types/              # أنواع قاعدة البيانات
messages/               # ترجمات (ar.json / en.json)
supabase/migrations/    # 12 migration (schema + RLS + triggers + storage)
public/                 # PWA: manifest, sw.js, offline.html, icons
```

## النشر (Production)

1. **Supabase:** أنشئ مشروع، طبّق `supabase/migrations/*.sql` بالترتيب ثم `seed.sql`
   (راجع [`supabase/README.md`](./supabase/README.md)).
2. **Vercel:** اربط الريبو واملأ متغيرات البيئة (راجع `.env.example`):
   مفاتيح Supabase، `SUPABASE_SERVICE_ROLE_KEY`، `RESEND_API_KEY`،
   `DRIVE_TOKEN_ENCRYPTION_KEY`، `GOOGLE_CLIENT_*`، `CRON_SECRET`، `NEXT_PUBLIC_APP_URL`.
3. **Cron:** الـ `vercel.json` بيجدول تذكير الستاندب (يومي) والتقييمات الشهرية.
4. **DNS:** اضبط SPF/DKIM/DMARC لدومين Resend.

> ملاحظة: الـ Realtime والنسخ الاحتياطي التلقائي محتاجين Supabase Pro.
