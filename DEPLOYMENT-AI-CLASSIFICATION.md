# تعليمات نشر ميزة اقتراح التصنيف بالذكاء الاصطناعي
# AI Asset Classification Deployment Guide

## 📋 نظرة عامة | Overview

هذا الدليل يشرح كيفية نشر Cloudflare Worker لميزة اقتراح التصنيف من الصور باستخدام OpenAI Vision API.

---

## 🔧 المتطلبات | Prerequisites

1. **حساب Cloudflare** مجاني على [dash.cloudflare.com](https://dash.cloudflare.com)
2. **حساب OpenAI** مع رصيد API على [platform.openai.com](https://platform.openai.com)
3. **Node.js v18+** مثبت على جهازك
4. **Wrangler CLI** (أداة Cloudflare للنشر)

---

## 📁 هيكل الملفات | File Structure

```
cloudflare-worker/
├── worker.js        # كود Worker الرئيسي
└── wrangler.toml    # إعدادات النشر
```

---

## 🚀 خطوات النشر | Deployment Steps

### الخطوة 1: تثبيت Wrangler CLI

```bash
npm install -g wrangler
```

### الخطوة 2: تسجيل الدخول لـ Cloudflare

```bash
wrangler login
```

سيفتح المتصفح لتسجيل الدخول.

### الخطوة 3: إنشاء مجلد Worker

```bash
mkdir asset-classifier-worker
cd asset-classifier-worker
```

### الخطوة 4: نسخ ملفات Worker

انسخ محتوى الملفين التاليين من مجلد `cloudflare-worker/`:
- `worker.js` → `worker.js`
- `wrangler.toml` → `wrangler.toml`

### الخطوة 5: إضافة OPENAI_API_KEY كـ Secret

**مهم جداً:** لا تضع مفتاح API في الكود!

```bash
wrangler secret put OPENAI_API_KEY
```

سيطلب منك إدخال المفتاح بشكل آمن:
```
Enter a secret value: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### الخطوة 6: نشر Worker

```bash
wrangler deploy
```

ستحصل على رابط مثل:
```
https://asset-classifier.YOUR-SUBDOMAIN.workers.dev
```

---

## ⚙️ تحديث التطبيق | Update Application

### تحديث `app.js`

ابحث عن:
```javascript
const AI_API_BASE = 'PLACEHOLDER_WORKER_URL';
```

استبدله بـ:
```javascript
const AI_API_BASE = 'https://asset-classifier.YOUR-SUBDOMAIN.workers.dev';
```

### رفع التحديثات لـ GitHub

```bash
git add js/app.js
git commit -m "Add AI classification feature"
git push origin main
```

---

## 🔒 إعدادات الأمان | Security Configuration

### CORS - مسموح فقط لـ GitHub Pages

الـ Worker مُعد ليقبل فقط طلبات من:
```
https://raqeemx.github.io
```

لتغيير ذلك، عدّل هذا السطر في `worker.js`:
```javascript
const ALLOWED_ORIGIN = 'https://raqeemx.github.io';
```

### تغيير Domain

إذا كان لديك domain مخصص:
```javascript
const ALLOWED_ORIGIN = 'https://yourdomain.com';
```

---

## 📡 API Documentation

### Endpoint

```
POST /ai/classify
```

### Request Format

**Headers:**
```
Content-Type: multipart/form-data
```

**Body (FormData):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| image | File | ✅ | صورة الأصل (JPEG, PNG, GIF, WebP) |
| categories | JSON String | ✅ | قائمة الفئات الرئيسية |
| categories2 | JSON String | ✅ | قائمة الفئات الفرعية |
| categories3 | JSON String | ✅ | قائمة الفئات التفصيلية |

### Request Example (JavaScript)

```javascript
const formData = new FormData();
formData.append('image', imageBlob, 'asset.jpg');
formData.append('categories', JSON.stringify(['أثاث مكتبي', 'أجهزة حاسب آلي', 'مركبات', 'أخرى']));
formData.append('categories2', JSON.stringify(['كراسي', 'مكاتب', 'لابتوب', 'أخرى']));
formData.append('categories3', JSON.stringify(['كرسي مدير', 'Dell', 'HP', 'أخرى']));

const response = await fetch('https://asset-classifier.xxx.workers.dev/ai/classify', {
    method: 'POST',
    body: formData
});

const result = await response.json();
```

### Response Format (Success - 200)

```json
{
    "category": "أجهزة حاسب آلي",
    "category2": "لابتوب",
    "category3": "Dell",
    "confidence": 0.92,
    "notes": "جهاز لابتوب Dell من فئة Latitude يبدو في حالة جيدة"
}
```

### Response Format (Error)

```json
{
    "error": "رسالة الخطأ",
    "category": "أخرى",
    "category2": "أخرى",
    "category3": "أخرى",
    "confidence": 0,
    "notes": "خطأ: رسالة الخطأ"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | نجاح |
| 400 | خطأ في البيانات المرسلة |
| 403 | CORS - Origin غير مسموح |
| 405 | Method غير مدعوم |
| 413 | حجم الصورة كبير (> 10MB) |
| 500 | خطأ في الخادم |
| 502 | خطأ من OpenAI API |

---

## 🧠 OpenAI Prompts (System & User)

### System Prompt

```
أنت نظام ذكاء اصطناعي متخصص في تصنيف الأصول الحكومية من الصور.

مهمتك:
1. تحليل الصورة المرسلة وتحديد نوع الأصل (أثاث، جهاز إلكتروني، مركبة، معدات، إلخ)
2. اختيار التصنيف الأنسب من القوائم المتاحة فقط
3. يجب أن يكون ردك بتنسيق JSON فقط

قواعد صارمة:
- اختر فقط من القوائم المتاحة المرسلة في الطلب
- إذا لم تجد تطابقًا دقيقًا، اختر "أخرى"
- قيمة الثقة بين 0.0 و 1.0
- لا تضف أي نص خارج JSON
- الرد يجب أن يكون باللغة العربية

تنسيق الرد المطلوب:
{
    "category": "القيمة من قائمة categories",
    "category2": "القيمة من قائمة categories2",
    "category3": "القيمة من قائمة categories3",
    "confidence": 0.85,
    "notes": "ملاحظات مختصرة عن الأصل"
}
```

### User Prompt

```
صنّف الأصل في الصورة باستخدام القوائم التالية فقط:

قائمة الفئة الرئيسية (categories):
["أثاث مكتبي", "أجهزة حاسب آلي", ...]

قائمة الفئة الفرعية (categories2):
["كراسي", "مكاتب", "لابتوب", ...]

قائمة الفئة التفصيلية (categories3):
["كرسي مدير", "Dell", "HP", ...]

أعد الرد بتنسيق JSON فقط مع القيم المختارة من هذه القوائم حصرياً.
إذا لم تستطع تحديد الفئة بدقة، استخدم "أخرى" مع ثقة منخفضة.
```

---

## 💰 تكلفة OpenAI API

- **Model**: GPT-4o (Vision)
- **تقريباً**: $0.01 - $0.03 لكل صورة
- **Limit المقترح**: 500 - 1000 طلب شهرياً

لمراقبة الاستهلاك: [platform.openai.com/usage](https://platform.openai.com/usage)

---

## 🐛 استكشاف الأخطاء | Troubleshooting

### خطأ: "CORS blocked"

**السبب:** Origin غير مسموح
**الحل:** تأكد أن `ALLOWED_ORIGIN` في Worker يطابق رابط موقعك

### خطأ: "مفتاح API غير صالح"

**السبب:** Secret OPENAI_API_KEY غير مُعد أو منتهي
**الحل:**
```bash
wrangler secret put OPENAI_API_KEY
```

### خطأ: "حجم الصورة كبير"

**السبب:** الصورة > 10MB
**الحل:** قلل حجم الصورة قبل الرفع أو عدّل `MAX_FILE_SIZE` في Worker

### خطأ: "تم تجاوز حد الطلبات"

**السبب:** Rate limit من OpenAI
**الحل:** انتظر دقيقة أو زد الحد في OpenAI Dashboard

### الزر لا يعمل وأنا أوفلاين

**هذا متوقع!** الميزة تتطلب إنترنت ولن تعمل أوفلاين.

---

## 📊 مراقبة Worker

### من Cloudflare Dashboard

1. اذهب إلى [dash.cloudflare.com](https://dash.cloudflare.com)
2. اختر Workers & Pages
3. اختر Worker "asset-classifier"
4. راقب Requests, Errors, CPU Time

### من Wrangler CLI

```bash
wrangler tail
```

---

## 🔄 تحديث Worker

بعد أي تعديل على `worker.js`:

```bash
wrangler deploy
```

---

## 📝 ملاحظات إضافية

1. **الـ Worker مجاني** حتى 100,000 طلب/يوم
2. **لا يوجد cold start** - Cloudflare Workers فورية
3. **البيانات آمنة** - لا نخزن الصور، تُرسل مباشرة لـ OpenAI
4. **التصنيف اختياري** - لا يُغير النظام إذا لم يضغط المستخدم

---

## ✅ قائمة التحقق قبل الإنتاج

- [ ] تم إضافة OPENAI_API_KEY كـ Secret
- [ ] تم تحديث ALLOWED_ORIGIN للـ domain الصحيح
- [ ] تم تحديث AI_API_BASE في app.js
- [ ] تم اختبار الميزة من GitHub Pages
- [ ] تم التحقق من عمل CORS
- [ ] تم مراقبة Worker لأي أخطاء

---

## 🆘 الدعم | Support

للمساعدة، تواصل عبر GitHub Issues في المستودع الأصلي.
