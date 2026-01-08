/**
 * Enhanced Export Module with Hyperlinks
 * نظام التصدير المحسن مع الروابط
 * Version 6.0
 */

// === Export Formats ===
const EXPORT_FORMATS = {
    EXCEL: 'excel',
    PDF: 'pdf',
    CSV: 'csv',
    JSON: 'json'
};

// === Export Assets to Excel with Hyperlinks ===
async function exportAssetsToExcel(assets, options = {}) {
    const {
        filename = `تقرير_الأصول_${formatDate(new Date())}`,
        includePhotos = true,
        includeLocation = true,
        sessionInfo = null,
        branchInfo = null
    } = options;
    
    showLoading();
    
    try {
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Prepare data with hyperlinks
        const data = await prepareExportData(assets, { includePhotos, includeLocation });
        
        // Create main sheet
        const ws = XLSX.utils.json_to_sheet(data.rows);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 15 }, // كود الأصل
            { wch: 25 }, // اسم الأصل
            { wch: 15 }, // الفئة 1
            { wch: 15 }, // الفئة 2
            { wch: 15 }, // الفئة 3
            { wch: 15 }, // الإدارة
            { wch: 15 }, // المبنى
            { wch: 10 }, // الدور
            { wch: 15 }, // الغرفة
            { wch: 10 }, // الحالة
            { wch: 15 }, // المورد
            { wch: 15 }, // تاريخ الشراء
            { wch: 15 }, // سعر الشراء
            { wch: 15 }, // القيمة الحالية
            { wch: 20 }, // المسؤول
            { wch: 20 }, // القائم بالجرد
            { wch: 20 }, // تاريخ التسجيل
            { wch: 25 }, // الموقع على الخريطة
            { wch: 25 }, // ألبوم الصور
            { wch: 30 }  // ملاحظات
        ];
        
        // Add hyperlinks for map and photos columns
        data.hyperlinks.forEach(link => {
            const cellRef = link.cell;
            if (!ws[cellRef]) {
                ws[cellRef] = { t: 's', v: link.display };
            }
            ws[cellRef].l = { Target: link.url, Tooltip: link.tooltip };
        });
        
        // Add to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'الأصول');
        
        // Add summary sheet
        const summaryData = createSummarySheet(assets, sessionInfo, branchInfo);
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, 'ملخص');
        
        // Add statistics sheet
        const statsData = createStatisticsSheet(assets);
        const statsWs = XLSX.utils.aoa_to_sheet(statsData);
        XLSX.utils.book_append_sheet(wb, statsWs, 'إحصائيات');
        
        // Generate and download
        XLSX.writeFile(wb, `${filename}.xlsx`);
        
        showToast('تم تصدير الملف بنجاح', 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showToast('حدث خطأ أثناء التصدير', 'error');
    } finally {
        hideLoading();
    }
}

// === Prepare Export Data with Hyperlinks ===
async function prepareExportData(assets, options = {}) {
    const { includePhotos, includeLocation } = options;
    
    const rows = [];
    const hyperlinks = [];
    
    for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const rowNum = i + 2; // Excel rows start at 1, header is row 1
        
        // Get location data - support both gpsLocation object and direct latitude/longitude fields
        let locationLink = '';
        let locationUrl = '';
        const lat = asset.gpsLocation?.latitude || asset.latitude;
        const lng = asset.gpsLocation?.longitude || asset.longitude;
        
        if (includeLocation && lat && lng) {
            locationUrl = `https://www.google.com/maps?q=${lat},${lng}`;
            locationLink = 'فتح الخريطة';
            
            hyperlinks.push({
                cell: `R${rowNum}`,
                url: locationUrl,
                display: 'فتح الخريطة',
                tooltip: `الموقع: ${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`
            });
        } else if (asset.googleMapsLink) {
            // Use pre-generated Google Maps link
            locationUrl = asset.googleMapsLink;
            locationLink = 'فتح الخريطة';
            
            hyperlinks.push({
                cell: `R${rowNum}`,
                url: locationUrl,
                display: 'فتح الخريطة',
                tooltip: 'فتح الموقع على خرائط Google'
            });
        }
        
        // Get photos album link - single link for all photos
        let photosLink = '';
        let photosUrl = '';
        if (includePhotos && asset.images && asset.images.length > 0) {
            // Generate single album URL for this asset
            photosUrl = generateAlbumViewerUrl(asset.id, asset.code || asset.name);
            photosLink = `عرض الصور (${asset.images.length})`;
            
            hyperlinks.push({
                cell: `S${rowNum}`,
                url: photosUrl,
                display: photosLink,
                tooltip: `ألبوم صور الأصل ${asset.name} - ${asset.images.length} صورة`
            });
        }
        
        rows.push({
            'كود الأصل': asset.code || '',
            'اسم الأصل': asset.name || '',
            'الفئة الرئيسية': asset.category || '',
            'الفئة الفرعية': asset.category2 || '',
            'الفئة التفصيلية': asset.category3 || '',
            'الإدارة/القسم': asset.department || '',
            'المبنى': asset.building || '',
            'الدور/الطابق': asset.floor || '',
            'الغرفة/المكتب': asset.room || '',
            'الحالة': asset.condition || '',
            'المورد': asset.supplier || '',
            'تاريخ الشراء': asset.purchaseDate || '',
            'سعر الشراء': asset.purchasePrice || '',
            'القيمة الحالية': asset.currentValue || '',
            'المسؤول': asset.assignee || '',
            'القائم بالجرد': asset.inventoryPerson || '',
            'تاريخ التسجيل': formatDateTime(asset.createdAt) || '',
            'الموقع على الخريطة': locationLink,
            'ألبوم الصور': photosLink,
            'ملاحظات': asset.notes || ''
        });
    }
    
    return { rows, hyperlinks };
}

