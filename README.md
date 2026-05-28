# Staff-management

Internal staff management system for **Everest Ads** — مبني بـ Next.js 16 و Supabase.

> الخطة الكاملة (المعمارية، الـ schema، المراحل): [`docs/ROADMAP.md`](./docs/ROADMAP.md)

## التقنيات

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (RTL / عربي)
- **Supabase** (Auth + Postgres + RLS)
- **next-intl** (عربي افتراضي، مع إنجليزي)
- **TanStack Query**، **React Hook Form** + **Zod**

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
├── app/                # صفحات App Router (login, dashboard)
├── components/         # مكونات الواجهة (ui/ = shadcn)
├── i18n/               # إعداد next-intl
├── lib/supabase/       # عملاء Supabase (browser/server/middleware)
└── types/              # أنواع قاعدة البيانات (تُولّد من Supabase)
messages/               # ترجمات (ar.json / en.json)
```
