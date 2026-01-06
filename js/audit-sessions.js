/**
 * Audit Sessions Management Module
 * نظام إدارة جلسات الجرد
 * Version 6.0
 */

// === Session States ===
const SESSION_STATUS = {
    DRAFT: 'draft',           // مسودة
    ACTIVE: 'active',         // نشطة
    PAUSED: 'paused',         // متوقفة مؤقتاً
    COMPLETED: 'completed',   // مكتملة
    CANCELLED: 'cancelled'    // ملغاة
};

// === Sessions Store Name ===
const SESSIONS_STORE = 'audit_sessions';

// === Initialize Sessions Store ===
async function initializeSessionsStore() {
    // Sessions store will be created in the main DB initialization
    // This function ensures demo sessions exist
    try {
        const sessions = await dbGetAll(SESSIONS_STORE);
        if (!sessions || sessions.length === 0) {
            await createDemoSessions();
        }
    } catch (error) {
        console.log('Sessions store initialization:', error);
    }
}

// === Create Demo Sessions ===
async function createDemoSessions() {
    const demoSessions = [
        {
            id: 'session-001',
            name: 'جرد فرع الرياض - يناير 2026',
            branch: 'branch-riyadh',
            branchName: 'فرع الرياض',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
            status: SESSION_STATUS.ACTIVE,
            participants: ['field-001', 'field-002'],
            targetAssets: 500,
            scannedAssets: 127,
            progress: 25.4,
            notes: 'جرد شامل لجميع أصول الفرع',
            createdBy: 'admin-001',
            createdAt: '2025-12-28T00:00:00Z',
            updatedAt: '2026-01-06T10:30:00Z'
        },
        {
            id: 'session-002',
            name: 'جرد فرع جدة - يناير 2026',
            branch: 'branch-jeddah',
            branchName: 'فرع جدة',
            startDate: '2026-01-05',
            endDate: '2026-01-25',
            status: SESSION_STATUS.ACTIVE,
            participants: ['field-003'],
            targetAssets: 300,
            scannedAssets: 45,
            progress: 15,
            notes: 'جرد ربع سنوي',
            createdBy: 'manager-002',
            createdAt: '2026-01-04T00:00:00Z',
            updatedAt: '2026-01-06T09:00:00Z'
        },
        {
            id: 'session-003',
            name: 'جرد فرع الرياض - ديسمبر 2025',
            branch: 'branch-riyadh',
            branchName: 'فرع الرياض',
            startDate: '2025-12-01',
            endDate: '2025-12-31',
            status: SESSION_STATUS.COMPLETED,
            participants: ['field-001', 'field-002'],
            targetAssets: 480,
            scannedAssets: 480,
            progress: 100,
            notes: 'تم الانتهاء بنجاح',
            createdBy: 'admin-001',
            createdAt: '2025-11-28T00:00:00Z',
            completedAt: '2025-12-30T16:45:00Z'
        }
    ];
    
    for (const session of demoSessions) {
        await dbPut(SESSIONS_STORE, session);
    }
    
    console.log('Demo sessions created');
}

// === Get Sessions ===
async function getSessions(filters = {}) {
    let sessions = await dbGetAll(SESSIONS_STORE);
    
    // Filter by role permissions
    if (AUTH_STATE.userRole === USER_ROLES.MANAGER) {
        sessions = sessions.filter(s => s.branch === AUTH_STATE.userBranch);
    } else if (AUTH_STATE.userRole === USER_ROLES.FIELD_USER) {
        sessions = sessions.filter(s => 
            s.participants && s.participants.includes(AUTH_STATE.currentUser?.id) &&
            s.status === SESSION_STATUS.ACTIVE
        );
    }
    
    // Apply additional filters
    if (filters.status) {
        sessions = sessions.filter(s => s.status === filters.status);
    }
    
    if (filters.branch) {
        sessions = sessions.filter(s => s.branch === filters.branch);
    }
    
    if (filters.dateFrom) {
        sessions = sessions.filter(s => s.startDate >= filters.dateFrom);
    }
    
    if (filters.dateTo) {
        sessions = sessions.filter(s => s.endDate <= filters.dateTo);
    }
    
    // Sort by date descending
    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return sessions;
}

// === Get Active Session ===
async function getActiveSession() {
    const sessions = await getSessions({ status: SESSION_STATUS.ACTIVE });
    
    if (AUTH_STATE.userRole === USER_ROLES.FIELD_USER) {
        // Return the session the field user is participating in
        return sessions.find(s => 
            s.participants && s.participants.includes(AUTH_STATE.currentUser?.id)
        );
    }
    
    // Return first active session for the branch
    if (AUTH_STATE.userRole === USER_ROLES.MANAGER) {
        return sessions.find(s => s.branch === AUTH_STATE.userBranch);
    }
    
    return sessions[0];
}

