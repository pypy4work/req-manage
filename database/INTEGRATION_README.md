# تكامل Mock مع قاعدة بيانات MSSQL

## الهدف
أن تكون البيانات في وضع Mock (الذاكرة) مطابقة لهيكل وقيم قاعدة البيانات الحقيقية MSSQL، بحيث:
- واجهة التطبيق واحدة (نفس الـ API).
- عند التبديل إلى الاتصال بـ SQL Server، لا يلزم تغيير منطق الواجهة.

## الجداول والملفات

| الغرض | Mock (api.ts) | MSSQL |
|-------|----------------|-------|
| طلبات الإجازات/العامة | `db_requests` (بدون transfer_id) | `requests` أو جدول الطلبات العام |
| طلبات النقل | `db_requests` (مع transfer_id) | `sca.transfer_requests` + `sca.transfer_preferences` |
| معايير التوزيع | `db_allocation_criteria` (mock داخل api) | `sca.allocation_criteria` |
| حدود الدرجات بالوحدة | mock داخل api | `sca.unit_grade_limits` |
| العناوين | على المستخدم/الوحدة في الذاكرة | `sca.addresses` |
| أنواع الطلبات (نقل) | `db_request_types` مع is_transfer_type و transfer_config | `request_types` مع is_transfer_type و transfer_config_json |

## ترتيب تنفيذ السكربتات على MSSQL

1. **schema.sql** – الهيكل الأساسي (المستخدمون، الوحدات، أنواع الطلبات، الطلبات العامة).
2. **address_migration.sql** – جدول العناوين وحدود الدرجات وتعديل أنواع الطلبات.
3. **transfer_schema.sql** – جداول تفضيلات النقل، التقييمات، حدود النقل، معايير التوزيع، والإجراءات المخزنة.
4. **transfer_requests_table.sql** – جدول `sca.transfer_requests` إذا لم يكن مندرجاً في مشروعك (مطابق لهيكل الطلب في الـ Mock).

## ربط الواجهة بقاعدة الحقيقية

- في **وضع Mock**: كل القراءة والكتابة تتم من/إلى `api.ts` (مثل `db_requests`، كائنات الطلبات والنقل).
- في **وضع Backend (MSSQL)**:
  - `getMyRequests(user_id)` يُفترض أن يعيد: طلبات الإجازات من جدول الطلبات العام + طلبات النقل من `transfer_requests` (مع تطبيع الشكل إلى نفس بنية الطلب في الواجهة).
  - `getTransferRequests(status)` يُفترض أن يستدعي مثلاً `sca.usp_GetTransferRequests` أو SELECT من `sca.transfer_requests` مع الـ JOINات المناسبة.
  - `submitTransferRequest` يُفترض أن يكتب في `sca.transfer_requests` ثم في `sca.transfer_preferences`.

بهذا يكون التكامل بين الـ Mock وقاعدة MSSQL من ناحية الهيكل والسلوك موحداً في واجهة واحدة.
