# تصميم N8N Workflow للتكامل مع SCA Request Management

## نظرة عامة

يعمل هذا الـ Workflow على استقبال طلبات الإجازات والنقل من التطبيق، وتقييمها، وإرجاع توصية (اعتماد / رفض / مراجعة يدوية) للتطبيق لمعالجتها فوراً.

---

## مخطط سير العمل (Workflow Diagram)

```
┌─────────────┐
│   Webhook   │  ← POST من التطبيق
│  (استقبال)  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│  تحديد نوع الحدث         │
│  (leave / transfer)     │
└──────┬──────────────────┘
       │
       ├─── leave_request ───► ┌──────────────────┐
       │                       │  مدة الإجازة ≤ 5  │
       │                       │  وموازنة كافية؟   │
       │                       └─────┬────────────┘
       │                             │
       │                    ┌────────┴────────┐
       │                    │ Yes      │ No   │
       │                    ▼          ▼      │
       │              ┌─────────┐  ┌─────────┐│
       │              │ APPROVE │  │ PENDING ││
       │              │auto=true│  │         ││
       │              └────┬────┘  └────┬────┘│
       │                   │            │     │
       └── transfer_request──►          │     │
                            └──────────┼─────┘
                                       │
                                       ▼
                            ┌──────────────────┐
                            │ Respond to       │
                            │ Webhook (JSON)   │
                            └──────────────────┘
```

---

## العُقد المطلوبة في N8N

### 1. Webhook (استقبال)
- **النوع**: Webhook
- **الإعدادات**:
  - HTTP Method: `POST`
  - Path: `sca-request` (أو ما يتناسب مع مسارك)
  - **مهم**: تفعيل **Respond to Webhook** = `Using 'Respond to Webhook' Node`
- **المخرجات**: `$json.body` يحتوي على الـ payload الكامل

### 2. Switch (توزيع حسب النوع)
- **النوع**: Switch
- **الشروط**:
  - `{{ $json.body.meta.event_type }}` equals `leave_request` → Output 1
  - `{{ $json.body.meta.event_type }}` equals `transfer_request` → Output 2
  - Default → Output 3 (PENDING)

### 3. IF – Leave Request (شروط الاعتماد التلقائي)
- **النوع**: IF
- **الشرط**:
  - `{{ $json.body.request.details.duration_calculated }}` أقل من أو يساوي 5
  - ويمكن إضافة: التحقق من الموازنة إن وُجدت
- **True** → اعتماد تلقائي
- **False** → مراجعة يدوية

### 4. Set – Prepare Response (APPROVE)
- **النوع**: Set
- **القيم**:
```json
{
  "success": true,
  "recommendation": "APPROVE",
  "auto_approve": true,
  "rejection_reason": null,
  "message": "تم التحقق من الطلب والموافقة عليه آلياً",
  "workflow_run_id": "{{ $execution.id }}"
}
```

### 5. Set – Prepare Response (PENDING)
- **النوع**: Set
- **القيم**:
```json
{
  "success": true,
  "recommendation": "PENDING",
  "auto_approve": false,
  "rejection_reason": null,
  "message": "الطلب يحتاج مراجعة يدوية من المدير"
}
```

### 6. Respond to Webhook
- **النوع**: Respond to Webhook
- **الإعدادات**:
  - Respond With: `JSON`
  - Response Body: `{{ $json }}` (الـ JSON المُعَد من Set)

---

## خطوات الإعداد في N8N

1. إنشاء Workflow جديد.
2. إضافة عقدة **Webhook** وتفعيل "Respond to Webhook".
3. نسخ رابط الـ Webhook ووضعه في إعدادات التطبيق (`n8n_webhook_url`).
4. إضافة عقد **Switch** و **IF** و **Set** و **Respond to Webhook** كما في المخطط.
5. ربط المخرجات بحيث تتلاقى جميع المسارات عند عقدة **Respond to Webhook**.
6. تفعيل الـ Workflow.

---

## ملاحظات مهمة

- يجب أن تُرجع N8N استجابة JSON خلال **30 ثانية** (مهلة الطلب).
- استخدام **Respond to Webhook** ضروري حتى يتمكن التطبيق من استقبال الرد واستخدامه.
- يمكن توسيع الشروط بإضافة تحقق من قاعدة بيانات الموظفين أو قواعد الأعمال.