// === Create Session ===
async function createSession(sessionData) {
    if (!hasPermission('canManageSessions')) {
        throw new Error('ليس لديك صلاحية لإنشاء جلسات الجرد');
    }
    
    // Validate branch for manager
    if (AUTH_STATE.userRole === USER_ROLES.MANAGER && sessionData.branch !== AUTH_STATE.userBranch) {
        throw new Error('لا يمكنك إنشاء جلسة لفرع آخر');
    }
    
    const branches = await getBranches();
    const branch = branches.find(b => b.id === sessionData.branch);
    
    const newSession = {
        id: generateId('session'),
        name: sessionData.name,
        branch: sessionData.branch,
        branchName: branch?.name || '',
        startDate: sessionData.startDate,
        endDate: sessionData.endDate,
        status: SESSION_STATUS.DRAFT,
        participants: sessionData.participants || [],
        targetAssets: sessionData.targetAssets || 0,
        scannedAssets: 0,
        progress: 0,
        notes: sessionData.notes || '',
        createdBy: AUTH_STATE.currentUser?.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    await dbPut(SESSIONS_STORE, newSession);
    await logActivity('create_session', 'إنشاء جلسة جرد جديدة', { 
        sessionId: newSession.id, 
        name: newSession.name 
    });
    
    return newSession;
}

// === Update Session ===
async function updateSession(sessionId, updates) {
    if (!hasPermission('canManageSessions')) {
        throw new Error('ليس لديك صلاحية لتعديل جلسات الجرد');
    }
    
    const session = await dbGet(SESSIONS_STORE, sessionId);
    if (!session) {
        throw new Error('جلسة الجرد غير موجودة');
    }
    
    // Validate branch for manager
    if (AUTH_STATE.userRole === USER_ROLES.MANAGER && session.branch !== AUTH_STATE.userBranch) {
        throw new Error('لا يمكنك تعديل جلسة فرع آخر');
    }
    
    const updatedSession = {
        ...session,
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy: AUTH_STATE.currentUser?.id
    };
    
    await dbPut(SESSIONS_STORE, updatedSession);
    await logActivity('update_session', 'تعديل جلسة جرد', { sessionId, updates });
    
    return updatedSession;
}

// === Start Session ===
async function startSession(sessionId) {
    const session = await dbGet(SESSIONS_STORE, sessionId);
    if (!session) throw new Error('جلسة الجرد غير موجودة');
    
    if (session.status !== SESSION_STATUS.DRAFT && session.status !== SESSION_STATUS.PAUSED) {
        throw new Error('لا يمكن بدء هذه الجلسة');
    }
    
    return await updateSession(sessionId, {
        status: SESSION_STATUS.ACTIVE,
        startedAt: session.startedAt || new Date().toISOString()
    });
}

// === Pause Session ===
async function pauseSession(sessionId) {
    const session = await dbGet(SESSIONS_STORE, sessionId);
    if (!session) throw new Error('جلسة الجرد غير موجودة');
    
    if (session.status !== SESSION_STATUS.ACTIVE) {
        throw new Error('الجلسة غير نشطة');
    }
    
    return await updateSession(sessionId, {
        status: SESSION_STATUS.PAUSED,
        pausedAt: new Date().toISOString()
    });
}

// === Complete Session ===
async function completeSession(sessionId) {
    const session = await dbGet(SESSIONS_STORE, sessionId);
    if (!session) throw new Error('جلسة الجرد غير موجودة');
    
    return await updateSession(sessionId, {
        status: SESSION_STATUS.COMPLETED,
        completedAt: new Date().toISOString(),
        progress: 100
    });
}

// === Cancel Session ===
async function cancelSession(sessionId) {
    const session = await dbGet(SESSIONS_STORE, sessionId);
    if (!session) throw new Error('جلسة الجرد غير موجودة');
    
    return await updateSession(sessionId, {
        status: SESSION_STATUS.CANCELLED,
        cancelledAt: new Date().toISOString()
    });
}

// === Delete Session ===
async function deleteSession(sessionId) {
    if (AUTH_STATE.userRole !== USER_ROLES.ADMIN) {
        throw new Error('فقط المشرف العام يمكنه حذف الجلسات');
    }
    
    await dbDelete(SESSIONS_STORE, sessionId);
    await logActivity('delete_session', 'حذف جلسة جرد', { sessionId });
}

// === Add Asset to Session ===
async function addAssetToSession(sessionId, assetId) {
    const session = await dbGet(SESSIONS_STORE, sessionId);
    if (!session) throw new Error('جلسة الجرد غير موجودة');
    
    if (session.status !== SESSION_STATUS.ACTIVE) {
        throw new Error('الجلسة غير نشطة');
    }
    
    // Update session progress
    session.scannedAssets = (session.scannedAssets || 0) + 1;
    session.progress = session.targetAssets > 0 
        ? Math.min(100, (session.scannedAssets / session.targetAssets) * 100)
        : 0;
    session.updatedAt = new Date().toISOString();
    
    await dbPut(SESSIONS_STORE, session);
    
    // Create session scan record
    const scanRecord = {
        id: generateId('scan'),
        sessionId,
        assetId,
        scannedBy: AUTH_STATE.currentUser?.id,
        scannedByName: AUTH_STATE.currentUser?.name,
        scannedAt: new Date().toISOString(),
        location: await getCurrentLocation()
    };
    
    await dbPut('session_scans', scanRecord);
    
    return session;
}

// === Get Session Statistics ===
async function getSessionStatistics(sessionId) {
    const session = await dbGet(SESSIONS_STORE, sessionId);
    if (!session) return null;
    
    // Get all scans for this session
    const allScans = await dbGetAll('session_scans');
    const sessionScans = allScans.filter(s => s.sessionId === sessionId);
    
    // Group by user
    const userStats = {};
    for (const scan of sessionScans) {
        const userId = scan.scannedBy;
        if (!userStats[userId]) {
            userStats[userId] = {
                userId,
                userName: scan.scannedByName,
                count: 0,
                lastScan: null
            };
        }
        userStats[userId].count++;
        if (!userStats[userId].lastScan || new Date(scan.scannedAt) > new Date(userStats[userId].lastScan)) {
            userStats[userId].lastScan = scan.scannedAt;
        }
    }
    
    // Group by date
    const dailyStats = {};
    for (const scan of sessionScans) {
        const date = scan.scannedAt.split('T')[0];
        dailyStats[date] = (dailyStats[date] || 0) + 1;
    }
    
    return {
        session,
        totalScans: sessionScans.length,
        userStats: Object.values(userStats),
        dailyStats,
        participantsCount: session.participants?.length || 0,
        daysRemaining: Math.max(0, Math.ceil((new Date(session.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
    };
}

// === Get User Daily Statistics ===
async function getUserDailyStats(userId, sessionId) {
    const allScans = await dbGetAll('session_scans');
    const today = new Date().toISOString().split('T')[0];
    
    let scans = allScans.filter(s => s.scannedBy === userId);
    
    if (sessionId) {
        scans = scans.filter(s => s.sessionId === sessionId);
    }
    
    const todayScans = scans.filter(s => s.scannedAt.startsWith(today));
    
    return {
        total: scans.length,
        today: todayScans.length,
        lastScan: scans.length > 0 ? scans[scans.length - 1].scannedAt : null
    };
}

// === Get All Workers Statistics ===
async function getAllWorkersStats(sessionId = null) {
    const users = await getUsers();
    const fieldUsers = users.filter(u => u.role === USER_ROLES.FIELD_USER);
    
    const stats = [];
    
    for (const user of fieldUsers) {
        const userStats = await getUserDailyStats(user.id, sessionId);
        stats.push({
            user,
            ...userStats
        });
    }
    
    // Sort by today's count descending
    stats.sort((a, b) => b.today - a.today);
    
    return stats;
}

// === Helper: Get Current Location ===
async function getCurrentLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: new Date().toISOString()
                });
            },
            (error) => {
                console.warn('Geolocation error:', error);
                resolve(null);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    });
}

