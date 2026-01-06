/**
 * Notifications Module
 * نظام الإشعارات والتنبيهات
 * Version 6.0
 */

// === Notification Types ===
const NOTIFICATION_TYPES = {
    SYNC_SUCCESS: 'sync_success',
    SYNC_FAILED: 'sync_failed',
    SYNC_CONFLICT: 'sync_conflict',
    NEW_ASSET: 'new_asset',
    ASSET_UPDATED: 'asset_updated',
    ASSET_DELETED: 'asset_deleted',
    SESSION_STARTED: 'session_started',
    SESSION_COMPLETED: 'session_completed',
    USER_ACTIVITY: 'user_activity',
    SYSTEM_ALERT: 'system_alert',
    MAINTENANCE_DUE: 'maintenance_due',
    WARRANTY_EXPIRING: 'warranty_expiring'
};

// === Notification State ===
let NOTIFICATION_STATE = {
    notifications: [],
    unreadCount: 0,
    soundEnabled: true,
    desktopEnabled: false,
    pollingInterval: null
};

// === Initialize Notifications ===
async function initializeNotifications() {
    // Load saved notifications
    await loadNotifications();
    
    // Request desktop notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        NOTIFICATION_STATE.desktopEnabled = permission === 'granted';
    } else if (Notification.permission === 'granted') {
        NOTIFICATION_STATE.desktopEnabled = true;
    }
    
    // Load settings
    const settings = await dbGet(STORES.settings, 'notificationSettings');
    if (settings) {
        NOTIFICATION_STATE.soundEnabled = settings.value.soundEnabled !== false;
    }
    
    // Update badge
    updateNotificationBadge();
    
    // Start real-time polling for admin/manager
    if (AUTH_STATE.userRole === USER_ROLES.ADMIN || AUTH_STATE.userRole === USER_ROLES.MANAGER) {
        startNotificationPolling();
    }
    
    console.log('Notifications initialized');
}

// === Load Notifications ===
async function loadNotifications() {
    try {
        const notifications = await dbGetAll('notifications');
        
        // Filter by user/role
        NOTIFICATION_STATE.notifications = notifications.filter(n => {
            if (AUTH_STATE.userRole === USER_ROLES.ADMIN) return true;
            if (n.targetUserId === AUTH_STATE.currentUser?.id) return true;
            if (n.targetRole === AUTH_STATE.userRole) return true;
            if (n.targetBranch === AUTH_STATE.userBranch) return true;
            return false;
        });
        
        // Sort by date descending
        NOTIFICATION_STATE.notifications.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        // Count unread
        NOTIFICATION_STATE.unreadCount = NOTIFICATION_STATE.notifications.filter(n => !n.read).length;
        
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// === Create Notification ===
async function createNotification(type, title, message, data = {}) {
    const notification = {
        id: generateId('notif'),
        type,
        title,
        message,
        data,
        read: false,
        createdAt: new Date().toISOString(),
        createdBy: AUTH_STATE.currentUser?.id,
        targetUserId: data.targetUserId || null,
        targetRole: data.targetRole || null,
        targetBranch: data.targetBranch || AUTH_STATE.userBranch
    };
    
    await dbPut('notifications', notification);
    
    // If it's for current user, add to state and show
    if (shouldShowNotification(notification)) {
        NOTIFICATION_STATE.notifications.unshift(notification);
        NOTIFICATION_STATE.unreadCount++;
        
        updateNotificationBadge();
        showInAppNotification(notification);
        
        if (NOTIFICATION_STATE.desktopEnabled) {
            showDesktopNotification(notification);
        }
        
        if (NOTIFICATION_STATE.soundEnabled) {
            playNotificationSound();
        }
    }
    
    return notification;
}

// === Check if Should Show Notification ===
function shouldShowNotification(notification) {
    if (AUTH_STATE.userRole === USER_ROLES.ADMIN) return true;
    if (notification.targetUserId === AUTH_STATE.currentUser?.id) return true;
    if (notification.targetRole === AUTH_STATE.userRole) return true;
    if (notification.targetBranch === AUTH_STATE.userBranch) return true;
    return false;
}

// === Mark as Read ===
async function markNotificationAsRead(notificationId) {
    const notification = NOTIFICATION_STATE.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
        
        await dbPut('notifications', notification);
        NOTIFICATION_STATE.unreadCount = Math.max(0, NOTIFICATION_STATE.unreadCount - 1);
        updateNotificationBadge();
    }
}

// === Mark All as Read ===
async function markAllNotificationsAsRead() {
    for (const notification of NOTIFICATION_STATE.notifications) {
        if (!notification.read) {
            notification.read = true;
            notification.readAt = new Date().toISOString();
            await dbPut('notifications', notification);
        }
    }
    
    NOTIFICATION_STATE.unreadCount = 0;
    updateNotificationBadge();
}

// === Delete Notification ===
async function deleteNotification(notificationId) {
    await dbDelete('notifications', notificationId);
    
    const index = NOTIFICATION_STATE.notifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
        if (!NOTIFICATION_STATE.notifications[index].read) {
            NOTIFICATION_STATE.unreadCount--;
        }
        NOTIFICATION_STATE.notifications.splice(index, 1);
        updateNotificationBadge();
    }
}

