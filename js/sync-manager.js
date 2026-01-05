/**
 * Sync Manager - Firebase Synchronization System
 * نظام المزامنة مع Firebase
 * يدعم العمل بدون إنترنت والمزامنة التلقائية
 */

// Sync State
const SYNC_STATE = {
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: [],
    syncErrors: [],
    conflictQueue: []
};

// Sync Collections Configuration
const SYNC_COLLECTIONS = {
    assets: {
        localStore: 'assets',
        firebaseCollection: 'assets',
        conflictStrategy: 'server_wins' // 'server_wins', 'client_wins', 'manual'
    },
    departments: {
        localStore: 'departments',
        firebaseCollection: 'departments',
        conflictStrategy: 'server_wins'
    },
    auditSessions: {
        localStore: 'auditSessions',
        firebaseCollection: 'auditSessions',
        conflictStrategy: 'server_wins'
    },
    users: {
        localStore: 'users',
        firebaseCollection: 'users',
        conflictStrategy: 'server_wins'
    },
    maintenance: {
        localStore: 'maintenance',
        firebaseCollection: 'maintenance',
        conflictStrategy: 'server_wins'
    },
    activityLogs: {
        localStore: 'activityLogs',
        firebaseCollection: 'activityLogs',
        conflictStrategy: 'client_wins' // Logs always from client
    }
};

/**
 * Initialize Sync Manager
 */
async function initSyncManager() {
    // Load last sync time
    try {
        const lastSync = await dbGet(STORES.settings, 'lastSync');
        if (lastSync) {
            SYNC_STATE.lastSyncTime = new Date(lastSync.value);
        }
    } catch (e) {
        console.error('Error loading last sync time:', e);
    }

    // Setup network listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync if online
    if (navigator.onLine && isFirebaseReady()) {
        setTimeout(() => performFullSync(), 2000);
    }

    // Start periodic sync check
    setInterval(checkAndSync, 60000); // Every minute
}

/**
 * Handle coming online
 */
async function handleOnline() {
    SYNC_STATE.isOnline = true;
    APP_STATE.isOnline = true;
    updateConnectionStatus(true);
    
    showToast('تم استعادة الاتصال بالإنترنت', 'success');
    
    // Show online banner briefly
    const onlineBanner = document.getElementById('onlineBanner');
    if (onlineBanner) {
        onlineBanner.classList.add('show');
        setTimeout(() => onlineBanner.classList.remove('show'), 3000);
    }

    // Perform sync
    if (isFirebaseReady()) {
        await performFullSync();
    }
}

/**
 * Handle going offline
 */
function handleOffline() {
    SYNC_STATE.isOnline = false;
    APP_STATE.isOnline = false;
    updateConnectionStatus(false);
    
    // Show offline banner
    const offlineBanner = document.getElementById('offlineBanner');
    if (offlineBanner) {
        offlineBanner.classList.add('show');
    }
    
    showToast('أنت الآن في وضع عدم الاتصال. سيتم حفظ البيانات محلياً.', 'warning');
}

/**
 * Update connection status in UI
 */
function updateConnectionStatus(isOnline) {
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
        statusEl.innerHTML = isOnline 
            ? '<i class="fas fa-wifi text-green-500"></i>'
            : '<i class="fas fa-wifi-slash text-red-500"></i>';
    }

    // Update offline banner
    const offlineBanner = document.getElementById('offlineBanner');
    if (offlineBanner) {
        if (isOnline) {
            offlineBanner.classList.remove('show');
        } else {
            offlineBanner.classList.add('show');
        }
    }
}

/**
 * Check and perform sync if needed
 */
async function checkAndSync() {
    if (!SYNC_STATE.isOnline || !isFirebaseReady() || SYNC_STATE.isSyncing) {
        return;
    }

    // Check for pending changes
    const pendingCount = await getPendingSyncCount();
    if (pendingCount > 0) {
        await performFullSync();
    }
}

/**
 * Get count of pending changes
 */
async function getPendingSyncCount() {
    try {
        const queue = await dbGetAll(STORES.syncQueue);
        return queue?.length || 0;
    } catch (e) {
        return 0;
    }
}

/**
 * Perform full sync with Firebase
 */
async function performFullSync() {
    if (!isFirebaseReady() || SYNC_STATE.isSyncing) {
        return { success: false, message: 'Sync not available' };
    }

    SYNC_STATE.isSyncing = true;
    updateSyncStatusUI('syncing');

    try {
        // 1. Process pending local changes first (upload)
        await processPendingChanges();

        // 2. Fetch changes from server (download)
        await fetchServerChanges();

        // 3. Resolve any conflicts
        await resolveConflicts();

        // Update last sync time
        SYNC_STATE.lastSyncTime = new Date();
        await dbPut(STORES.settings, { key: 'lastSync', value: SYNC_STATE.lastSyncTime.toISOString() });

        updateSyncStatusUI('synced');
        updateLastSyncDisplay();

        showToast('تمت المزامنة بنجاح', 'success');
        return { success: true };

    } catch (error) {
        console.error('Sync error:', error);
        updateSyncStatusUI('error');
        showToast('فشلت المزامنة: ' + error.message, 'error');
        return { success: false, error };

    } finally {
        SYNC_STATE.isSyncing = false;
    }
}