// === Generate Google Maps Link ===
function generateMapsLink(latitude, longitude) {
    if (!latitude || !longitude) return null;
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

// === Get Session Status Badge ===
function getSessionStatusBadge(status) {
    const badges = {
        [SESSION_STATUS.DRAFT]: { class: 'bg-gray-100 text-gray-800', text: 'مسودة', icon: 'fa-file-alt' },
        [SESSION_STATUS.ACTIVE]: { class: 'bg-green-100 text-green-800', text: 'نشطة', icon: 'fa-play-circle' },
        [SESSION_STATUS.PAUSED]: { class: 'bg-yellow-100 text-yellow-800', text: 'متوقفة', icon: 'fa-pause-circle' },
        [SESSION_STATUS.COMPLETED]: { class: 'bg-blue-100 text-blue-800', text: 'مكتملة', icon: 'fa-check-circle' },
        [SESSION_STATUS.CANCELLED]: { class: 'bg-red-100 text-red-800', text: 'ملغاة', icon: 'fa-times-circle' }
    };
    
    return badges[status] || badges[SESSION_STATUS.DRAFT];
}

// === Export for global access ===
window.SESSION_STATUS = SESSION_STATUS;
window.initializeSessionsStore = initializeSessionsStore;
window.getSessions = getSessions;
window.getActiveSession = getActiveSession;
window.createSession = createSession;
window.updateSession = updateSession;
window.startSession = startSession;
window.pauseSession = pauseSession;
window.completeSession = completeSession;
window.cancelSession = cancelSession;
window.deleteSession = deleteSession;
window.addAssetToSession = addAssetToSession;
window.getSessionStatistics = getSessionStatistics;
window.getUserDailyStats = getUserDailyStats;
window.getAllWorkersStats = getAllWorkersStats;
window.getCurrentLocation = getCurrentLocation;
window.generateMapsLink = generateMapsLink;
window.getSessionStatusBadge = getSessionStatusBadge;
