/**
 * Notifications System
 * نظام الإشعارات والتنبيهات
 */

// Notifications State
const NOTIFICATIONS_STATE = {
    notifications: [],
    unreadCount: 0,
    isPermissionGranted: false,
    settings: {
        enablePush: true,
        enableSound: true,
        enableBadge: true,
        enableInApp: true
    }
};

// Notification Types
const NOTIFICATION_TYPES = {
    SYNC_SUCCESS: 'sync_success',
    SYNC_ERROR: 'sync_error',
    NEW_ASSET: 'new_asset',
    ASSET_UPDATED: 'asset_updated',
    ASSET_DELETED: 'asset_deleted',
    SESSION_STARTED: 'session_started',
    SESSION_COMPLETED: 'session_completed',
    USER_ACTIVITY: 'user_activity',
    CONFLICT_DETECTED: 'conflict_detected',
    LOW_BATTERY: 'low_battery',
    OFFLINE_MODE: 'offline_mode',
    ONLINE_MODE: 'online_mode',
    SYSTEM: 'system'
};

// Notification Icons
const NOTIFICATION_ICONS = {
    sync_success: 'fa-check-circle text-green-500',
    sync_error: 'fa-exclamation-circle text-red-500',
    new_asset: 'fa-plus-circle text-blue-500',
    asset_updated: 'fa-edit text-yellow-500',
    asset_deleted: 'fa-trash text-red-500',
    session_started: 'fa-play-circle text-green-500',
    session_completed: 'fa-check-double text-blue-500',
    user_activity: 'fa-user-clock text-purple-500',
    conflict_detected: 'fa-exclamation-triangle text-orange-500',
    low_battery: 'fa-battery-quarter text-red-500',
    offline_mode: 'fa-wifi-slash text-gray-500',
    online_mode: 'fa-wifi text-green-500',
    system: 'fa-info-circle text-blue-500'
};

/**
 * Initialize Notifications System
 */
async function initNotifications() {
    // Load saved notifications
    await loadNotifications();
    
    // Request notification permission
    await requestNotificationPermission();
    
    // Load settings
    loadNotificationSettings();
    
    // Update badge
    updateNotificationBadge();
    
    // Setup battery monitoring
    if ('getBattery' in navigator) {
        setupBatteryMonitor();
    }
}

/**
 * Request notification permission
 */
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Browser does not support notifications');
        return false;
    }

    if (Notification.permission === 'granted') {
        NOTIFICATIONS_STATE.isPermissionGranted = true;
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        NOTIFICATIONS_STATE.isPermissionGranted = permission === 'granted';
        return NOTIFICATIONS_STATE.isPermissionGranted;
    }

    return false;
}

/**
 * Load notifications from storage
 */
async function loadNotifications() {
    try {
        const stored = await dbGetAll('notifications');
        NOTIFICATIONS_STATE.notifications = stored || [];
        
        // Count unread
        NOTIFICATIONS_STATE.unreadCount = NOTIFICATIONS_STATE.notifications.filter(n => !n.read).length;
        
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

/**
 * Load notification settings
 */
function loadNotificationSettings() {
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
        NOTIFICATIONS_STATE.settings = { ...NOTIFICATIONS_STATE.settings, ...JSON.parse(saved) };
    }
}

/**
 * Save notification settings
 */
function saveNotificationSettings() {
    localStorage.setItem('notificationSettings', JSON.stringify(NOTIFICATIONS_STATE.settings));
}

/**
 * Create and show notification
 */
async function notify(type, title, message, options = {}) {
    const {
        persistent = false,
        actionUrl = null,
        data = null,
        silent = false
    } = options;

    // Create notification object
    const notification = {
        id: generateId(),
        type,
        title,
        message,
        data,
        actionUrl,
        read: false,
        timestamp: new Date().toISOString()
    };

    // Save to storage
    await dbPut('notifications', notification);
    NOTIFICATIONS_STATE.notifications.unshift(notification);
    NOTIFICATIONS_STATE.unreadCount++;

    // Update UI
    updateNotificationBadge();
    
    // Show in-app notification
    if (NOTIFICATIONS_STATE.settings.enableInApp) {
        showInAppNotification(notification);
    }

    // Show push notification
    if (NOTIFICATIONS_STATE.settings.enablePush && 
        NOTIFICATIONS_STATE.isPermissionGranted && 
        !silent) {
        showPushNotification(notification);
    }

    // Play sound
    if (NOTIFICATIONS_STATE.settings.enableSound && !silent) {
        playNotificationSound();
    }

    return notification;
}

/**
 * Show in-app notification (toast)
 */
function showInAppNotification(notification) {
    const icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.system;
    
    // Create notification element
    const notifEl = document.createElement('div');
    notifEl.className = 'notification-toast fixed top-4 left-4 z-50 bg-white rounded-xl shadow-lg p-4 max-w-sm transform translate-x-[-100%] opacity-0 transition-all duration-300';
    notifEl.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="flex-shrink-0">
                <i class="fas ${icon} text-xl"></i>
            </div>
            <div class="flex-1">
                <h4 class="font-semibold text-gray-800">${notification.title}</h4>
                <p class="text-sm text-gray-600">${notification.message}</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" 
                    class="text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(notifEl);

    // Animate in
    setTimeout(() => {
        notifEl.style.transform = 'translateX(0)';
        notifEl.style.opacity = '1';
    }, 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
        notifEl.style.transform = 'translateX(-100%)';
        notifEl.style.opacity = '0';
        setTimeout(() => notifEl.remove(), 300);
    }, 5000);
}

