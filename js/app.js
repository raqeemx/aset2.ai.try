/**
 * التوابع الأساسية لنظام جرد الأصول
 * Basic functions for Asset Inventory System
 */

// المتغيرات العامة
let currentAssets = [];
let allAssets = [];
let assetIdCounter = 1;

// تهيئة قاعدة البيانات المحلية
let db;
const DB_NAME = 'AssetInventoryDB';
const DB_VERSION = 6;

/**
 * تهيئة IndexedDB
 */
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            // إنشاء جدول الأصول
            if (!db.objectStoreNames.contains('assets')) {
                const assetsStore = db.createObjectStore('assets', { keyPath: 'id' });
                assetsStore.createIndex('name', 'name', { unique: false });
                assetsStore.createIndex('category', 'category', { unique: false });
                assetsStore.createIndex('department', 'department', { unique: false });
                assetsStore.createIndex('createdAt', 'createdAt', { unique: false });
            }
            
            // إنشاء جدول الإعدادات
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
        };
    });
}

/**
 * إضافة أصل جديد
 */
async function addAsset(asset) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['assets'], 'readwrite');
        const store = transaction.objectStore('assets');
        
        if (!asset.id) {
            asset.id = generateUUID();
        }
        
        asset.createdAt = asset.createdAt || Date.now();
        asset.updatedAt = Date.now();
        
        const request = store.add(asset);
        request.onsuccess = () => resolve(asset);
        request.onerror = () => reject(request.error);
    });
}

/**
 * تحديث أصل موجود
 */
async function updateAsset(assetId, updatedAsset) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['assets'], 'readwrite');
        const store = transaction.objectStore('assets');
        
        updatedAsset.id = assetId;
        updatedAsset.updatedAt = Date.now();
        
        const request = store.put(updatedAsset);
        request.onsuccess = () => resolve(updatedAsset);
        request.onerror = () => reject(request.error);
    });
}

/**
 * جلب جميع الأصول
 */
async function getAllAssets() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['assets'], 'readonly');
        const store = transaction.objectStore('assets');
        
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

/**
 * حذف أصل
 */