// === Create Summary Sheet ===
function createSummarySheet(assets, sessionInfo, branchInfo) {
    const summary = [
        ['تقرير جرد الأصول'],
        [''],
        ['معلومات التقرير'],
        ['تاريخ التصدير', formatDateTime(new Date())],
        ['عدد الأصول', assets.length],
        [''],
    ];
    
    if (sessionInfo) {
        summary.push(
            ['معلومات جلسة الجرد'],
            ['اسم الجلسة', sessionInfo.name],
            ['الفرع', sessionInfo.branchName],
            ['تاريخ البداية', sessionInfo.startDate],
            ['تاريخ النهاية', sessionInfo.endDate],
            ['نسبة الإنجاز', `${sessionInfo.progress}%`],
            ['']
        );
    }
    
    if (branchInfo) {
        summary.push(
            ['معلومات الفرع'],
            ['اسم الفرع', branchInfo.name],
            ['الرمز', branchInfo.code],
            ['العنوان', branchInfo.address],
            ['']
        );
    }
    
    // Add condition summary
    const conditionCounts = {};
    assets.forEach(a => {
        const cond = a.condition || 'غير محدد';
        conditionCounts[cond] = (conditionCounts[cond] || 0) + 1;
    });
    
    summary.push(['توزيع حالة الأصول']);
    Object.entries(conditionCounts).forEach(([cond, count]) => {
        summary.push([cond, count]);
    });
    
    return summary;
}

// === Create Statistics Sheet ===
function createStatisticsSheet(assets) {
    const stats = [
        ['إحصائيات الأصول'],
        [''],
    ];
    
    // By category
    const categoryCounts = {};
    assets.forEach(a => {
        const cat = a.category || 'غير مصنف';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    
    stats.push(['توزيع حسب الفئة الرئيسية']);
    stats.push(['الفئة', 'العدد', 'النسبة']);
    Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => {
            stats.push([cat, count, `${((count / assets.length) * 100).toFixed(1)}%`]);
        });
    
    stats.push(['']);
    
    // By department
    const deptCounts = {};
    assets.forEach(a => {
        const dept = a.department || 'غير محدد';
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });
    
    stats.push(['توزيع حسب الإدارة']);
    stats.push(['الإدارة', 'العدد', 'النسبة']);
    Object.entries(deptCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([dept, count]) => {
            stats.push([dept, count, `${((count / assets.length) * 100).toFixed(1)}%`]);
        });
    
    stats.push(['']);
    
    // By building
    const buildingCounts = {};
    assets.forEach(a => {
        const bld = a.building || 'غير محدد';
        buildingCounts[bld] = (buildingCounts[bld] || 0) + 1;
    });
    
    stats.push(['توزيع حسب المبنى']);
    stats.push(['المبنى', 'العدد', 'النسبة']);
    Object.entries(buildingCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([bld, count]) => {
            stats.push([bld, count, `${((count / assets.length) * 100).toFixed(1)}%`]);
        });
    
    // Value statistics
    stats.push(['']);
    stats.push(['إحصائيات القيمة']);
    
    const values = assets.map(a => parseFloat(a.purchasePrice) || 0).filter(v => v > 0);
    if (values.length > 0) {
        const totalValue = values.reduce((a, b) => a + b, 0);
        const avgValue = totalValue / values.length;
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);
        
        stats.push(['إجمالي القيمة', formatCurrency(totalValue)]);
        stats.push(['متوسط القيمة', formatCurrency(avgValue)]);
        stats.push(['أعلى قيمة', formatCurrency(maxValue)]);
        stats.push(['أقل قيمة', formatCurrency(minValue)]);
    }
    
    return stats;
}