/**
 * Show push notification
 */
function showPushNotification(notification) {
    if (!NOTIFICATIONS_STATE.isPermissionGranted) return;

    const icon = '/icons/icon-192x192.png'; // PWA icon

    const pushNotif = new Notification(notification.title, {
        body: notification.message,
        icon: icon,
        badge: icon,
        tag: notification.id,
        data: notification.data,
        requireInteraction: false
    });

    pushNotif.onclick = () => {
        window.focus();
        if (notification.actionUrl) {
            window.location.href = notification.actionUrl;
        }
        pushNotif.close();
    };
}

/**
 * Play notification sound
 */
function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
        audio.volume = 0.3;
        audio.play().catch(() => {}); // Ignore autoplay errors
    } catch (e) {
        // Ignore audio errors
    }
}

/**
 * Update notification badge
 */
function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.textContent = NOTIFICATIONS_STATE.unreadCount;
        badge.style.display = NOTIFICATIONS_STATE.unreadCount > 0 ? 'flex' : 'none';
    }

    // Update document title
    if (NOTIFICATIONS_STATE.unreadCount > 0) {
        document.title = `(${NOTIFICATIONS_STATE.unreadCount}) نظام جرد الأصول`;
    } else {
        document.title = 'نظام جرد وحصر الأصول الحكومية';
    }

    // Update PWA badge if supported
    if ('setAppBadge' in navigator && NOTIFICATIONS_STATE.settings.enableBadge) {
        if (NOTIFICATIONS_STATE.unreadCount > 0) {
            navigator.setAppBadge(NOTIFICATIONS_STATE.unreadCount);
        } else {
            navigator.clearAppBadge();
        }
    }
}

/**
 * Mark notification as read
 */
async function markAsRead(notificationId) {
    const notification = NOTIFICATIONS_STATE.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
        notification.read = true;
        await dbPut('notifications', notification);
        NOTIFICATIONS_STATE.unreadCount--;
        updateNotificationBadge();
    }
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead() {
    for (const notification of NOTIFICATIONS_STATE.notifications) {
        if (!notification.read) {
            notification.read = true;
            await dbPut('notifications', notification);
        }
    }
    NOTIFICATIONS_STATE.unreadCount = 0;
    updateNotificationBadge();
    renderNotificationsList();
}

/**
 * Delete notification
 */
async function deleteNotification(notificationId) {
    const index = NOTIFICATIONS_STATE.notifications.findIndex(n => n.id === notificationId);
    if (index > -1) {
        const notification = NOTIFICATIONS_STATE.notifications[index];
        if (!notification.read) {
            NOTIFICATIONS_STATE.unreadCount--;
        }
        NOTIFICATIONS_STATE.notifications.splice(index, 1);
        await dbDelete('notifications', notificationId);
        updateNotificationBadge();
        renderNotificationsList();
    }
}

/**
 * Clear all notifications
 */
async function clearAllNotifications() {
    for (const notification of NOTIFICATIONS_STATE.notifications) {
        await dbDelete('notifications', notification.id);
    }
    NOTIFICATIONS_STATE.notifications = [];
    NOTIFICATIONS_STATE.unreadCount = 0;
    updateNotificationBadge();
    renderNotificationsList();
}

/**
 * Render notifications list
 */
