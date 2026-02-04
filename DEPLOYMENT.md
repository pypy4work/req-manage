# دليل النشر على Supabase (Postgres) + Netlify (Frontend)

هذا الدليل يشرح كيفية نشر التطبيق على:
- **Supabase**: قاعدة بيانات Postgres + Backend API (اختياري)
- **Netlify**: Frontend (React + Vite)

---

## 📋 المتطلبات

1. حساب على [Supabase](https://supabase.com) (مجاني)
2. حساب على [Netlify](https://netlify.com) (مجاني)
3. حساب على [GitHub](https://github.com) (لربط الكود)

---

## 🗄️ خطوة 1: إعداد Supabase (Postgres)

### 1.1 إنشاء مشروع جديد في Supabase

1. اذهب إلى [Supabase Dashboard](https://app.supabase.com)
2. اضغط "New Project"
3. املأ البيانات:
   - **Name**: `sca-requests`
   - **Database Password**: اختر كلمة مرور قوية (احفظها!)
   - **Region**: اختر أقرب منطقة (مثلاً `Europe West`)
4. انتظر حتى يتم إنشاء المشروع (~2 دقيقة)

### 1.2 تشغيل سكربت Schema

1. في Supabase Dashboard، اذهب إلى **SQL Editor**
2. انسخ محتوى ملف `scripts/create_schema_postgres.sql`
3. الصقه في SQL Editor واضغط **Run**
4. تأكد من ظهور رسالة نجاح

### 1.3 الحصول على بيانات الاتصال

من Supabase Dashboard → **Settings** → **Database**:

- **Connection string**: سيكون مثل:
  ```
  postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
  ```
- أو استخدم المتغيرات المنفصلة:
  - **Host**: `db.[PROJECT-REF].supabase.co`
  - **Port**: `5432`
  - **Database**: `postgres`
  - **User**: `postgres`
  - **Password**: (كلمة المرور التي اخترتها)

---

## 🚀 خطوة 2: نشر Backend على Render / Railway / Netlify Functions

### خيار أ: Render (موصى به للـ Backend)

1. اذهب إلى [Render](https://render.com) وأنشئ حساب
2. اضغط **New** → **Web Service**
3. اربط مستودع GitHub الخاص بك (`pypy4work/req-manage`)
4. الإعدادات:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
   - **Environment Variables**:
     ```
     DB_DIALECT=postgres
     POSTGRES_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
     PORT=4000
     TRAVEL_API_PROVIDER=OSRM
     TRAVEL_API_URL=https://router.project-osrm.org/route/v1/driving
     TRAVEL_API_KEY=
     ```
5. اضغط **Create Web Service**
6. بعد النشر، ستحصل على URL مثل: `https://sca-backend.onrender.com`

### خيار ب: Railway

1. اذهب إلى [Railway](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. اختر المستودع
4. في **Settings** → **Variables**:
   ```
   DB_DIALECT=postgres
   POSTGRES_URL=[من Supabase]
   PORT=4000
   ```
5. Railway سينشر تلقائياً ويعطيك URL

### خيار ج: Netlify Functions (موصى به لو أردت Backend داخل Netlify)

تم تجهيز المشروع ليعمل كـ Netlify Functions بشكل صحيح:

1. مجلد الدوال: `netlify/functions`
2. ملف الدالة الرئيسي: `netlify/functions/api.js`
3. كود الـ API موجود في: `netlify/functions/src`
4. يوجد Redirect يوجّه `/api/*` إلى الدالة تلقائياً (في `netlify.toml` و `public/_redirects`)

> النتيجة: يمكنك استدعاء الـ API من الواجهة باستخدام المسار `/api/...` بدون كتابة مسار Functions الكامل.

**Environment Variables المطلوبة للـ Functions (داخل Netlify):**
```
DB_DIALECT=postgres
POSTGRES_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
FRONTEND_URL=https://your-site.netlify.app
TRAVEL_API_PROVIDER=OSRM
TRAVEL_API_URL=https://router.project-osrm.org/route/v1/driving
TRAVEL_API_KEY=
```

---

## 🌐 خطوة 3: نشر Frontend على Netlify

### 3.1 رفع الكود على GitHub

```bash
cd c:\Users\diva4\OneDrive\Desktop\sca-requests-management-system
git init
git add .
git commit -m "Initial commit for deployment"
git branch -M main
git remote add origin https://github.com/pypy4work/req-manage.git
git push -u origin main
```

### 3.2 ربط Netlify مع GitHub

1. اذهب إلى [Netlify Dashboard](https://app.netlify.com)
2. اضغط **Add new site** → **Import an existing project**
3. اختر **GitHub** واذهب إلى المستودع `pypy4work/req-manage`
4. الإعدادات:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Base directory**: (اتركه فارغاً)

### 3.3 إعداد Environment Variables في Netlify

في Netlify Dashboard → **Site settings** → **Environment variables**:

```
VITE_BACKEND_URL=/api
```

(لو كنت تستخدم Render/Railway بدل Netlify Functions، ضع رابط الـ Backend الكامل)

### 3.4 Deploy

- Netlify سيبني ويشغل الموقع تلقائياً
- ستحصل على URL مثل: `https://sca-requests.netlify.app`

---

## ✅ التحقق من النشر

### 1. Frontend
- افتح `https://your-site.netlify.app`
- يجب أن ترى صفحة تسجيل الدخول

### 2. Backend
- افتح `https://your-backend.onrender.com/health`
- يجب أن ترى: `{"status":"ok"}`

### 3. Database
- في Supabase Dashboard → **Table Editor**
- تأكد من وجود الجداول: `sca.users`, `sca.requests`, إلخ

---

## 🔧 استكشاف الأخطاء

### "Cannot connect to database"
- تأكد من `POSTGRES_URL` في Environment Variables صحيح
- تأكد من أن Supabase Project نشط
- تحقق من أن Password صحيح

### "CORS error"
- في Backend (`server/src/index.js`)، تأكد من:
  ```js
  app.use(cors({
    origin: ['https://your-site.netlify.app', 'http://localhost:5173']
  }));
  ```

### "VITE_BACKEND_URL not found"
- تأكد من إضافة `VITE_BACKEND_URL` في Netlify Environment Variables
- أعد بناء الموقع بعد إضافة المتغير

---

## 📝 ملاحظات مهمة

1. **كلمات المرور**: لا ترفع `.env` أو `server/.env` إلى GitHub (موجودة في `.gitignore`)
2. **Environment Variables**: ضع كل القيم الحساسة في إعدادات الاستضافة فقط
3. **SSL**: Supabase و Netlify يوفران SSL تلقائياً
4. **Backups**: Supabase يوفر backups تلقائية (في الخطة المدفوعة)

---

## 🔄 التحديثات المستقبلية

بعد أي تعديل على الكود:

```bash
git add .
git commit -m "Update description"
git push
```

- Netlify سيبني ويحدث الموقع تلقائياً
- Render/Railway سيعيد نشر Backend تلقائياً

---

## 📞 الدعم

- Supabase Docs: https://supabase.com/docs
- Netlify Docs: https://docs.netlify.com
- Render Docs: https://render.com/docs

---

**تم إنشاء هذا الدليل**: فبراير 2026  
**الإصدار**: 1.0.0