// === Clear All Notifications ===
async function clearAllNotifications() {
    for (const notification of NOTIFICATION_STATE.notifications) {
        await dbDelete('notifications', notification.id);
    }
    
    NOTIFICATION_STATE.notifications = [];
    NOTIFICATION_STATE.unreadCount = 0;
    updateNotificationBadge();
}

// === Update Badge ===
function updateNotificationBadge() {
    const badges = document.querySelectorAll('.notification-badge');
    badges.forEach(badge => {
        if (NOTIFICATION_STATE.unreadCount > 0) {
            badge.textContent = NOTIFICATION_STATE.unreadCount > 99 ? '99+' : NOTIFICATION_STATE.unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

// === Show In-App Notification (Toast) ===
function showInAppNotification(notification) {
    const iconMap = {
        [NOTIFICATION_TYPES.SYNC_SUCCESS]: 'fa-check-circle text-green-500',
        [NOTIFICATION_TYPES.SYNC_FAILED]: 'fa-times-circle text-red-500',
        [NOTIFICATION_TYPES.SYNC_CONFLICT]: 'fa-exclamation-triangle text-yellow-500',
        [NOTIFICATION_TYPES.NEW_ASSET]: 'fa-plus-circle text-blue-500',
        [NOTIFICATION_TYPES.ASSET_UPDATED]: 'fa-edit text-blue-500',
        [NOTIFICATION_TYPES.ASSET_DELETED]: 'fa-trash text-red-500',
        [NOTIFICATION_TYPES.SESSION_STARTED]: 'fa-play-circle text-green-500',
        [NOTIFICATION_TYPES.SESSION_COMPLETED]: 'fa-check-double text-green-500',
        [NOTIFICATION_TYPES.USER_ACTIVITY]: 'fa-user-clock text-purple-500',
        [NOTIFICATION_TYPES.SYSTEM_ALERT]: 'fa-bell text-orange-500',
        [NOTIFICATION_TYPES.MAINTENANCE_DUE]: 'fa-wrench text-orange-500',
        [NOTIFICATION_TYPES.WARRANTY_EXPIRING]: 'fa-calendar-times text-red-500'
    };
    
    const icon = iconMap[notification.type] || 'fa-bell text-gray-500';
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'notification-toast fixed top-4 left-4 z-[100] bg-white rounded-xl shadow-lg p-4 max-w-sm transform translate-x-[-120%] transition-transform duration-300';
    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="flex-shrink-0">
                <i class="fas ${icon} text-xl"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-900 text-sm">${notification.title}</p>
                <p class="text-gray-600 text-xs mt-1 line-clamp-2">${notification.message}</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" 
                    class="flex-shrink-0 text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(-120%)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// === Show Desktop Notification ===
function showDesktopNotification(notification) {
    if (!NOTIFICATION_STATE.desktopEnabled) return;
    
    const options = {
        body: notification.message,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: notification.id,
        requireInteraction: notification.type === NOTIFICATION_TYPES.SYNC_CONFLICT
    };
    
    const desktopNotif = new Notification(notification.title, options);
    
    desktopNotif.onclick = () => {
        window.focus();
        markNotificationAsRead(notification.id);
        handleNotificationClick(notification);
        desktopNotif.close();
    };
}

// === Handle Notification Click ===
function handleNotificationClick(notification) {
    switch (notification.type) {
        case NOTIFICATION_TYPES.NEW_ASSET:
        case NOTIFICATION_TYPES.ASSET_UPDATED:
            if (notification.data.assetId) {
                showPage('assets');
                // Could open asset details
            }
            break;
        case NOTIFICATION_TYPES.SESSION_STARTED:
        case NOTIFICATION_TYPES.SESSION_COMPLETED:
            showPage('inventory');
            break;
        case NOTIFICATION_TYPES.SYNC_CONFLICT:
            showSyncConflictModal(notification.data);
            break;
        case NOTIFICATION_TYPES.MAINTENANCE_DUE:
            showPage('maintenance');
            break;
        default:
            // Open notifications panel
            toggleNotificationsPanel();
    }
}

// === Play Notification Sound ===
function playNotificationSound() {
    if (!NOTIFICATION_STATE.soundEnabled) return;
    
    try {
        // Use Web Audio API for a simple notification sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.log('Could not play notification sound');
    }
}

// === Toggle Notifications Panel ===
function toggleNotificationsPanel() {
    let panel = document.getElementById('notificationsPanel');
    
    if (panel) {
        panel.remove();
        return;
    }
    
    panel = document.createElement('div');
    panel.id = 'notificationsPanel';
    panel.className = 'fixed top-16 left-4 z-50 w-96 max-h-[80vh] bg-white rounded-xl shadow-2xl overflow-hidden';
    
    panel.innerHTML = `
        <div class="bg-gov-blue text-white p-4 flex items-center justify-between">
            <h3 class="font-bold">الإشعارات</h3>
            <div class="flex items-center gap-2">
                ${NOTIFICATION_STATE.unreadCount > 0 ? `
                    <button onclick="markAllNotificationsAsRead(); renderNotificationsPanel();" 
                            class="text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30">
                        قراءة الكل
                    </button>
                ` : ''}
                <button onclick="document.getElementById('notificationsPanel').remove()" 
                        class="hover:bg-white/20 p-1 rounded">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
        
        <div id="notificationsList" class="overflow-y-auto max-h-[60vh]">
            ${renderNotificationsList()}
        </div>
        
        <div class="p-3 border-t bg-gray-50 flex justify-between items-center">
            <button onclick="clearAllNotifications(); renderNotificationsPanel();" 
                    class="text-red-600 text-sm hover:underline">
                مسح الكل
            </button>
            <label class="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" ${NOTIFICATION_STATE.soundEnabled ? 'checked' : ''} 
                       onchange="toggleNotificationSound(this.checked)">
                صوت الإشعارات
            </label>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeNotificationsPanelOnClickOutside);
    }, 100);
}

function closeNotificationsPanelOnClickOutside(e) {
    const panel = document.getElementById('notificationsPanel');
    const notifBtn = document.querySelector('[onclick*="toggleNotificationsPanel"]');
    
    if (panel && !panel.contains(e.target) && !notifBtn?.contains(e.target)) {
        panel.remove();
        document.removeEventListener('click', closeNotificationsPanelOnClickOutside);
    }
}

function renderNotificationsPanel() {
    const list = document.getElementById('notificationsList');
    if (list) {
        list.innerHTML = renderNotificationsList();
    }
    updateNotificationBadge();
}

function renderNotificationsList() {
    if (NOTIFICATION_STATE.notifications.length === 0) {
        return `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-bell-slash text-4xl mb-2"></i>
                <p>لا توجد إشعارات</p>
            </div>
        `;
    }
    
    return NOTIFICATION_STATE.notifications.slice(0, 50).map(notification => {
        const iconMap = {
            [NOTIFICATION_TYPES.SYNC_SUCCESS]: 'fa-check-circle text-green-500',
            [NOTIFICATION_TYPES.SYNC_FAILED]: 'fa-times-circle text-red-500',
            [NOTIFICATION_TYPES.SYNC_CONFLICT]: 'fa-exclamation-triangle text-yellow-500',
            [NOTIFICATION_TYPES.NEW_ASSET]: 'fa-plus-circle text-blue-500',
            [NOTIFICATION_TYPES.SESSION_STARTED]: 'fa-play-circle text-green-500',
            [NOTIFICATION_TYPES.USER_ACTIVITY]: 'fa-user-clock text-purple-500',
            [NOTIFICATION_TYPES.SYSTEM_ALERT]: 'fa-bell text-orange-500'
        };
        
        const icon = iconMap[notification.type] || 'fa-bell text-gray-500';
        const isUnread = !notification.read;
        
        return `
            <div class="notification-item p-4 border-b hover:bg-gray-50 cursor-pointer ${isUnread ? 'bg-blue-50' : ''}"
                 onclick="markNotificationAsRead('${notification.id}'); handleNotificationClick(${JSON.stringify(notification).replace(/"/g, '&quot;')})">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 mt-1">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-gray-900 text-sm ${isUnread ? 'font-bold' : ''}">${notification.title}</p>
                        <p class="text-gray-600 text-xs mt-1">${notification.message}</p>
                        <p class="text-gray-400 text-xs mt-2">${formatTimeAgo(notification.createdAt)}</p>
                    </div>
                    ${isUnread ? '<div class="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

// === Toggle Notification Sound ===
async function toggleNotificationSound(enabled) {
    NOTIFICATION_STATE.soundEnabled = enabled;
    await dbPut(STORES.settings, { key: 'notificationSettings', value: { soundEnabled: enabled } });
}

// === Start Polling for New Notifications ===
function startNotificationPolling() {
    if (NOTIFICATION_STATE.pollingInterval) return;
    
    // Poll every 30 seconds
    NOTIFICATION_STATE.pollingInterval = setInterval(async () => {
        if (AUTH_STATE.isOnline) {
            await checkForNewNotifications();
        }
    }, 30000);
}

function stopNotificationPolling() {
    if (NOTIFICATION_STATE.pollingInterval) {
        clearInterval(NOTIFICATION_STATE.pollingInterval);
        NOTIFICATION_STATE.pollingInterval = null;
    }
}

async function checkForNewNotifications() {
    // This would typically fetch from server
    // For now, we just reload from local DB
    await loadNotifications();
    updateNotificationBadge();
}

// === Sync Notifications ===
function notifySyncSuccess(count) {
    createNotification(
        NOTIFICATION_TYPES.SYNC_SUCCESS,
        'تمت المزامنة بنجاح',
        `تم مزامنة ${count} عنصر مع الخادم`,
        { count }
    );
}

function notifySyncFailed(error) {
    createNotification(
        NOTIFICATION_TYPES.SYNC_FAILED,
        'فشلت المزامنة',
        `حدث خطأ أثناء المزامنة: ${error}`,
        { error }
    );
}

function notifySyncConflict(conflicts) {
    createNotification(
        NOTIFICATION_TYPES.SYNC_CONFLICT,
        'تعارض في البيانات',
        `يوجد ${conflicts.length} تعارض يحتاج حل`,
        { conflicts }
    );
}

// === Asset Notifications ===
function notifyNewAsset(asset, scannedBy) {
    if (AUTH_STATE.userRole === USER_ROLES.ADMIN || AUTH_STATE.userRole === USER_ROLES.MANAGER) {
        createNotification(
            NOTIFICATION_TYPES.NEW_ASSET,
            'تم إضافة أصل جديد',
            `${scannedBy} أضاف أصل: ${asset.name}`,
            { 
                assetId: asset.id, 
                assetName: asset.name,
                scannedBy,
                targetRole: USER_ROLES.ADMIN
            }
        );
    }
}

// === Session Notifications ===
function notifySessionStarted(session) {
    createNotification(
        NOTIFICATION_TYPES.SESSION_STARTED,
        'بدأت جلسة جرد جديدة',
        `${session.name} في ${session.branchName}`,
        { 
            sessionId: session.id,
            targetBranch: session.branch
        }
    );
}

function notifySessionCompleted(session) {
    createNotification(
        NOTIFICATION_TYPES.SESSION_COMPLETED,
        'اكتملت جلسة الجرد',
        `تم إنهاء ${session.name} بنجاح`,
        { 
            sessionId: session.id,
            targetBranch: session.branch
        }
    );
}

// === Format Time Ago ===
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days < 7) return `منذ ${days} يوم`;
    
    return date.toLocaleDateString('ar-SA');
}

// === Show Sync Conflict Modal ===
function showSyncConflictModal(data) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
            <div class="bg-yellow-500 text-white p-4">
                <h3 class="font-bold text-lg">
                    <i class="fas fa-exclamation-triangle ml-2"></i>
                    تعارض في البيانات
                </h3>
            </div>
            <div class="p-6">
                <p class="text-gray-600 mb-4">
                    تم اكتشاف تعارض في البيانات. يرجى اختيار الإجراء المناسب:
                </p>
                <div class="space-y-3">
                    <button onclick="resolveConflict('local'); this.closest('.fixed').remove();"
                            class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">
                        الاحتفاظ بالنسخة المحلية
                    </button>
                    <button onclick="resolveConflict('server'); this.closest('.fixed').remove();"
                            class="w-full bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700">
                        استخدام نسخة الخادم
                    </button>
                    <button onclick="this.closest('.fixed').remove();"
                            class="w-full bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200">
                        تأجيل القرار
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function resolveConflict(choice) {
    // Handle conflict resolution
    console.log('Conflict resolved with choice:', choice);
    showToast('تم حل التعارض بنجاح', 'success');
}

// === Export for global access ===
window.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
window.NOTIFICATION_STATE = NOTIFICATION_STATE;
window.initializeNotifications = initializeNotifications;
window.createNotification = createNotification;
window.markNotificationAsRead = markNotificationAsRead;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.deleteNotification = deleteNotification;
window.clearAllNotifications = clearAllNotifications;
window.toggleNotificationsPanel = toggleNotificationsPanel;
window.notifySyncSuccess = notifySyncSuccess;
window.notifySyncFailed = notifySyncFailed;
window.notifySyncConflict = notifySyncConflict;
window.notifyNewAsset = notifyNewAsset;
window.notifySessionStarted = notifySessionStarted;
window.notifySessionCompleted = notifySessionCompleted;