function renderNotificationsList() {
    const container = document.getElementById('notificationsList');
    if (!container) return;

    if (NOTIFICATIONS_STATE.notifications.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-bell-slash text-4xl mb-4"></i>
                <p>لا توجد إشعارات</p>
            </div>
        `;
        return;
    }

    container.innerHTML = NOTIFICATIONS_STATE.notifications.slice(0, 50).map(notification => {
        const icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.system;
        const timeAgo = formatTimeAgo(new Date(notification.timestamp));
        
        return `
            <div class="notification-item ${notification.read ? 'opacity-60' : ''} 
                        flex items-start gap-3 p-4 border-b hover:bg-gray-50 cursor-pointer"
                 onclick="markAsRead('${notification.id}')">
                <div class="flex-shrink-0 mt-1">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="flex-1">
                    <p class="font-medium text-gray-800">${notification.title}</p>
                    <p class="text-sm text-gray-600">${notification.message}</p>
                    <p class="text-xs text-gray-400 mt-1">${timeAgo}</p>
                </div>
                <button onclick="event.stopPropagation(); deleteNotification('${notification.id}')"
                        class="text-gray-400 hover:text-red-500">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Show notifications panel
 */
function showNotificationsPanel() {
    const panel = document.getElementById('notificationsPanel');
    if (panel) {
        panel.classList.remove('hidden');
        renderNotificationsList();
    }
}

/**
 * Hide notifications panel
 */
function hideNotificationsPanel() {
    const panel = document.getElementById('notificationsPanel');
    if (panel) {
        panel.classList.add('hidden');
    }
}

/**
 * Toggle notifications panel
 */
function toggleNotificationsPanel() {
    const panel = document.getElementById('notificationsPanel');
    if (panel) {
        if (panel.classList.contains('hidden')) {
            showNotificationsPanel();
        } else {
            hideNotificationsPanel();
        }
    }
}

/**
 * Setup battery monitoring
 */
async function setupBatteryMonitor() {
    try {
        const battery = await navigator.getBattery();
        
        battery.addEventListener('levelchange', () => {
            if (battery.level <= 0.15 && !battery.charging) {
                notify(
                    NOTIFICATION_TYPES.LOW_BATTERY,
                    'البطارية منخفضة',
                    'يرجى شحن الجهاز لضمان حفظ البيانات',
                    { silent: false }
                );
            }
        });
    } catch (e) {
        console.log('Battery API not supported');
    }
}

/**
 * Notification shortcuts for common events
 */
const NotificationShortcuts = {
    syncSuccess: (count) => notify(
        NOTIFICATION_TYPES.SYNC_SUCCESS,
        'تمت المزامنة بنجاح',
        `تم مزامنة ${count} عنصر مع السحابة`
    ),
    
    syncError: (error) => notify(
        NOTIFICATION_TYPES.SYNC_ERROR,
        'فشل المزامنة',
        error.message || 'حدث خطأ أثناء المزامنة',
        { persistent: true }
    ),
    
    newAsset: (asset, userName) => notify(
        NOTIFICATION_TYPES.NEW_ASSET,
        'أصل جديد',
        `تمت إضافة "${asset.name}" بواسطة ${userName}`,
        { data: { assetId: asset.id } }
    ),
    
    sessionStarted: (session) => notify(
        NOTIFICATION_TYPES.SESSION_STARTED,
        'بدأت جلسة جرد',
        `بدأت جلسة "${session.name}"`,
        { data: { sessionId: session.id } }
    ),
    
    sessionCompleted: (session) => notify(
        NOTIFICATION_TYPES.SESSION_COMPLETED,
        'اكتملت جلسة الجرد',
        `اكتملت جلسة "${session.name}"`,
        { data: { sessionId: session.id } }
    ),
    
    conflict: (item) => notify(
        NOTIFICATION_TYPES.CONFLICT_DETECTED,
        'تعارض في البيانات',
        'تم اكتشاف تعارض يحتاج مراجعة',
        { persistent: true, data: item }
    ),
    
    offline: () => notify(
        NOTIFICATION_TYPES.OFFLINE_MODE,
        'وضع عدم الاتصال',
        'ستُحفظ البيانات محلياً وتُزامن عند الاتصال',
        { silent: true }
    ),
    
    online: () => notify(
        NOTIFICATION_TYPES.ONLINE_MODE,
        'تم الاتصال',
        'جاري مزامنة البيانات...',
        { silent: true }
    )
};

/**
 * Export Notifications functions
 */
window.Notifications = {
    init: initNotifications,
    notify,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll: clearAllNotifications,
    toggle: toggleNotificationsPanel,
    shortcuts: NotificationShortcuts,
    updateBadge: updateNotificationBadge
};