// === Export to PDF ===
async function exportAssetsToPDF(assets, options = {}) {
    const {
        filename = `تقرير_الأصول_${formatDate(new Date())}`,
        title = 'تقرير جرد الأصول',
        sessionInfo = null,
        branchInfo = null
    } = options;
    
    showLoading();
    
    try {
        // Check if jsPDF is loaded
        if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
            // Load jsPDF dynamically
            await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
            await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.31/dist/jspdf.plugin.autotable.min.js');
        }
        
        const { jsPDF } = window.jspdf || window;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });
        
        // Set RTL font (Arabic support)
        doc.setR2L(true);
        
        // Title
        doc.setFontSize(18);
        doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
        
        // Date
        doc.setFontSize(10);
        doc.text(`تاريخ التصدير: ${formatDateTime(new Date())}`, doc.internal.pageSize.getWidth() - 15, 25, { align: 'right' });
        
        // Session info
        let yPos = 35;
        if (sessionInfo) {
            doc.setFontSize(12);
            doc.text(`جلسة الجرد: ${sessionInfo.name}`, doc.internal.pageSize.getWidth() - 15, yPos, { align: 'right' });
            yPos += 7;
        }
        
        if (branchInfo) {
            doc.text(`الفرع: ${branchInfo.name}`, doc.internal.pageSize.getWidth() - 15, yPos, { align: 'right' });
            yPos += 7;
        }
        
        // Table data
        const tableData = assets.map(asset => [
            asset.code || '',
            asset.name || '',
            asset.category || '',
            asset.department || '',
            asset.building || '',
            asset.condition || '',
            formatCurrency(asset.purchasePrice) || '',
            asset.assignee || ''
        ]);
        
        // Create table
        doc.autoTable({
            head: [['كود الأصل', 'اسم الأصل', 'الفئة', 'الإدارة', 'المبنى', 'الحالة', 'القيمة', 'المسؤول']],
            body: tableData,
            startY: yPos + 5,
            styles: {
                font: 'helvetica',
                fontSize: 8,
                halign: 'right'
            },
            headStyles: {
                fillColor: [30, 64, 175],
                textColor: [255, 255, 255],
                halign: 'right'
            },
            alternateRowStyles: {
                fillColor: [245, 247, 250]
            }
        });
        
        // Save
        doc.save(`${filename}.pdf`);
        
        showToast('تم تصدير الملف بنجاح', 'success');
        
    } catch (error) {
        console.error('PDF Export error:', error);
        showToast('حدث خطأ أثناء تصدير PDF', 'error');
    } finally {
        hideLoading();
    }
}

// === Export to CSV ===
function exportAssetsToCSV(assets, options = {}) {
    const { filename = `تقرير_الأصول_${formatDate(new Date())}` } = options;
    
    const headers = [
        'كود الأصل', 'اسم الأصل', 'الفئة الرئيسية', 'الفئة الفرعية', 'الفئة التفصيلية',
        'الإدارة', 'المبنى', 'الدور', 'الغرفة', 'الحالة', 'المورد', 'تاريخ الشراء',
        'سعر الشراء', 'القيمة الحالية', 'المسؤول', 'القائم بالجرد', 'خط العرض', 'خط الطول',
        'رابط الخريطة', 'ملاحظات'
    ];
    
    const rows = assets.map(asset => {
        const lat = asset.gpsLocation?.latitude || '';
        const lng = asset.gpsLocation?.longitude || '';
        const mapsLink = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : '';
        
        return [
            asset.code || '',
            asset.name || '',
            asset.category || '',
            asset.category2 || '',
            asset.category3 || '',
            asset.department || '',
            asset.building || '',
            asset.floor || '',
            asset.room || '',
            asset.condition || '',
            asset.supplier || '',
            asset.purchaseDate || '',
            asset.purchasePrice || '',
            asset.currentValue || '',
            asset.assignee || '',
            asset.inventoryPerson || '',
            lat,
            lng,
            mapsLink,
            asset.notes || ''
        ];
    });
    
    // Create CSV content
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Add BOM for UTF-8
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    
    showToast('تم تصدير الملف بنجاح', 'success');
}

