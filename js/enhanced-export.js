/**
 * Enhanced Export System
 * نظام التصدير المحسن مع روابط الخرائط وألبوم الصور
 * يدعم Excel, PDF, CSV
 */

/**
 * Export assets to Excel with hyperlinks
 */
async function exportToExcelWithLinks(assets, options = {}) {
    const {
        filename = `assets_export_${new Date().toISOString().split('T')[0]}`,
        includeMapLinks = true,
        includePhotoLinks = true,
        includeSessionInfo = true,
        filterBySession = null
    } = options;

    showLoading();

    try {
        // Filter by session if specified
        let exportAssets = filterBySession 
            ? assets.filter(a => a.sessionId === filterBySession)
            : assets;

        // Prepare data with hyperlinks
        const data = exportAssets.map(asset => {
            const row = {
                'رقم الأصل': asset.code || '',
                'اسم الأصل': asset.name || '',
                'الفئة الرئيسية': asset.category || '',
                'الفئة الفرعية': asset.category2 || '',
                'الفئة التفصيلية': asset.category3 || '',
                'الحالة': asset.condition || '',
                'الموقع': asset.location || '',
                'المبنى': asset.building || '',
                'الطابق': asset.floor || '',
                'الغرفة': asset.room || '',
                'المسؤول': asset.assignee || '',
                'القسم': asset.department || '',
                'القيمة': asset.value || 0,
                'تاريخ الشراء': asset.purchaseDate || '',
                'المورد': asset.supplier || '',
                'الرقم التسلسلي': asset.serialNumber || '',
                'ملاحظات': asset.notes || '',
                'تاريخ الإضافة': asset.createdAt ? new Date(asset.createdAt).toLocaleDateString('ar-SA') : '',
                'أضيف بواسطة': asset.createdByName || asset.inventoryPerson || ''
            };

            // Add session info if enabled
            if (includeSessionInfo && asset.sessionId) {
                const session = SESSIONS_STATE?.sessions?.find(s => s.id === asset.sessionId);
                row['جلسة الجرد'] = session?.name || asset.sessionId;
            }

            // Add map link if enabled and GPS data exists
            if (includeMapLinks && asset.gpsLocation?.latitude) {
                row['فتح الخريطة'] = generateGoogleMapsLink(
                    asset.gpsLocation.latitude,
                    asset.gpsLocation.longitude
                );
            }

            // Add photo album link if enabled and images exist
            if (includePhotoLinks && asset.images?.length > 0) {
                row['ألبوم الصور'] = generateAlbumLink(asset.id);
            }

            return row;
        });

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);

        // Set column widths
        const colWidths = [
            { wch: 15 }, // رقم الأصل
            { wch: 25 }, // اسم الأصل
            { wch: 15 }, // الفئة الرئيسية
            { wch: 15 }, // الفئة الفرعية
            { wch: 15 }, // الفئة التفصيلية
            { wch: 12 }, // الحالة
            { wch: 20 }, // الموقع
            { wch: 15 }, // المبنى
            { wch: 10 }, // الطابق
            { wch: 15 }, // الغرفة
            { wch: 15 }, // المسؤول
            { wch: 15 }, // القسم
            { wch: 12 }, // القيمة
            { wch: 12 }, // تاريخ الشراء
            { wch: 20 }, // المورد
            { wch: 20 }, // الرقم التسلسلي
            { wch: 30 }, // ملاحظات
            { wch: 12 }, // تاريخ الإضافة
            { wch: 15 }, // أضيف بواسطة
            { wch: 15 }, // جلسة الجرد
            { wch: 15 }, // فتح الخريطة
            { wch: 15 }, // ألبوم الصور
        ];
        ws['!cols'] = colWidths;

        // Add hyperlinks to map and album columns
        const range = XLSX.utils.decode_range(ws['!ref']);
        const mapColIndex = Object.keys(data[0] || {}).indexOf('فتح الخريطة');
        const albumColIndex = Object.keys(data[0] || {}).indexOf('ألبوم الصور');

        for (let row = 1; row <= range.e.r; row++) {
            // Map link
            if (mapColIndex >= 0) {
                const mapCell = XLSX.utils.encode_cell({ r: row, c: mapColIndex });
                if (ws[mapCell] && ws[mapCell].v) {
                    ws[mapCell].l = { Target: ws[mapCell].v, Tooltip: 'فتح في خرائط جوجل' };
                    ws[mapCell].v = 'فتح الخريطة';
                }
            }
            
            // Album link
            if (albumColIndex >= 0) {
                const albumCell = XLSX.utils.encode_cell({ r: row, c: albumColIndex });
                if (ws[albumCell] && ws[albumCell].v) {
                    ws[albumCell].l = { Target: ws[albumCell].v, Tooltip: 'عرض ألبوم الصور' };
                    ws[albumCell].v = 'عرض الصور';
                }
            }
        }

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'الأصول');

        // Add summary sheet
        const summaryData = generateExportSummary(exportAssets);
        const summaryWs = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, 'ملخص');

        // Save file
        XLSX.writeFile(wb, `${filename}.xlsx`);
        
        showToast('تم تصدير الملف بنجاح', 'success');
        
        // Log activity
        await logActivity('export', 'تصدير بيانات Excel', {
            count: exportAssets.length,
            filename: `${filename}.xlsx`
        });

    } catch (error) {
        console.error('Export error:', error);
        showToast('فشل التصدير: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Generate export summary
 */
function generateExportSummary(assets) {
    const summary = [];

    // Total assets
    summary.push({ 'البند': 'إجمالي الأصول', 'القيمة': assets.length });

    // Total value
    const totalValue = assets.reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0);
    summary.push({ 'البند': 'القيمة الإجمالية', 'القيمة': totalValue.toLocaleString('ar-SA') + ' ريال' });

    // By condition
    const conditions = {};
    assets.forEach(a => {
        const condition = a.condition || 'غير محدد';
        conditions[condition] = (conditions[condition] || 0) + 1;
    });
    Object.entries(conditions).forEach(([condition, count]) => {
        summary.push({ 'البند': `الحالة: ${condition}`, 'القيمة': count });
    });

    // By category
    const categories = {};
    assets.forEach(a => {
        const category = a.category || 'غير مصنف';
        categories[category] = (categories[category] || 0) + 1;
    });
    summary.push({ 'البند': '---', 'القيمة': '---' });
    summary.push({ 'البند': 'التوزيع حسب الفئات', 'القيمة': '' });
    Object.entries(categories).forEach(([category, count]) => {
        summary.push({ 'البند': category, 'القيمة': count });
    });

    // Export metadata
    summary.push({ 'البند': '---', 'القيمة': '---' });
    summary.push({ 'البند': 'تاريخ التصدير', 'القيمة': new Date().toLocaleString('ar-SA') });
    summary.push({ 'البند': 'صدّر بواسطة', 'القيمة': currentUserData?.displayName || currentUserData?.username || 'غير معروف' });

    return summary;
}

/**
 * Export to PDF with enhanced formatting
 */
async function exportToPDFEnhanced(assets, options = {}) {
    const {
        filename = `assets_report_${new Date().toISOString().split('T')[0]}`,
        title = 'تقرير جرد الأصول',
        includeMapLinks = true,
        includePhotos = false,
        filterBySession = null
    } = options;

    showLoading();

    try {
        // Filter by session if specified
        let exportAssets = filterBySession 
            ? assets.filter(a => a.sessionId === filterBySession)
            : assets;

        // Create PDF content
        const { jsPDF } = window.jspdf || await loadJsPDF();
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Add Arabic font support
        doc.addFont('https://cdn.jsdelivr.net/npm/@aspect-fonts/tajawal@0.0.2/fonts/Tajawal-Regular.ttf', 'Tajawal', 'normal');
        doc.setFont('Tajawal');

        // Header
        doc.setFontSize(20);
        doc.text(title, 148, 15, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}`, 270, 25, { align: 'right' });
        doc.text(`عدد الأصول: ${exportAssets.length}`, 270, 30, { align: 'right' });

        // Table
        const tableData = exportAssets.map(asset => [
            asset.code || '',
            asset.name || '',
            asset.category || '',
            asset.condition || '',
            asset.location || '',
            asset.assignee || '',
            (asset.value || 0).toLocaleString('ar-SA'),
            asset.gpsLocation?.latitude ? 'متوفر' : '-'
        ]);

        doc.autoTable({
            head: [['رقم الأصل', 'الاسم', 'الفئة', 'الحالة', 'الموقع', 'المسؤول', 'القيمة', 'GPS']],
            body: tableData,
            startY: 40,
            styles: {
                font: 'Tajawal',
                halign: 'right',
                fontSize: 8
            },
            headStyles: {
                fillColor: [30, 64, 175],
                textColor: 255
            },
            alternateRowStyles: {
                fillColor: [245, 247, 250]
            }
        });

        // Save
        doc.save(`${filename}.pdf`);
        
        showToast('تم تصدير PDF بنجاح', 'success');
        
        await logActivity('export', 'تصدير تقرير PDF', {
            count: exportAssets.length,
            filename: `${filename}.pdf`
        });

    } catch (error) {
        console.error('PDF export error:', error);
        showToast('فشل تصدير PDF: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Load jsPDF library
 */
async function loadJsPDF() {
    if (window.jspdf) return window.jspdf;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
        script.onload = () => {
            // Also load autoTable plugin
            const autoTableScript = document.createElement('script');
            autoTableScript.src = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.1/dist/jspdf.plugin.autotable.min.js';
            autoTableScript.onload = () => resolve(window.jspdf);
            autoTableScript.onerror = reject;
            document.head.appendChild(autoTableScript);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Export to CSV
 */
function exportToCSV(assets, filename = 'assets_export') {
    showLoading();

    try {
        const headers = [
            'رقم الأصل', 'اسم الأصل', 'الفئة', 'الحالة', 'الموقع',
            'المسؤول', 'القسم', 'القيمة', 'تاريخ الإضافة', 'رابط الخريطة'
        ];

        const rows = assets.map(asset => [
            asset.code || '',
            asset.name || '',
            asset.category || '',
            asset.condition || '',
            asset.location || '',
            asset.assignee || '',
            asset.department || '',
            asset.value || 0,
            asset.createdAt ? new Date(asset.createdAt).toLocaleDateString('ar-SA') : '',
            asset.gpsLocation?.latitude 
                ? generateGoogleMapsLink(asset.gpsLocation.latitude, asset.gpsLocation.longitude)
                : ''
        ]);

        // Add BOM for UTF-8
        let csvContent = '\uFEFF' + headers.join(',') + '\n';
        
        rows.forEach(row => {
            csvContent += row.map(cell => {
                // Escape quotes and wrap in quotes if contains comma
                const cellStr = String(cell).replace(/"/g, '""');
                return cellStr.includes(',') ? `"${cellStr}"` : cellStr;
            }).join(',') + '\n';
        });

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.csv`;
        link.click();
        
        showToast('تم تصدير CSV بنجاح', 'success');

    } catch (error) {
        console.error('CSV export error:', error);
        showToast('فشل التصدير', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Export session report
 */
async function exportSessionReport(sessionId) {
    const session = getSessionById(sessionId);
    if (!session) {
        showToast('جلسة الجرد غير موجودة', 'error');
        return;
    }

    const sessionAssets = APP_STATE.assets.filter(a => a.sessionId === sessionId);
    const stats = getSessionStats(sessionId);

    await exportToExcelWithLinks(sessionAssets, {
        filename: `session_${session.name}_${new Date().toISOString().split('T')[0]}`,
        includeSessionInfo: true,
        filterBySession: sessionId
    });
}

/**
 * Export user performance report
 */
async function exportUserReport(userId, dateRange = null) {
    let userAssets = APP_STATE.assets.filter(a => a.createdBy === userId);
    
    if (dateRange) {
        userAssets = userAssets.filter(a => {
            const date = new Date(a.createdAt);
            return date >= dateRange.start && date <= dateRange.end;
        });
    }

    const user = await dbGet('users', userId);
    const filename = `user_${user?.username || userId}_report_${new Date().toISOString().split('T')[0]}`;

    await exportToExcelWithLinks(userAssets, {
        filename,
        includeSessionInfo: true
    });
}

/**
 * Open export dialog
 */
function openExportDialog() {
    const modalContent = `
        <div class="p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">خيارات التصدير</h3>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">نوع التصدير</label>
                    <select id="exportType" class="w-full p-3 border rounded-lg">
                        <option value="excel">Excel مع روابط</option>
                        <option value="pdf">PDF تقرير</option>
                        <option value="csv">CSV</option>
                    </select>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">نطاق البيانات</label>
                    <select id="exportScope" class="w-full p-3 border rounded-lg">
                        <option value="all">جميع الأصول</option>
                        <option value="filtered">الأصول المفلترة حالياً</option>
                        <option value="session">جلسة جرد محددة</option>
                    </select>
                </div>
                
                <div id="sessionSelectContainer" class="hidden">
                    <label class="block text-sm font-medium text-gray-700 mb-2">اختر الجلسة</label>
                    <select id="exportSessionSelect" class="w-full p-3 border rounded-lg">
                        ${getFilteredSessions().map(s => `
                            <option value="${s.id}">${s.name}</option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="flex items-center gap-4">
                    <label class="flex items-center gap-2">
                        <input type="checkbox" id="includeMapLinks" checked class="rounded">
                        <span class="text-sm">تضمين روابط الخرائط</span>
                    </label>
                    <label class="flex items-center gap-2">
                        <input type="checkbox" id="includePhotoLinks" checked class="rounded">
                        <span class="text-sm">تضمين روابط الصور</span>
                    </label>
                </div>
            </div>
            
            <div class="mt-6 flex gap-3">
                <button onclick="executeExport()" class="flex-1 bg-gov-blue text-white py-3 rounded-lg hover:bg-gov-blue-light">
                    <i class="fas fa-download ml-2"></i> تصدير
                </button>
                <button onclick="closeCustomModal()" class="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                    إلغاء
                </button>
            </div>
        </div>
    `;

    showCustomModal('تصدير البيانات', modalContent);

    // Handle scope change
    document.getElementById('exportScope')?.addEventListener('change', (e) => {
        const sessionContainer = document.getElementById('sessionSelectContainer');
        if (sessionContainer) {
            sessionContainer.classList.toggle('hidden', e.target.value !== 'session');
        }
    });
}

/**
 * Execute export based on dialog options
 */
async function executeExport() {
    const type = document.getElementById('exportType')?.value || 'excel';
    const scope = document.getElementById('exportScope')?.value || 'all';
    const includeMapLinks = document.getElementById('includeMapLinks')?.checked ?? true;
    const includePhotoLinks = document.getElementById('includePhotoLinks')?.checked ?? true;

    let assetsToExport = APP_STATE.assets;

    // Filter by scope
    if (scope === 'filtered') {
        // Use currently filtered assets from the table
        assetsToExport = getFilteredAssetsList();
    } else if (scope === 'session') {
        const sessionId = document.getElementById('exportSessionSelect')?.value;
        assetsToExport = APP_STATE.assets.filter(a => a.sessionId === sessionId);
    }

    // Apply role-based filtering
    assetsToExport = filterAssetsForUser(assetsToExport);

    closeCustomModal();

    // Execute export
    switch (type) {
        case 'excel':
            await exportToExcelWithLinks(assetsToExport, {
                includeMapLinks,
                includePhotoLinks
            });
            break;
        case 'pdf':
            await exportToPDFEnhanced(assetsToExport, {
                includeMapLinks
            });
            break;
        case 'csv':
            exportToCSV(assetsToExport);
            break;
    }
}

/**
 * Get currently filtered assets list
 */
function getFilteredAssetsList() {
    // This should return the assets currently shown in the table after filtering
    // Implementation depends on how filtering is done in the main app
    const searchTerm = document.getElementById('assetSearch')?.value?.toLowerCase() || '';
    const categoryFilter = document.getElementById('categoryFilter')?.value || '';
    const conditionFilter = document.getElementById('conditionFilter')?.value || '';
    const departmentFilter = document.getElementById('departmentFilter')?.value || '';

    return APP_STATE.assets.filter(asset => {
        let matches = true;
        
        if (searchTerm) {
            matches = matches && (
                asset.name?.toLowerCase().includes(searchTerm) ||
                asset.code?.toLowerCase().includes(searchTerm) ||
                asset.serialNumber?.toLowerCase().includes(searchTerm)
            );
        }
        
        if (categoryFilter) {
            matches = matches && asset.category === categoryFilter;
        }
        
        if (conditionFilter) {
            matches = matches && asset.condition === conditionFilter;
        }
        
        if (departmentFilter) {
            matches = matches && asset.department === departmentFilter;
        }
        
        return matches;
    });
}

/**
 * Export functions for global use
 */
window.ExportManager = {
    toExcel: exportToExcelWithLinks,
    toPDF: exportToPDFEnhanced,
    toCSV: exportToCSV,
    sessionReport: exportSessionReport,
    userReport: exportUserReport,
    openDialog: openExportDialog
};
