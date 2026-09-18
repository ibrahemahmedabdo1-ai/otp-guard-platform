# OTP Guard Platform

منصة تحقق من العملاء (Customer Verification Platform) عن طريق **واتساب / SMS / إيميل**، مكوّنة من ٣ بوابات:
عميل (Client) — دعم (Support) — أدمن (Admin).

---

## 1) الفكرة العامة

- **العميل (صاحب الشركة):** يسجل حساب، يشوف داشبورد خاص بيه بس، يشحن باكدجات (واتساب/SMS/إيميل/مجمع)،
  عنده ٣ رسائل اختبار مجانية لكل قناة (يتحكم فيها الأدمن)، يشوف سجل العملاء اللي اتحقق منهم،
  ويكلم الدعم (شات + رفع ملفات).
- **الدعم (Support):** يشوف بيانات كل عميل **للقراءة فقط** (مفيش تعديل خالص)، عنده زرار **"اكتشاف الأخطاء"**
  يطلعله الأعطال المحتملة، ويكلم العميل (شات + ملفات) وكمان يكلم الأدمن. يقدر يقترح تعديل رسالة OTP
  لكنها لازم تاخد موافقة الأدمن.
- **الأدمن:** يتحكم في كل حاجة: يضيف/يحذف أي مستخدم (عميل/دعم/أدمن)، يفتح/يقفل خدمات العميل ويخليها مجانية
  أو مدفوعة، يتحكم في رسائل الاختبار المجانية للعميل (زيادة/نقصان/قفل)، يعتمد أو يرفض تعديلات رسائل الـ OTP،
  يربط واتساب عبر QR، يدير الباكدجات والتسعير لكل قناة على حدة، يدير الـ ٣ لغات، وعنده زرار
  **"اكتشاف الأخطاء"** على مستوى النظام كله مع إصلاحات سريعة بضغطة زر.

**مفيش أي حاجة "ثابتة" (hardcoded) في واجهة العميل أو الدعم** — كل النصوص، اللغات، الأسعار، القوالب،
والصلاحيات بيتحكم فيها الأدمن من لوحته.

---

## 2) هيكل المشروع

```
otp-guard/
├── api/index.js         ← نقطة الدخول لـ Vercel (Serverless Function)
├── vercel.json           ← إعدادات نشر Vercel
├── src/
│   ├── app.js             ← تطبيق Express (بدون listen) — يُستخدم محليًا وعلى Vercel
│   ├── server.js          ← تشغيل محلي فقط (node src/server.js)
│   ├── routes/            ← auth / client / support / admin / common
│   ├── middleware/auth.js ← JWT + التحقق من الدور (role)
│   └── utils/
│       ├── db.js           ← طبقة تخزين (Postgres/Neon أو ملف JSON محلي كبديل)
│       ├── geo.js          ← تحديد الدولة/اللغة/العملة من الـ IP
│       ├── sms.js          ← إرسال عبر Twilio / IMS / SMTP
│       ├── whatsapp.js     ← ربط واتساب عبر QR (Stub قابل للاستبدال بـ whatsapp-web.js)
│       └── seed.js         ← إنشاء أول حساب أدمن + سبورت
├── public/                ← الفرونت إند (HTML/CSS/JS عادي، بدون build step)
│   ├── index.html, login.html, register.html, pricing.html
│   ├── client/dashboard.html   support/dashboard.html   admin/dashboard.html
│   └── assets/{css,js,img}/
└── .env.example
```

---

## 3) التشغيل محليًا

```bash
npm install
cp .env.example .env      # عدّل القيم حسب الحاجة
npm run seed               # يجهز أول حساب أدمن وحساب سبورت
npm start                  # يفتح على http://localhost:3000
```

**حسابات تجريبية بعد الـ seed:**
- أدمن: `admin@otpguard.com` / `Admin@12345`
- سبورت: `support@otpguard.com` / `Support@12345`
- أي عميل يسجل نفسه من `/register.html`