// === Export Session Report ===
async function exportSessionReport(sessionId, format = EXPORT_FORMATS.EXCEL) {
    const session = await dbGet(SESSIONS_STORE, sessionId);
    if (!session) {
        showToast('جلسة الجرد غير موجودة', 'error');
        return;
    }
    
    // Get all scans for this session
    const allScans = await dbGetAll('session_scans');
    const sessionScans = allScans.filter(s => s.sessionId === sessionId);
    
    // Get assets for these scans
    const assetIds = [...new Set(sessionScans.map(s => s.assetId))];
    const allAssets = await dbGetAll(STORES.assets);
    const sessionAssets = allAssets.filter(a => assetIds.includes(a.id));
    
    // Get branch info
    const branches = await getBranches();
    const branch = branches.find(b => b.id === session.branch);
    
    const options = {
        filename: `تقرير_${session.name.replace(/\s+/g, '_')}`,
        sessionInfo: session,
        branchInfo: branch,
        includePhotos: true,
        includeLocation: true
    };
    
    switch (format) {
        case EXPORT_FORMATS.EXCEL:
            await exportAssetsToExcel(sessionAssets, options);
            break;
        case EXPORT_FORMATS.PDF:
            await exportAssetsToPDF(sessionAssets, options);
            break;
        case EXPORT_FORMATS.CSV:
            exportAssetsToCSV(sessionAssets, options);
            break;
        default:
            await exportAssetsToExcel(sessionAssets, options);
    }
}

// === Export Worker Performance Report ===
async function exportWorkerReport(userId, sessionId = null) {
    const users = await getUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        showToast('المستخدم غير موجود', 'error');
        return;
    }
    
    // Get all scans by this user
    const allScans = await dbGetAll('session_scans');
    let userScans = allScans.filter(s => s.scannedBy === userId);
    
    if (sessionId) {
        userScans = userScans.filter(s => s.sessionId === sessionId);
    }
    
    // Get assets
    const assetIds = [...new Set(userScans.map(s => s.assetId))];
    const allAssets = await dbGetAll(STORES.assets);
    const userAssets = allAssets.filter(a => assetIds.includes(a.id));
    
    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summary = [
        ['تقرير أداء العامل'],
        [''],
        ['اسم العامل', user.name],
        ['الرقم الوظيفي', user.employeeId],
        ['الفرع', user.branch],
        [''],
        ['إحصائيات الأداء'],
        ['إجمالي الأصول الممسوحة', userScans.length],
        ['عدد الأيام', new Set(userScans.map(s => s.scannedAt.split('T')[0])).size],
        ['متوسط يومي', (userScans.length / Math.max(1, new Set(userScans.map(s => s.scannedAt.split('T')[0])).size)).toFixed(1)]
    ];
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'ملخص');
    
    // Daily breakdown
    const dailyStats = {};
    userScans.forEach(scan => {
        const date = scan.scannedAt.split('T')[0];
        dailyStats[date] = (dailyStats[date] || 0) + 1;
    });
    
    const dailyData = [['التاريخ', 'عدد الأصول']];
    Object.entries(dailyStats)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([date, count]) => {
            dailyData.push([date, count]);
        });
    
    const dailyWs = XLSX.utils.aoa_to_sheet(dailyData);
    XLSX.utils.book_append_sheet(wb, dailyWs, 'التفصيل اليومي');
    
    // Assets list
    const data = await prepareExportData(userAssets, { includePhotos: true, includeLocation: true });
    const assetsWs = XLSX.utils.json_to_sheet(data.rows);
    XLSX.utils.book_append_sheet(wb, assetsWs, 'الأصول');
    
    // Save
    XLSX.writeFile(wb, `تقرير_أداء_${user.name.replace(/\s+/g, '_')}_${formatDate(new Date())}.xlsx`);
    
    showToast('تم تصدير التقرير بنجاح', 'success');
}

// === Helper: Load Script Dynamically ===
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// === Helper: Format Currency ===
function formatCurrency(value) {
    if (!value) return '';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' });
}

// === Helper: Format Date ===
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

// === Helper: Format DateTime ===
function formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('ar-SA');
}

// === Export for global access ===
window.EXPORT_FORMATS = EXPORT_FORMATS;
window.exportAssetsToExcel = exportAssetsToExcel;
window.exportAssetsToPDF = exportAssetsToPDF;
window.exportAssetsToCSV = exportAssetsToCSV;
window.exportSessionReport = exportSessionReport;
window.exportWorkerReport = exportWorkerReport;
window.formatCurrency = formatCurrency;