/**
 * Process pending local changes
 */
async function processPendingChanges() {
    const { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } = window.FirebaseModules.firestore;
    
    const queue = await dbGetAll(STORES.syncQueue);
    
    for (const item of queue) {
        try {
            const collectionConfig = SYNC_COLLECTIONS[item.storeName];
            if (!collectionConfig) continue;

            const docRef = doc(getFirebaseDB(), collectionConfig.firebaseCollection, item.data.id);

            switch (item.action) {
                case 'create':
                    await setDoc(docRef, {
                        ...item.data,
                        syncedAt: serverTimestamp(),
                        syncedFrom: 'local'
                    });
                    break;

                case 'update':
                    await updateDoc(docRef, {
                        ...item.data,
                        syncedAt: serverTimestamp()
                    });
                    break;

                case 'delete':
                    await deleteDoc(docRef);
                    break;
            }

            // Remove from queue after successful sync
            await dbDelete(STORES.syncQueue, item.id);
            
        } catch (error) {
            console.error('Error syncing item:', item, error);
            SYNC_STATE.syncErrors.push({ item, error });
        }
    }
}

/**
 * Fetch changes from server
 */
async function fetchServerChanges() {
    const { collection, getDocs, query, where, orderBy } = window.FirebaseModules.firestore;

    for (const [key, config] of Object.entries(SYNC_COLLECTIONS)) {
        try {
            let q;
            
            // Build query based on user role and data type
            if (AUTH_STATE.role === USER_ROLES.ADMIN || key === 'activityLogs') {
                // Admin sees all, logs are always fetched
                q = collection(getFirebaseDB(), config.firebaseCollection);
            } else if (key === 'assets') {
                // Filter assets by branch or creator
                if (AUTH_STATE.role === USER_ROLES.MANAGER) {
                    q = query(
                        collection(getFirebaseDB(), config.firebaseCollection),
                        where('branch', '==', AUTH_STATE.branch)
                    );
                } else {
                    q = query(
                        collection(getFirebaseDB(), config.firebaseCollection),
                        where('createdBy', '==', AUTH_STATE.user?.id)
                    );
                }
            } else {
                q = collection(getFirebaseDB(), config.firebaseCollection);
            }

            const snapshot = await getDocs(q);
            
            for (const docSnap of snapshot.docs) {
                const serverData = { id: docSnap.id, ...docSnap.data() };
                const localData = await dbGet(config.localStore, docSnap.id);

                if (!localData) {
                    // New data from server - save locally
                    await dbPut(config.localStore, serverData);
                } else {
                    // Check for conflicts
                    const serverUpdated = serverData.updatedAt || serverData.syncedAt;
                    const localUpdated = localData.updatedAt;

                    if (serverUpdated && localUpdated && 
                        new Date(serverUpdated) > new Date(localUpdated)) {
                        // Server is newer
                        await handleConflict(config, localData, serverData);
                    }
                }
            }

        } catch (error) {
            console.error(`Error fetching ${key}:`, error);
        }
    }

    // Reload app state from local DB
    await loadAllDataFromLocal();
}

/**
 * Handle data conflict
 */
async function handleConflict(config, localData, serverData) {
    switch (config.conflictStrategy) {
        case 'server_wins':
            // Server data overwrites local
            await dbPut(config.localStore, serverData);
            break;

        case 'client_wins':
            // Keep local, will be synced to server
            // Do nothing here
            break;

        case 'manual':
            // Add to conflict queue for user resolution
            SYNC_STATE.conflictQueue.push({
                collection: config.localStore,
                localData,
                serverData,
                timestamp: new Date().toISOString()
            });
            break;
    }
}

/**
 * Resolve conflicts in queue
 */
async function resolveConflicts() {
    if (SYNC_STATE.conflictQueue.length === 0) return;

    // For now, show notification about conflicts
    showToast(`يوجد ${SYNC_STATE.conflictQueue.length} تعارضات تحتاج مراجعة`, 'warning');
    
    // TODO: Implement conflict resolution UI
}

/**
 * Load all data from local IndexedDB
 */
async function loadAllDataFromLocal() {
    try {
        APP_STATE.assets = await dbGetAll(STORES.assets) || [];
        APP_STATE.departments = await dbGetAll(STORES.departments) || [];
        APP_STATE.maintenance = await dbGetAll(STORES.maintenance) || [];
        APP_STATE.activityLogs = await dbGetAll(STORES.activityLogs) || [];

        // Refresh UI
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderAssets === 'function') renderAssets();
        if (typeof renderDepartments === 'function') renderDepartments();

    } catch (error) {
        console.error('Error loading local data:', error);
    }
}

/**
 * Add item to sync queue
 */
