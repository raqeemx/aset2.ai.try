/**
 * نظام التعرف على الأصول بالذكاء الاصطناعي
 * AI-Powered Asset Recognition System
 */

// إعدادات الذكاء الاصطناعي
const AIAssetRecognition = {
    apiKey: null,
    isInitialized: false,

    /**
     * تهيئة نظام الذكاء الاصطناعي
     */
    init: function() {
        this.apiKey = localStorage.getItem('openai_api_key');
        this.isInitialized = !!this.apiKey;
        return this.isInitialized;
    },

    /**
     * إعداد مفتاح API
     */
    setApiKey: function(key) {
        this.apiKey = key;
        localStorage.setItem('openai_api_key', key);
        this.isInitialized = true;
    },

    /**
     * التحقق من حالة التهيئة
     */
    checkInitialization: function() {
        if (!this.isInitialized) {
            this.showApiKeyModal();
            return false;
        }
        return true;
    },

    /**
     * عرض نافذة إدخال مفتاح API
     */
    showApiKeyModal: function() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-8 w-full max-w-md mx-4">
                <div class="text-center mb-6">
                    <div class="bg-purple-100 p-4 rounded-full w-16 h-16 mx-auto mb-4">
                        <i class="fas fa-robot text-2xl text-purple-600"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">إعداد الذكاء الاصطناعي</h3>
                    <p class="text-gray-600">يرجى إدخال مفتاح OpenAI API للاستفادة من ميزة التعرف على الأصول</p>
                </div>
                
                <form id="apiKeyForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">مفتاح OpenAI API</label>
                        <input type="password" id="apiKeyInput" placeholder="sk-..." required 
                               class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        <p class="text-xs text-gray-500 mt-1">يتم تخزين المفتاح محلياً في متصفحك فقط</p>
                    </div>
                    
                    <div class="flex gap-3">
                        <button type="button" onclick="document.body.removeChild(this.closest('.fixed'))" 
                                class="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50">
                            إلغاء
                        </button>
                        <button type="submit" class="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700">
                            حفظ
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('apiKeyForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const apiKey = document.getElementById('apiKeyInput').value.trim();
            if (apiKey) {
                this.setApiKey(apiKey);
                document.body.removeChild(modal);
                showNotification('تم حفظ مفتاح API بنجاح', 'success');
            }
        });
    },

    /**
     * تحليل الصور بالذكاء الاصطناعي (دالة مؤقتة)
     */
    analyzeImages: async function(images) {
        if (!this.checkInitialization()) {
            return null;
        }

        // دالة مؤقتة - سيتم تطوير الوظيفة الكاملة لاحقاً
        showNotification('ميزة التحليل بالذكاء الاصطناعي قيد التطوير', 'info');
        
        return {
            name: 'جهاز كمبيوتر محمول',
            category1: 'تقنية المعلومات',
            category2: 'أجهزة الحاسوب',
            category3: 'أجهزة محمولة',
            condition: 'جيد',
            brand: 'Dell',
            model: 'Latitude 5520',
            color: 'أسود',
            features: ['شاشة 15.6 بوصة', 'معالج Intel Core i5', 'ذاكرة 8GB RAM']
        };
    }
};

// تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    AIAssetRecognition.init();
});

// إضافة للنطاق العام
window.AIAssetRecognition = AIAssetRecognition;