async function deleteAsset(assetId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['assets'], 'readwrite');
        const store = transaction.objectStore('assets');
        
        const request = store.delete(assetId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * توليد UUID فريد
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * عرض الإشعارات
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl text-white font-medium animate-slide-in`;
    
    switch(type) {
        case 'success':
            notification.classList.add('bg-green-600');
            break;
        case 'error':
            notification.classList.add('bg-red-600');
            break;
        case 'warning':
            notification.classList.add('bg-yellow-600');
            break;
        default:
            notification.classList.add('bg-blue-600');
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

/**
 * تبديل عرض الصفحات
 */
function showPage(pageId) {
    // إخفاء جميع الصفحات
    document.querySelectorAll('[id$="Page"]').forEach(page => {
        page.classList.add('hidden');
    });
    
    // عرض الصفحة المطلوبة
    const targetPage = document.getElementById(pageId + 'Page');
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    // تحديث روابط التنقل
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`[onclick="showPage('${pageId}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // تحديث محتوى الصفحة حسب نوعها
    if (pageId === 'assets') {
        loadAssets();
    } else if (pageId === 'dashboard') {
        loadDashboard();
    }
}

/**
 * تحميل الأصول
 */
async function loadAssets() {
    try {
        const assets = await getAllAssets();
        allAssets = assets;
        displayAssets(assets);
        updateAssetsCounter(assets.length);
    } catch (error) {
        console.error('خطأ في تحميل الأصول:', error);
        showNotification('حدث خطأ أثناء تحميل الأصول', 'error');
    }
}

/**
 * عرض الأصول
 */
function displayAssets(assets) {
    const container = document.getElementById('assetsContainer');
    if (!container) return;
    
    if (!assets || assets.length === 0) {
        container.innerHTML = `
            <div class="col-span-full">
                <div class="bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center">
                    <div class="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-box-open text-2xl text-gray-400"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">لا توجد أصول</h3>
                    <p class="text-gray-500 mb-6">ابدأ بإضافة أول أصل لك</p>
                    <button onclick="showAddAssetModal()" class="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors">
                        إضافة أصل جديد
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = assets.map(asset => `
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300">
            <div class="p-6">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                        <h3 class="font-bold text-lg text-gray-800 mb-1">${asset.name || 'بدون اسم'}</h3>
                        <p class="text-gray-600 text-sm">${asset.category1 || 'بدون تصنيف'}</p>
                    </div>
                    <div class="text-left">
                        <div class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                            ${asset.id ? asset.id.substring(0, 8) : 'معرف مؤقت'}
                        </div>
                    </div>
                </div>
                
                <div class="space-y-2 mb-4">
                    ${asset.department ? `<div class="flex items-center gap-2 text-sm text-gray-600">
                        <i class="fas fa-building text-xs w-4"></i>
                        <span>${asset.department}</span>
                    </div>` : ''}
                    
                    ${asset.location ? `<div class="flex items-center gap-2 text-sm text-gray-600">
                        <i class="fas fa-map-marker-alt text-xs w-4"></i>
                        <span>${asset.location}</span>
                    </div>` : ''}
                    
                    ${asset.condition ? `<div class="flex items-center gap-2 text-sm">
                        <i class="fas fa-info-circle text-xs w-4"></i>
                        <span class="condition-badge ${getConditionClass(asset.condition)}">${asset.condition}</span>
                    </div>` : ''}
                </div>
                
                <div class="flex justify-between items-center pt-4 border-t border-gray-100">
                    <div class="flex gap-2">
                        <button onclick="editAsset('${asset.id}')" class="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="viewAsset('${asset.id}')" class="text-green-600 hover:bg-green-50 p-2 rounded-lg transition-colors">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="deleteAssetConfirm('${asset.id}')" class="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="text-xs text-gray-500">
                        ${asset.createdAt ? new Date(asset.createdAt).toLocaleDateString('ar-SA') : 'غير محدد'}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * تحديد لون حالة الأصل
 */
function getConditionClass(condition) {
    switch(condition) {
        case 'ممتاز': return 'text-green-600 bg-green-100';
        case 'جيد': return 'text-blue-600 bg-blue-100';
        case 'مقبول': return 'text-yellow-600 bg-yellow-100';
        case 'يحتاج صيانة': return 'text-orange-600 bg-orange-100';
        case 'تالف': return 'text-red-600 bg-red-100';
        default: return 'text-gray-600 bg-gray-100';
    }
}

/**
 * تحميل لوحة التحكم
 */
function loadDashboard() {
    // سيتم تنفيذ هذه الوظيفة لاحقاً
    console.log('تحميل لوحة التحكم');
}

/**
 * تحديث عداد الأصول
 */
function updateAssetsCounter(count) {
    const counter = document.getElementById('assetsCount');
    if (counter) {
        counter.textContent = count;
    }
}

/**
 * تبديل عرض القوائم المنسدلة
 */
function toggleImportMenu() {
    const menu = document.getElementById('importMenu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

/**
 * تصدير البيانات إلى Excel (دالة مؤقتة)
 */
function exportToExcel() {
    showNotification('ميزة تصدير Excel متاحة قريباً', 'info');
}

/**
 * استيراد الأصول من Excel (دالة مؤقتة)
 */
function importAssetsFromExcel(event) {
    showNotification('ميزة استيراد Excel متاحة قريباً', 'info');
}

/**
 * تحميل نموذج Excel (دالة مؤقتة)
 */
function downloadExcelTemplate() {
    showNotification('تحميل نموذج Excel متاح قريباً', 'info');
}

/**
 * عرض نافذة إضافة أصل جديد (دالة مؤقتة)
 */
function showAddAssetModal() {
    showNotification('نافذة إضافة الأصل متاحة قريباً', 'info');
}

/**
 * تحرير أصل (دالة مؤقتة)
 */
function editAsset(assetId) {
    showNotification('ميزة التحرير متاحة قريباً', 'info');
}

/**
 * عرض تفاصيل أصل (دالة مؤقتة)
 */
function viewAsset(assetId) {
    showNotification('عرض التفاصيل متاح قريباً', 'info');
}

/**
 * تأكيد حذف أصل (دالة مؤقتة)
 */
function deleteAssetConfirm(assetId) {
    if (confirm('هل أنت متأكد من حذف هذا الأصل؟')) {
        deleteAsset(assetId).then(() => {
            showNotification('تم حذف الأصل بنجاح', 'success');
            loadAssets();
        }).catch(error => {
            console.error('خطأ في حذف الأصل:', error);
            showNotification('حدث خطأ أثناء حذف الأصل', 'error');
        });
    }
}

// تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await initDB();
        console.log('تم تهيئة قاعدة البيانات بنجاح');
        
        // تحميل الصفحة الافتراضية
        showPage('dashboard');
        
        // تحميل الأصول
        await loadAssets();
        
    } catch (error) {
        console.error('خطأ في تهيئة النظام:', error);
        showNotification('حدث خطأ في تهيئة النظام', 'error');
    }
});