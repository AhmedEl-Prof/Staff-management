# تشغيل السيستم على استضافة cPanel (بدل Vercel)

دليل خطوة بخطوة لنشر **Staff-management** (Next.js 16) على استضافة cPanel
بتدعم **Node.js** عن طريق فيتشر *Setup Node.js App* (Phusion Passenger).

> ملاحظة مهمة: لازم الاستضافة تدعم Node.js 20+. لو الباقة شيرد عادية بـ PHP
> بس ومفيهاش "Setup Node.js App" — السيستم **مش هيشتغل** عليها، ولازم VPS أو
> باقة Node.

---

## 0) الخدمات الخارجية (متتغيرش)

دي خدمات سحابية مستقلة، بتفضل زي ما هي مهما كانت الاستضافة:

- **Supabase** — قاعدة البيانات والـ Auth والتخزين. اعمل المشروع وطبّق
  الـ migrations زي ما في `supabase/README.md`.
- **Resend** — الإيميلات.
- **Google Drive** — اختياري (الـ OAuth).

إنت بتنقل **التطبيق نفسه** بس من Vercel للاستضافة، مش الداتابيز.

---

## 1) المتطلبات على cPanel

- Node.js **20** أو أحدث (من *Setup Node.js App*).
- وصول لـ **Terminal** أو زرار *Run NPM script* (عشان `install` و `build`).
- صلاحية إضافة **Cron Jobs** (موجودة في أغلب الباقات).

---

## 2) ارفع الكود

ارفع المشروع كله لمجلد على الاستضافة، مثلاً:

```
/home/USER/staff-management
```

تقدر ترفعه بـ Git (لو الاستضافة بتدعم) أو ZIP من File Manager.
**متترفعش** مجلد `node_modules` ولا `.next` — هيتولّدوا على السيرفر.

---

## 3) اعمل التطبيق في "Setup Node.js App"

من cPanel → **Setup Node.js App** → *Create Application*:

| الحقل | القيمة |
|------|--------|
| Node.js version | 20.x (أو أحدث) |
| Application mode | **Production** |
| Application root | `staff-management` (المجلد اللي رفعته فيه) |
| Application URL | الدومين/السب-دومين بتاعك |
| Application startup file | `server.js` |

دوس **Create**. (الملف `server.js` موجود جاهز في المشروع — هو نقطة التشغيل
الخاصة بـ Passenger.)

---

## 4) متغيرات البيئة (Environment variables)

من نفس صفحة التطبيق، أضف المتغيرات دي (نفس اللي في `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
RESEND_FROM=Deep Entry <noreply@yourdomain.com>
CRON_SECRET=<نص عشوائي طويل>
DRIVE_TOKEN_ENCRYPTION_KEY=<32 bytes base64>
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
# Google Drive (اختياري)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/drive/callback
# Web Push (اختياري)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

> مهم: `NEXT_PUBLIC_APP_URL` لازم يبقى دومينك الفعلي عشان الروابط في
> الإيميلات والـ OAuth تشتغل صح.

---

## 5) نصّب وابني (مرة واحدة، وكل ما تحدّث الكود)

من *Setup Node.js App*، انسخ سطر **"Enter to the virtual environment"** وشغّله
في الـ Terminal، وبعدها:

```bash
npm install
npm run build
```

`npm run build` بيطلّع مجلد `.next` (نسخة الإنتاج). لازم يخلص بنجاح قبل ما
تشغّل التطبيق.

---

## 6) شغّل / أعد التشغيل

ارجع لصفحة التطبيق ودوس **Restart**. افتح دومينك — المفروض تلاقي صفحة
الدخول `/login`.

> أي تحديث للكود بعد كده: `git pull` (أو ارفع الملفات) → `npm install` (لو فيه
> dependencies جديدة) → `npm run build` → **Restart**.

---

## 7) الـ Cron jobs (بديل vercel.json)

الـ `vercel.json` مبيشتغلش بره Vercel. بنستبدله بـ **Cron Jobs** في cPanel
اللي بتضرب الـ endpoints بنفس الـ `CRON_SECRET`.

من cPanel → **Cron Jobs**، أضف اتنين:

**1) تذكير الستاندب — يومياً 9 صباحاً بتوقيت القاهرة (7:00 UTC):**

```
0 7 * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/cron/standup-reminder >/dev/null 2>&1
```

**2) التقييمات الشهرية — أول كل شهر 6:00 UTC:**

```
0 6 1 * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/cron/monthly-evaluations >/dev/null 2>&1
```

- بدّل `YOUR_CRON_SECRET` بنفس قيمة `CRON_SECRET` في متغيرات البيئة.
- بدّل `yourdomain.com` بدومينك.
- توقيت cPanel Cron غالباً **UTC**؛ المواعيد فوق مظبوطة على ده.

> بديل لو الاستضافة مفيهاش Cron مرن: استخدم خدمة مجانية زي
> **cron-job.org** أو **EasyCron** — تحط فيها نفس الرابط والـ Header
> ونفس المواعيد.

---

## 8) ملاحظات مهمة

- **Realtime** (تحديثات الكانبان اللحظية): شغّال من Supabase نفسه، مش محتاج
  حاجة من الاستضافة — بس محتاج Supabase باقة بتدعمه.
- **HTTPS**: فعّل SSL للدومين (AutoSSL في cPanel) — مطلوب للـ PWA والإشعارات
  والـ Service Worker.
- **الذاكرة**: الـ build بتاع Next ممكن يحتاج RAM؛ لو الباقة ضعيفة وفشل الـ
  build، ابنيه محلياً وارفع مجلد `.next` جاهز.
- **DNS للإيميل**: اضبط SPF/DKIM/DMARC لدومين Resend عشان الإيميلات توصل.

---

## مقارنة سريعة بـ Vercel

| الحاجة | Vercel | cPanel Node |
|--------|--------|-------------|
| النشر | تلقائي مع git push | يدوي: install + build + restart |
| الـ Cron | `vercel.json` | cPanel Cron / cron-job.org |
| الـ Process | مُدار تلقائياً | Passenger عبر `server.js` |
| HTTPS | تلقائي | AutoSSL |
| الداتابيز | Supabase (نفسها) | Supabase (نفسها) |
