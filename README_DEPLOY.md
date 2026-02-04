# ✅ جاهزية النشر على Supabase + Netlify

## ✅ ما تم إنجازه

### 1. دعم Postgres كامل
- ✅ تم تحويل جميع Routes لاستخدام `query()` متوافق مع Postgres و MSSQL
- ✅ تم إضافة `withTransaction()` لدعم Transactions في Postgres
- ✅ تم إنشاء `create_schema_postgres.sql` كامل
- ✅ تم إضافة `insertAndGetId()` للتعامل مع RETURNING / SCOPE_IDENTITY

### 2. Routes المحوّلة
- ✅ `auth.js` - Login
- ✅ `admin.js` - Admin lists (بدون Stored Procedures)
- ✅ `admin-extended.js` - Users, Request Types, Permissions, Transfers
- ✅ `employee.js` - My Requests, Submit Request, Transfer Requests
- ✅ `manager.js` - Pending Requests, Stats, Transfer Assessments

### 3. ملفات النشر
- ✅ `netlify.toml` - إعدادات Netlify
- ✅ `public/_redirects` - SPA routing
- ✅ `DEPLOYMENT.md` - دليل شامل للنشر

---

## 🚀 خطوات النشر السريعة

### 1. Supabase (5 دقائق)

```bash
# 1. أنشئ مشروع جديد في Supabase Dashboard
# 2. اذهب إلى SQL Editor
# 3. انسخ محتوى scripts/create_schema_postgres.sql
# 4. شغّل السكربت
# 5. احفظ Connection String من Settings → Database
```

### 2. Backend على Render (10 دقائق)

1. اذهب إلى [Render](https://render.com)
2. **New** → **Web Service**
3. اربط GitHub repo: `pypy4work/req-manage`
4. الإعدادات:
   - Root: `server`
   - Build: `npm install`
   - Start: `node src/index.js`
5. Environment Variables:
   ```
   DB_DIALECT=postgres
   POSTGRES_URL=[من Supabase]
   PORT=4000
   ```
6. Deploy → احفظ URL (مثل: `https://sca-backend.onrender.com`)

### 3. Frontend على Netlify (5 دقائق)

1. اذهب إلى [Netlify](https://netlify.com)
2. **Add site** → **Import from GitHub**
3. اختر المستودع
4. Build settings:
   - Build command: `npm run build`
   - Publish: `dist`
5. Environment Variables:
   ```
   VITE_BACKEND_URL=https://sca-backend.onrender.com
   ```
6. Deploy → احفظ URL (مثل: `https://sca-requests.netlify.app`)

---

## ✅ التحقق من النشر

### Frontend
- افتح `https://your-site.netlify.app`
- يجب أن ترى صفحة تسجيل الدخول

### Backend
- افتح `https://your-backend.onrender.com/health`
- يجب أن ترى: `{"status":"ok"}`

### Database
- في Supabase → Table Editor
- تأكد من وجود `sca.users`, `sca.requests`, إلخ

---

## 🔧 استكشاف الأخطاء

### "Cannot connect to database"
- تحقق من `POSTGRES_URL` في Render Environment Variables
- تأكد من أن Supabase Project نشط
- تحقق من Password

### "CORS error"
- في `server/src/index.js`، أضف:
  ```js
  app.use(cors({
    origin: ['https://your-site.netlify.app', 'http://localhost:5173']
  }));
  ```

### "VITE_BACKEND_URL not found"
- أضف `VITE_BACKEND_URL` في Netlify Environment Variables
- أعد بناء الموقع

---

## 📝 ملاحظات مهمة

1. ✅ `.env` و `server/.env` في `.gitignore` - لن تُرفع
2. ✅ جميع Routes تعمل مع Postgres الآن
3. ✅ SQL متوافق مع Postgres و MSSQL
4. ✅ Transactions مدعومة في Postgres

---

## 🎯 النتيجة النهائية

**التطبيق الآن جاهز 100% للنشر على:**
- ✅ Supabase (Postgres)
- ✅ Netlify (Frontend)
- ✅ Render/Railway (Backend)

**كل Routes تعمل مع Postgres بدون مشاكل!**

---

للمزيد من التفاصيل، راجع `DEPLOYMENT.md`