بدون `DATABASE_URL` في `.env`، البيانات بتتخزن محليًا في `data/db.json` (مفيد للتجربة السريعة بس مش
مناسب للإنتاج أو Vercel لأن الملفات المحلية بتتمسح مع كل تشغيل serverless).

---

## 4) الربط مع Neon.tech (Postgres) و Vercel — استبدال مشروعك الحالي

بما إن عندك مشروع تاني مرفوع على GitHub ومربوط بـ Vercel و Neon، اتبع الخطوات دي:

### أ) إنشاء قاعدة بيانات Neon
1. من [neon.tech](https://neon.tech) افتح المشروع الموجود عندك (أو أنشئ واحد جديد).
2. انسخ الـ **Connection String** (شكله: `postgresql://user:pass@ep-xxxx.neon.tech/dbname?sslmode=require`).
3. حطه في `.env` كـ `DATABASE_URL` (وفي إعدادات Environment Variables على Vercel كمان).

المشروع بيخزن كل البيانات في **جدول واحد بعمود JSONB** (`app_state`) — بيتعمل تلقائيًا أول ما السيرفر
يشتغل، فمش محتاج تعمل migrations يدوي. ده اختيار عملي عشان يشتغل فورًا على Vercel بدون ORM؛ لو حبيت
توسّع المشروع لاحقًا وتحوّله لجداول منفصلة (users, tickets, ...) الكود منظم بشكل يسهل فصله تدريجيًا.

### ب) استبدال المشروع القديم على GitHub
```bash
# داخل فولدر otp-guard بعد فك الضغط
git init
git remote add origin <رابط الريبو الحالي بتاعك>
git add .
git commit -m "Replace project with OTP Guard Platform"
git push -f origin main    # -f لأنك بتستبدل المحتوى القديم بالكامل
```

### ج) على Vercel
1. المشروع (أو الريبو) هيتعرف تلقائيًا إن فيه `vercel.json` و `api/index.js`.
2. من **Settings → Environment Variables** ضيف:
   - `DATABASE_URL` (من Neon)
   - `JWT_SECRET`, `SESSION_SECRET`
   - مفاتيح Twilio / IMS / SMTP لو جاهزة (اختياري، تقدر تضيفها بعدين)
3. اعمل Deploy. أول ما السيرفر يشتغل، الجدول بيتعمل تلقائيًا لكنه هيكون فاضي — شغّل التزويد مرة واحدة
   محليًا وأنت واصل بنفس الـ `DATABASE_URL`:
   ```bash
   DATABASE_URL="postgresql://..." npm run seed
   ```
   ده هيحط حساب الأدمن الأول مباشرة في قاعدة بيانات Neon نفسها اللي هيستخدمها الموقع على Vercel.

> **ملاحظة عن رفع الملفات (تذاكر الدعم):** حاليًا الملفات بتتخزن في `public/uploads` عبر multer، وده
> بيشتغل تمام محليًا لكن **مش هيفضل موجود على Vercel** لأن الـ serverless functions مالهاش قرص دائم.
> للإنتاج الحقيقي على Vercel، وصّل خدمة تخزين خارجية زي **Vercel Blob** أو **Cloudinary** أو **S3** بدل
> multer المحلي — الكود في `src/routes/client.js` و `support.js` (نقطة `upload.single("file")`) هو
> المكان اللي تستبدل فيه الـ storage adapter.

---

## 5) ربط قنوات الإرسال الفعلية

### Twilio (SMS + WhatsApp)
1. سجل في [twilio.com](https://www.twilio.com) واحصل على `Account SID` و `Auth Token`.
2. لـ SMS: اشترِ رقم Twilio وحطه في `TWILIO_SMS_FROM`.
3. لواتساب: فعّل WhatsApp Sandbox أو رقم WhatsApp Business معتمد، وحط الرقم في `TWILIO_WHATSAPP_FROM`
   بصيغة `whatsapp:+1415...`.
4. الكود جاهز في `src/utils/sms.js` (`sendViaTwilioSms` / `sendViaTwilioWhatsapp`).

### IMS / أي بوابة SMS محلية (مثل Unifonic, Msegat, Vonage...)
- حط `IMS_API_URL` و `IMS_API_KEY` و `IMS_SENDER_NAME` في `.env`.
- لو الـ API بتاع البوابة اللي هتستخدمها شكله مختلف عن اللي في `sendViaImsSms`، عدّل الدالة دي بس —
  باقي المشروع مش هيتأثر.

### البريد الإلكتروني (SMTP)
- أي مزود SMTP (Gmail App Password, SendGrid, Mailgun...) — حط `SMTP_HOST/PORT/USER/PASS/FROM`.

### واتساب عبر QR
- الوضع الحالي في `src/utils/whatsapp.js` هو **Stub توضيحي** (يولّد QR شكلي ويحاكي حالة الربط).
- للربط الحقيقي: ثبّت `whatsapp-web.js` (`npm i whatsapp-web.js qrcode-terminal`) واستبدل
  `generateConnectQr` بمنطق حقيقي بيسمع لحدث الـ `qr` وحدث `ready` من المكتبة، ويحدّث
  `settings.whatsappConnected` تلقائيًا. البديل الرسمي المدعوم من Meta هو **WhatsApp Cloud API**
  (بيتطلب رقم موافق عليه من Meta Business، مفيش فيه ربط QR من رقم شخصي).

---

## 6) الأسعار والباكدجات

- كل قناة (واتساب / SMS / إيميل) ليها تسعير مستقل بالكامل: سعر الرسالة الواحدة، وسعر كل ١٠، وكل ١٠٠،
  وهكذا — تتعدل من لوحة الأدمن (تبويب "التسعير") وتظهر تلقائيًا في `/pricing.html`.
- الباكدجات (تبويب "الباكدجات") منفصلة برضه لكل قناة، بالإضافة لباكدجات "مجمعة" (bundle) تشتغل على
  كل القنوات.

---

## 7) اللغات (٣ أنظمة)

- عربي / إنجليزي / فرنسي — مخزّنين في قاعدة البيانات (مش ملفات) عشان يشتغلوا على Vercel من غير مشاكل
  كتابة على القرص.
- اللغة الافتراضية بتتحدد تلقائيًا حسب الدولة اللي الطلب جاي منها (IP)، والمستخدم يقدر يغيّرها يدويًا
  من القائمة أعلى كل صفحة (بيتم حفظها في `localStorage`).
- الأدمن يقدر يعدّل نصوص أي لغة من تبويب "اللغات".

---

## 8) اللوجو

لوجو SVG احترافي (`public/assets/img/logo.svg`) — درع بعلامة صح (رمز التحقق) + نقاط متدرجة ترمز لتعدد
قنوات الإرسال (واتساب/SMS/إيميل)، بخط عصري وألوان تركواز/كحلي تدل على الثقة والأمان.

---

## 9) نقاط أمان مهمة قبل الإنتاج الفعلي

- غيّر `JWT_SECRET` و `SESSION_SECRET` لقيم عشوائية طويلة.
- التسجيل العام (`/register.html`) بيعمل حسابات "عميل" بس. حسابات الدعم/الأدمن بتتعمل من لوحة الأدمن فقط.
- طبقة التخزين الحالية (JSONB في صف واحد) بسيطة ومناسبة للبداية والتجربة والإطلاق الأول؛ مع نمو عدد
  العملاء يُفضّل تقسيمها لجداول Postgres منفصلة (users, tickets, verifications...) لتحسين الأداء
  والفهرسة (indexing).
- فعّل HTTPS (Vercel بيوفره تلقائيًا) وتأكد إن كل مفاتيح Twilio/SMTP متخزنة كمتغيرات بيئة وليس بالكود.
