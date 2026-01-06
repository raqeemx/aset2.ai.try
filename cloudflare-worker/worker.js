/**
 * Cloudflare Worker - AI Asset Classification Endpoint
 * نقطة نهاية الذكاء الاصطناعي لتصنيف الأصول
 * 
 * Endpoint: POST /ai/classify
 * Uses OpenAI Vision API (GPT-4o) for image classification
 */

// CORS Configuration - Only allow GitHub Pages origin
const ALLOWED_ORIGIN = 'https://raqeemx.github.io';

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// OpenAI API Configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o';

/**
 * CORS Headers Helper
 */
function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : '',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
}

/**
 * Handle CORS Preflight
 */
function handleOptions(request) {
    const origin = request.headers.get('Origin');
    if (origin !== ALLOWED_ORIGIN) {
        return new Response('Forbidden', { status: 403 });
    }
    return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
    });
}

/**
 * Create Error Response
 */
function errorResponse(message, status, origin) {
    return new Response(
        JSON.stringify({ 
            error: message,
            category: 'أخرى',
            category2: 'أخرى',
            category3: 'أخرى',
            confidence: 0,
            notes: `خطأ: ${message}`
        }),
        {
            status: status,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders(origin),
            },
        }
    );
}

/**
 * Create Success Response
 */
function successResponse(data, origin) {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
        },
    });
}

/**
 * Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Build OpenAI System Prompt
 */
function buildSystemPrompt() {
    return `أنت نظام ذكاء اصطناعي متخصص في تصنيف الأصول الحكومية من الصور.

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
}`;
}

/**
 * Build OpenAI User Prompt with categories
 */
function buildUserPrompt(categories, categories2, categories3) {
    return `صنّف الأصل في الصورة باستخدام القوائم التالية فقط:

قائمة الفئة الرئيسية (categories):
${JSON.stringify(categories, null, 2)}

قائمة الفئة الفرعية (categories2):
${JSON.stringify(categories2, null, 2)}

قائمة الفئة التفصيلية (categories3):
${JSON.stringify(categories3, null, 2)}

أعد الرد بتنسيق JSON فقط مع القيم المختارة من هذه القوائم حصرياً.
إذا لم تستطع تحديد الفئة بدقة، استخدم "أخرى" مع ثقة منخفضة.`;
}

/**
 * Call OpenAI Vision API
 */
async function classifyWithOpenAI(imageBase64, mimeType, categories, categories2, categories3, apiKey) {
    const requestBody = {
        model: OPENAI_MODEL,
        messages: [
            {
                role: 'system',
                content: buildSystemPrompt()
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: buildUserPrompt(categories, categories2, categories3)
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:${mimeType};base64,${imageBase64}`,
                            detail: 'high'
                        }
                    }
                ]
            }
        ],
        max_tokens: 500,
        temperature: 0.3,
        response_format: { type: 'json_object' }
    };

    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
            throw new Error('مفتاح API غير صالح');
        } else if (response.status === 429) {
            throw new Error('تم تجاوز حد الطلبات، حاول لاحقاً');
        } else if (response.status === 413) {
            throw new Error('حجم الصورة كبير جداً');
        } else {
            throw new Error(`خطأ OpenAI: ${errorData.error?.message || response.status}`);
        }
    }

    return await response.json();
}

/**
 * Validate and extract classification result
 */
function validateClassificationResult(result, categories, categories2, categories3) {
    // Default fallback values
    const defaultResult = {
        category: 'أخرى',
        category2: 'أخرى',
        category3: 'أخرى',
        confidence: 0,
        notes: 'لم يتم التعرف على الأصل'
    };

    try {
        const content = result.choices?.[0]?.message?.content;
        if (!content) return defaultResult;

        const parsed = JSON.parse(content);

        // Validate category is from the list
        const validCategory = categories.includes(parsed.category) ? parsed.category : 'أخرى';
        const validCategory2 = categories2.includes(parsed.category2) ? parsed.category2 : 'أخرى';
        const validCategory3 = categories3.includes(parsed.category3) ? parsed.category3 : 'أخرى';

        // Validate confidence is a number between 0 and 1
        let confidence = parseFloat(parsed.confidence);
        if (isNaN(confidence) || confidence < 0) confidence = 0;
        if (confidence > 1) confidence = 1;

        return {
            category: validCategory,
            category2: validCategory2,
            category3: validCategory3,
            confidence: Math.round(confidence * 100) / 100,
            notes: parsed.notes || ''
        };
    } catch (e) {
        console.error('Error parsing OpenAI response:', e);
        return defaultResult;
    }
}

/**
 * Main Request Handler
 */
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin') || '';

        // CORS check
        if (origin && origin !== ALLOWED_ORIGIN) {
            return new Response('Forbidden', { status: 403 });
        }

        // Handle preflight
        if (request.method === 'OPTIONS') {
            return handleOptions(request);
        }

        // Only handle POST /ai/classify
        if (request.method !== 'POST' || url.pathname !== '/ai/classify') {
            return errorResponse('Method Not Allowed', 405, origin);
        }

        try {
            // Check API key exists
            const apiKey = env.OPENAI_API_KEY;
            if (!apiKey) {
                console.error('OPENAI_API_KEY secret not configured');
                return errorResponse('خطأ في إعداد الخادم', 500, origin);
            }

            // Parse multipart form data
            const formData = await request.formData();
            
            // Get image file
            const imageFile = formData.get('image');
            if (!imageFile || !(imageFile instanceof File)) {
                return errorResponse('لم يتم إرسال صورة', 400, origin);
            }

            // Check file size
            if (imageFile.size > MAX_FILE_SIZE) {
                return errorResponse('حجم الصورة يتجاوز الحد المسموح (10MB)', 413, origin);
            }

            // Validate image type
            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(imageFile.type)) {
                return errorResponse('نوع الصورة غير مدعوم', 400, origin);
            }

            // Get categories from form data
            let categories, categories2, categories3;
            try {
                categories = JSON.parse(formData.get('categories') || '[]');
                categories2 = JSON.parse(formData.get('categories2') || '[]');
                categories3 = JSON.parse(formData.get('categories3') || '[]');
            } catch (e) {
                return errorResponse('خطأ في تنسيق قوائم التصنيفات', 400, origin);
            }

            // Ensure "أخرى" is in all lists as fallback
            if (!categories.includes('أخرى')) categories.push('أخرى');
            if (!categories2.includes('أخرى')) categories2.push('أخرى');
            if (!categories3.includes('أخرى')) categories3.push('أخرى');

            // Convert image to base64
            const imageBuffer = await imageFile.arrayBuffer();
            const imageBase64 = arrayBufferToBase64(imageBuffer);

            // Call OpenAI Vision API
            const openAIResult = await classifyWithOpenAI(
                imageBase64, 
                imageFile.type, 
                categories, 
                categories2, 
                categories3, 
                apiKey
            );

            // Validate and extract result
            const classificationResult = validateClassificationResult(
                openAIResult, 
                categories, 
                categories2, 
                categories3
            );

            return successResponse(classificationResult, origin);

        } catch (error) {
            console.error('Classification error:', error);
            return errorResponse(error.message || 'خطأ في معالجة الطلب', 502, origin);
        }
    }
};
