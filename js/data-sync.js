/**
 * نظام مزامنة البيانات وجمع البيانات من العمال المتعددين
 * Data Synchronization System for Multiple Workers
 * 
 * الميزات:
 * - تصدير البيانات لكل عامل مع معرف فريد
 * - استيراد البيانات من عدة عمال
 * - دمج البيانات مع تجنب التكرار
 * - تقارير مفصلة عن العمليات
 */

// إعدادات نظام مزامنة البيانات
const DataSync = {
    // معلومات العامل الحالي
    currentWorker: {
        id: localStorage.getItem('workerId') || null,
        name: localStorage.getItem('workerName') || null,
        area: localStorage.getItem('workerArea') || null
    },

    /**
     * تهيئة معرف العامل الحالي
     */
    initializeWorker: function() {
        if (!this.currentWorker.id) {
            this.showWorkerSetupModal();
        }
    },

    /**
     * عرض نافذة إعداد معلومات العامل
     */
    showWorkerSetupModal: function() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-8 w-full max-w-md mx-4">
                <div class="text-center mb-6">
                    <div class="bg-blue-100 p-4 rounded-full w-16 h-16 mx-auto mb-4">
                        <i class="fas fa-user-cog text-2xl text-blue-600"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">إعداد معلومات العامل</h3>
                    <p class="text-gray-600">يرجى إدخال معلوماتك لتتبع البيانات المدخلة</p>
                </div>
                
                <form id="workerSetupForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">معرف العامل</label>
                        <input type="text" id="workerId" placeholder="مثال: EMP001" required 
                               class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <p class="text-xs text-gray-500 mt-1">معرف فريد لكل عامل (لا يمكن تغييره لاحقاً)</p>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">اسم العامل</label>
                        <input type="text" id="workerName" placeholder="الاسم الكامل" required 
                               class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">المنطقة المكلف بها</label>
                        <input type="text" id="workerArea" placeholder="مثال: الطابق الأول - الجناح الشرقي" required 
                               class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    
                    <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors">
                        حفظ المعلومات
                    </button>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // معالج النموذج
        document.getElementById('workerSetupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const workerId = document.getElementById('workerId').value.trim();
            const workerName = document.getElementById('workerName').value.trim();
            const workerArea = document.getElementById('workerArea').value.trim();

            // التحقق من صحة البيانات
            if (!workerId || !workerName || !workerArea) {
                showNotification('يرجى ملء جميع الحقول المطلوبة', 'error');
                return;
            }

            // حفظ معلومات العامل
            localStorage.setItem('workerId', workerId);
            localStorage.setItem('workerName', workerName);
            localStorage.setItem('workerArea', workerArea);

            this.currentWorker = { id: workerId, name: workerName, area: workerArea };

            // إزالة النافذة
            document.body.removeChild(modal);

            showNotification(`تم حفظ معلومات العامل: ${workerName}`, 'success');
        }.bind(this));
    },

    /**
     * تصدير بيانات العامل الحالي
     */
    exportWorkerData: async function() {
        if (!this.currentWorker.id) {
            this.showWorkerSetupModal();
            return;
        }

        try {
            // جلب جميع البيانات من IndexedDB
            const assets = await getAllAssets();
            
            if (!assets || assets.length === 0) {
                showNotification('لا توجد بيانات أصول للتصدير', 'warning');
                return;
            }

            // إضافة معلومات العامل لكل أصل
            const workerAssets = assets.map(asset => ({
                ...asset,
                workerInfo: {
                    id: this.currentWorker.id,
                    name: this.currentWorker.name,
                    area: this.currentWorker.area,
                    exportDate: new Date().toISOString(),
                    exportTimestamp: Date.now()
                }
            }));

            // إعداد البيانات للتصدير
            const exportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    exportTimestamp: Date.now(),
                    workerInfo: this.currentWorker,
                    totalAssets: workerAssets.length,
                    version: '6.0.0',
                    type: 'worker_data_export'
                },
                assets: workerAssets,
                settings: {
                    categories: JSON.parse(localStorage.getItem('categories') || '{}'),
                    subcategories: JSON.parse(localStorage.getItem('subcategories') || '{}'),
                    detailedCategories: JSON.parse(localStorage.getItem('detailedCategories') || '{}'),
                    departments: JSON.parse(localStorage.getItem('departments') || '[]'),
                    buildings: JSON.parse(localStorage.getItem('buildings') || '[]'),
                    floors: JSON.parse(localStorage.getItem('floors') || '[]'),
                    rooms: JSON.parse(localStorage.getItem('rooms') || '[]'),
                    locations: JSON.parse(localStorage.getItem('locations') || '[]'),
                    users: JSON.parse(localStorage.getItem('users') || '[]'),
                    suppliers: JSON.parse(localStorage.getItem('suppliers') || '[]')
                }
            };

            // إنشاء اسم الملف
            const fileName = `بيانات_جرد_${this.currentWorker.id}_${new Date().toISOString().split('T')[0]}.json`;

            // تحميل الملف
            this.downloadJSON(exportData, fileName);

            showNotification(`تم تصدير ${workerAssets.length} أصل بنجاح`, 'success');

        } catch (error) {
            console.error('خطأ في تصدير البيانات:', error);
            showNotification('حدث خطأ أثناء تصدير البيانات', 'error');
        }
    },

    /**
     * استيراد ودمج البيانات من ملفات متعددة
     */
    importAndMergeData: function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.json';
        
        input.onchange = async (event) => {
            const files = Array.from(event.target.files);
            
            if (files.length === 0) {
                return;
            }

            try {
                await this.processImportFiles(files);
            } catch (error) {
                console.error('خطأ في استيراد البيانات:', error);
                showNotification('حدث خطأ أثناء استيراد البيانات', 'error');
            }
        };

        input.click();
    },

    /**
     * معالجة ملفات الاستيراد
     */
    processImportFiles: async function(files) {
        const mergeResults = {
            totalFiles: files.length,
            validFiles: 0,
            totalAssets: 0,
            newAssets: 0,
            duplicateAssets: 0,
            updatedAssets: 0,
            errors: [],
            workers: {},
            importDate: new Date().toISOString()
        };

        // عرض مؤشر التقدم
        this.showImportProgress(files.length);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.updateImportProgress(i + 1, files.length, `معالجة ملف: ${file.name}`);

            try {
                const fileContent = await this.readJSONFile(file);
                
                if (this.validateImportData(fileContent)) {
                    await this.mergeWorkerData(fileContent, mergeResults);
                    mergeResults.validFiles++;
                } else {
                    mergeResults.errors.push(`ملف غير صالح: ${file.name}`);
                }

            } catch (error) {
                mergeResults.errors.push(`خطأ في قراءة الملف ${file.name}: ${error.message}`);
            }
        }

        // إخفاء مؤشر التقدم
        this.hideImportProgress();

        // عرض تقرير النتائج
        this.showMergeReport(mergeResults);
    },

    /**
     * قراءة ملف JSON
     */
    readJSONFile: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (error) {
                    reject(new Error('تنسيق JSON غير صالح'));
                }
            };
            reader.onerror = () => reject(new Error('خطأ في قراءة الملف'));
            reader.readAsText(file);
        });
    },

    /**
     * التحقق من صحة بيانات الاستيراد
     */
    validateImportData: function(data) {
        return data && 
               data.metadata && 
               data.metadata.type === 'worker_data_export' &&
               data.assets && 
               Array.isArray(data.assets) &&
               data.metadata.workerInfo;
    },

    /**
     * دمج بيانات العامل
     */
    mergeWorkerData: async function(workerData, mergeResults) {
        const workerId = workerData.metadata.workerInfo.id;
        const workerName = workerData.metadata.workerInfo.name;

        // تسجيل معلومات العامل
        mergeResults.workers[workerId] = {
            name: workerName,
            area: workerData.metadata.workerInfo.area,
            exportDate: workerData.metadata.exportDate,
            assetsCount: workerData.assets.length
        };

        // جلب الأصول الموجودة
        const existingAssets = await getAllAssets();
        const existingAssetsMap = {};
        existingAssets.forEach(asset => {
            // استخدام مفتاح مركب للمقارنة
            const key = `${asset.name}_${asset.serialNumber || ''}_${asset.barcode || ''}`;
            existingAssetsMap[key] = asset;
        });

        // معالجة أصول العامل
        for (const asset of workerData.assets) {
            const assetKey = `${asset.name}_${asset.serialNumber || ''}_${asset.barcode || ''}`;
            mergeResults.totalAssets++;

            if (existingAssetsMap[assetKey]) {
                // الأصل موجود - تحديث أم تجاهل؟
                const existingAsset = existingAssetsMap[assetKey];
                
                // مقارنة تاريخ التحديث
                const assetUpdateTime = asset.workerInfo ? asset.workerInfo.exportTimestamp : asset.updatedAt;
                const existingUpdateTime = existingAsset.updatedAt || existingAsset.createdAt;

                if (assetUpdateTime > existingUpdateTime) {
                    // تحديث الأصل الموجود
                    await updateAsset(existingAsset.id, {
                        ...asset,
                        id: existingAsset.id,
                        updatedAt: Date.now(),
                        lastUpdatedBy: workerId,
                        mergeInfo: {
                            mergedFrom: workerId,
                            mergeDate: new Date().toISOString()
                        }
                    });
                    mergeResults.updatedAssets++;
                } else {
                    mergeResults.duplicateAssets++;
                }
            } else {
                // أصل جديد - إضافة
                const newAsset = {
                    ...asset,
                    id: generateUUID(),
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    addedBy: workerId,
                    mergeInfo: {
                        importedFrom: workerId,
                        importDate: new Date().toISOString()
                    }
                };

                await addAsset(newAsset);
                mergeResults.newAssets++;
            }
        }

        // دمج الإعدادات
        if (workerData.settings) {
            await this.mergeSettings(workerData.settings);
        }
    },

    /**
     * دمج الإعدادات
     */
    mergeSettings: async function(newSettings) {
        const settingsKeys = [
            'categories', 'subcategories', 'detailedCategories', 
            'departments', 'buildings', 'floors', 'rooms', 
            'locations', 'users', 'suppliers'
        ];

        for (const key of settingsKeys) {
            if (newSettings[key]) {
                const existing = JSON.parse(localStorage.getItem(key) || (Array.isArray(newSettings[key]) ? '[]' : '{}'));
                
                if (Array.isArray(newSettings[key])) {
                    // دمج المصفوفات
                    const merged = [...existing];
                    newSettings[key].forEach(item => {
                        if (!merged.find(existingItem => existingItem === item || existingItem.name === item.name)) {
                            merged.push(item);
                        }
                    });
                    localStorage.setItem(key, JSON.stringify(merged));
                } else {
                    // دمج الكائنات
                    const merged = { ...existing, ...newSettings[key] };
                    localStorage.setItem(key, JSON.stringify(merged));
                }
            }
        }
    },

    /**
     * عرض مؤشر التقدم
     */
    showImportProgress: function(totalFiles) {
        const modal = document.createElement('div');
        modal.id = 'importProgressModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-8 w-full max-w-md mx-4">
                <div class="text-center mb-6">
                    <div class="bg-blue-100 p-4 rounded-full w-16 h-16 mx-auto mb-4">
                        <i class="fas fa-cloud-upload-alt text-2xl text-blue-600"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">استيراد البيانات</h3>
                    <p id="progressText" class="text-gray-600">جاري معالجة الملفات...</p>
                </div>
                
                <div class="mb-4">
                    <div class="bg-gray-200 rounded-full h-3 mb-2">
                        <div id="progressBar" class="bg-blue-600 h-3 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    <p id="progressNumbers" class="text-sm text-gray-500 text-center">0 من ${totalFiles}</p>
                </div>
                
                <div class="flex justify-center">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    /**
     * تحديث مؤشر التقدم
     */
    updateImportProgress: function(current, total, message) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const progressNumbers = document.getElementById('progressNumbers');

        if (progressBar) {
            const percentage = (current / total) * 100;
            progressBar.style.width = `${percentage}%`;
        }

        if (progressText) {
            progressText.textContent = message;
        }

        if (progressNumbers) {
            progressNumbers.textContent = `${current} من ${total}`;
        }
    },

    /**
     * إخفاء مؤشر التقدم
     */
    hideImportProgress: function() {
        const modal = document.getElementById('importProgressModal');
        if (modal) {
            document.body.removeChild(modal);
        }
    },

    /**
     * عرض تقرير الدمج
     */
    showMergeReport: function(results) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                <div class="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
                    <div class="flex items-center gap-4">
                        <div class="bg-white/20 p-3 rounded-full">
                            <i class="fas fa-check-circle text-2xl"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold">تقرير استيراد البيانات</h3>
                            <p class="text-green-100">تم إكمال عملية الاستيراد بنجاح</p>
                        </div>
                    </div>
                </div>
                
                <div class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    <!-- إحصائيات عامة -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div class="bg-blue-50 p-4 rounded-xl text-center">
                            <div class="text-2xl font-bold text-blue-600">${results.validFiles}</div>
                            <div class="text-sm text-blue-800">ملفات صالحة</div>
                        </div>
                        <div class="bg-green-50 p-4 rounded-xl text-center">
                            <div class="text-2xl font-bold text-green-600">${results.newAssets}</div>
                            <div class="text-sm text-green-800">أصول جديدة</div>
                        </div>
                        <div class="bg-yellow-50 p-4 rounded-xl text-center">
                            <div class="text-2xl font-bold text-yellow-600">${results.updatedAssets}</div>
                            <div class="text-sm text-yellow-800">أصول محدثة</div>
                        </div>
                        <div class="bg-gray-50 p-4 rounded-xl text-center">
                            <div class="text-2xl font-bold text-gray-600">${results.duplicateAssets}</div>
                            <div class="text-sm text-gray-800">أصول مكررة</div>
                        </div>
                    </div>

                    <!-- معلومات العمال -->
                    <div class="mb-6">
                        <h4 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <i class="fas fa-users text-blue-600"></i>
                            العمال المشاركون (${Object.keys(results.workers).length})
                        </h4>
                        <div class="space-y-3">
                            ${Object.entries(results.workers).map(([workerId, worker]) => `
                                <div class="bg-gray-50 p-4 rounded-xl">
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <div class="font-medium text-gray-800">${worker.name}</div>
                                            <div class="text-sm text-gray-600">المعرف: ${workerId}</div>
                                            <div class="text-sm text-gray-600">المنطقة: ${worker.area}</div>
                                        </div>
                                        <div class="text-left">
                                            <div class="text-lg font-bold text-blue-600">${worker.assetsCount}</div>
                                            <div class="text-xs text-gray-500">أصل</div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- الأخطاء -->
                    ${results.errors.length > 0 ? `
                        <div class="mb-6">
                            <h4 class="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                                <i class="fas fa-exclamation-triangle"></i>
                                الأخطاء (${results.errors.length})
                            </h4>
                            <div class="space-y-2">
                                ${results.errors.map(error => `
                                    <div class="bg-red-50 border border-red-200 p-3 rounded-xl text-red-700">
                                        ${error}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- ملخص -->
                    <div class="bg-green-50 border border-green-200 p-4 rounded-xl">
                        <h4 class="font-bold text-green-800 mb-2">ملخص العملية</h4>
                        <ul class="text-sm text-green-700 space-y-1">
                            <li>تم معالجة ${results.totalFiles} ملف</li>
                            <li>تم استيراد ${results.newAssets} أصل جديد</li>
                            <li>تم تحديث ${results.updatedAssets} أصل موجود</li>
                            <li>تم تجاهل ${results.duplicateAssets} أصل مكرر</li>
                        </ul>
                    </div>
                </div>
                
                <div class="border-t border-gray-200 p-6 flex justify-between">
                    <button onclick="this.exportMergeReport(${JSON.stringify(results).replace(/"/g, '&quot;')})" class="px-6 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50">
                        تصدير التقرير
                    </button>
                    <button onclick="document.body.removeChild(this.closest('.fixed'))" class="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                        إغلاق
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // إعادة تحميل عرض الأصول
        if (typeof loadAssets === 'function') {
            loadAssets();
        }

        showNotification('تم استيراد البيانات بنجاح', 'success');
    },

    /**
     * تصدير تقرير الدمج
     */
    exportMergeReport: function(results) {
        const reportData = {
            type: 'merge_report',
            generatedAt: new Date().toISOString(),
            results: results
        };

        const fileName = `تقرير_دمج_البيانات_${new Date().toISOString().split('T')[0]}.json`;
        this.downloadJSON(reportData, fileName);
    },

    /**
     * تحميل ملف JSON
     */
    downloadJSON: function(data, fileName) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    },

    /**
     * عرض حالة العامل الحالي
     */
    showWorkerStatus: function() {
        if (!this.currentWorker.id) {
            return;
        }

        const statusElement = document.getElementById('workerStatus');
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <div class="flex items-center gap-3">
                        <div class="bg-blue-100 p-2 rounded-full">
                            <i class="fas fa-user text-blue-600"></i>
                        </div>
                        <div>
                            <div class="font-medium text-blue-800">${this.currentWorker.name}</div>
                            <div class="text-sm text-blue-600">المعرف: ${this.currentWorker.id}</div>
                            <div class="text-sm text-blue-600">المنطقة: ${this.currentWorker.area}</div>
                        </div>
                    </div>
                </div>
            `;
        }
    }
};

// تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    DataSync.initializeWorker();
    DataSync.showWorkerStatus();
});

// إضافة الوظائف للنطاق العام
window.DataSync = DataSync;
window.exportWorkerData = () => DataSync.exportWorkerData();
window.importAndMergeData = () => DataSync.importAndMergeData();
window.setupWorkerInfo = () => DataSync.showWorkerSetupModal();