async function queueForSync(action, storeName, data) {
    if (!data.id) {
        data.id = generateId();
    }

    const queueItem = {
        action,
        storeName,
        data,
        timestamp: new Date().toISOString(),
        userId: currentUserData?.id || 'anonymous'
    };

    await dbPut(STORES.syncQueue, queueItem);
    updatePendingSyncCount();

    // Try immediate sync if online
    if (SYNC_STATE.isOnline && isFirebaseReady()) {
        setTimeout(() => performFullSync(), 1000);
    }
}

/**
 * Update pending sync count display
 */
async function updatePendingSyncCount() {
    const count = await getPendingSyncCount();
    APP_STATE.pendingSyncCount = count;
    
    const badge = document.getElementById('pendingSyncBadge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

/**
 * Update sync status UI
 */
function updateSyncStatusUI(status) {
    const statusEl = document.getElementById('syncStatus');
    if (!statusEl) return;

    switch (status) {
        case 'syncing':
            statusEl.className = 'sync-status syncing';
            statusEl.innerHTML = '<i class="fas fa-sync fa-spin"></i> جاري المزامنة...';
            break;
        case 'synced':
            statusEl.className = 'sync-status synced';
            statusEl.innerHTML = '<i class="fas fa-check-circle"></i> متزامن';
            break;
        case 'pending':
            statusEl.className = 'sync-status pending';
            statusEl.innerHTML = '<i class="fas fa-clock"></i> في انتظار المزامنة';
            break;
        case 'error':
            statusEl.className = 'sync-status error';
            statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> خطأ في المزامنة';
            break;
        case 'offline':
            statusEl.className = 'sync-status offline';
            statusEl.innerHTML = '<i class="fas fa-wifi-slash"></i> غير متصل';
            break;
    }
}

/**
 * Update last sync time display
 */
function updateLastSyncDisplay() {
    const el = document.getElementById('lastSyncTime');
    if (el && SYNC_STATE.lastSyncTime) {
        el.textContent = `آخر مزامنة: ${formatTimeAgo(SYNC_STATE.lastSyncTime)}`;
    }
}

/**
 * Format time ago
 */
function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'الآن';
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    if (diffHour < 24) return `منذ ${diffHour} ساعة`;
    return `منذ ${diffDay} يوم`;
}

/**
 * Force sync (manual trigger)
 */
async function forceSyncData() {
    if (!SYNC_STATE.isOnline) {
        showToast('لا يوجد اتصال بالإنترنت', 'warning');
        return;
    }

    if (!isFirebaseReady()) {
        showToast('Firebase غير مُهيأ', 'error');
        return;
    }

    await performFullSync();
}

/**
 * Setup real-time listeners for Firebase
 */
async function setupRealtimeListeners() {
    if (!isFirebaseReady()) return;

    const { collection, onSnapshot, query, where } = window.FirebaseModules.firestore;

    // Listen to assets collection
    try {
        let assetsQuery;
        
        if (AUTH_STATE.role === USER_ROLES.ADMIN) {
            assetsQuery = collection(getFirebaseDB(), 'assets');
        } else if (AUTH_STATE.role === USER_ROLES.MANAGER) {
            assetsQuery = query(
                collection(getFirebaseDB(), 'assets'),
                where('branch', '==', AUTH_STATE.branch)
            );
        } else {
            assetsQuery = query(
                collection(getFirebaseDB(), 'assets'),
                where('createdBy', '==', AUTH_STATE.user?.id)
            );
        }

        onSnapshot(assetsQuery, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                const data = { id: change.doc.id, ...change.doc.data() };
                
                if (change.type === 'added' || change.type === 'modified') {
                    // Check if this is from another user
                    if (data.createdBy !== currentUserData?.id) {
                        await dbPut(STORES.assets, data);
                        
                        // Update UI
                        const index = APP_STATE.assets.findIndex(a => a.id === data.id);
                        if (index >= 0) {
                            APP_STATE.assets[index] = data;
                        } else {
                            APP_STATE.assets.push(data);
                        }
                        
                        // Show notification
                        if (change.type === 'added') {
                            showToast(`تمت إضافة أصل جديد بواسطة ${data.createdByName || 'مستخدم آخر'}`, 'info');
                        }
                        
                        if (typeof updateDashboard === 'function') updateDashboard();
                        if (typeof renderAssets === 'function') renderAssets();
                    }
                }
                
                if (change.type === 'removed') {
                    await dbDelete(STORES.assets, data.id);
                    APP_STATE.assets = APP_STATE.assets.filter(a => a.id !== data.id);
                    if (typeof renderAssets === 'function') renderAssets();
                }
            });
        });

        console.log('✅ Realtime listeners setup complete');

    } catch (error) {
        console.error('Error setting up realtime listeners:', error);
    }
}

/**
 * Export sync functions for global use
 */
window.SyncManager = {
    init: initSyncManager,
    sync: performFullSync,
    forceSync: forceSyncData,
    queueForSync,
    isOnline: () => SYNC_STATE.isOnline,
    getPendingCount: getPendingSyncCount
};
