/**
 * Audit Sessions Management
 * نظام إدارة جلسات الجرد
 */

// Audit Sessions State
const SESSIONS_STATE = {
    sessions: [],
    currentSession: null,
    activeSessionId: null
};

/**
 * Audit Session Status
 */
const SESSION_STATUS = {
    DRAFT: 'draft',           // مسودة
    ACTIVE: 'active',         // نشطة
    PAUSED: 'paused',         // متوقفة مؤقتاً
    COMPLETED: 'completed',   // مكتملة
    CANCELLED: 'cancelled'    // ملغاة
};

const SESSION_STATUS_LABELS = {
    draft: 'مسودة',
    active: 'نشطة',
    paused: 'متوقفة',
    completed: 'مكتملة',
    cancelled: 'ملغاة'
};

const SESSION_STATUS_COLORS = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800'
};

/**
 * Initialize Audit Sessions
 */
async function initAuditSessions() {
    await loadSessions();
    renderSessionsList();
    updateSessionStats();
}

/**
 * Load sessions from storage
 */
async function loadSessions() {
    try {
        // Load from IndexedDB first
        SESSIONS_STATE.sessions = await dbGetAll('auditSessions') || [];

        // If Firebase is available and online, sync
        if (isFirebaseReady() && APP_STATE.isOnline) {
            await syncSessions();
        }

        // Load active session
        const activeSessionId = localStorage.getItem('activeSessionId');
        if (activeSessionId) {
            SESSIONS_STATE.activeSessionId = activeSessionId;
            SESSIONS_STATE.currentSession = SESSIONS_STATE.sessions.find(s => s.id === activeSessionId);
        }

    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

/**
 * Sync sessions with Firebase
 */
async function syncSessions() {
    if (!isFirebaseReady()) return;

    try {
        const { collection, getDocs, query, where } = window.FirebaseModules.firestore;
        
        // Build query based on user role
        let sessionsQuery;
        if (AUTH_STATE.role === USER_ROLES.ADMIN) {
            sessionsQuery = collection(getFirebaseDB(), 'auditSessions');
        } else {
            sessionsQuery = query(
                collection(getFirebaseDB(), 'auditSessions'),
                where('branch', '==', AUTH_STATE.branch)
            );
        }

        const snapshot = await getDocs(sessionsQuery);
        const firebaseSessions = [];
        
        snapshot.forEach(doc => {
            firebaseSessions.push({ id: doc.id, ...doc.data() });
        });

        // Merge with local sessions
        for (const session of firebaseSessions) {
            const localIndex = SESSIONS_STATE.sessions.findIndex(s => s.id === session.id);
            if (localIndex >= 0) {
                // Update if Firebase version is newer
                if (new Date(session.updatedAt) > new Date(SESSIONS_STATE.sessions[localIndex].updatedAt)) {
                    SESSIONS_STATE.sessions[localIndex] = session;
                    await dbPut('auditSessions', session);
                }
            } else {
                SESSIONS_STATE.sessions.push(session);
                await dbPut('auditSessions', session);
            }
        }

    } catch (error) {
        console.error('Error syncing sessions:', error);
    }
}

/**
 * Create new audit session
 */
async function createSession(sessionData) {
    if (!hasPermission('canCreateSessions')) {
        showToast('ليس لديك صلاحية لإنشاء جلسات جرد', 'error');
        return null;
    }

    try {
        showLoading();

        const session = {
            id: generateId(),
            name: sessionData.name,
            description: sessionData.description || '',
            branch: AUTH_STATE.role === USER_ROLES.ADMIN ? sessionData.branch : AUTH_STATE.branch,
            branchName: sessionData.branchName || '',
            status: SESSION_STATUS.DRAFT,
            startDate: sessionData.startDate || new Date().toISOString(),
            endDate: sessionData.endDate || null,
            targetAssetCount: sessionData.targetAssetCount || 0,
            scannedAssetCount: 0,
            participants: sessionData.participants || [],
            participantNames: sessionData.participantNames || [],
            notes: sessionData.notes || '',
            createdBy: currentUserData?.id,
            createdByName: currentUserData?.displayName || currentUserData?.username,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save to IndexedDB
        await dbPut('auditSessions', session);
        SESSIONS_STATE.sessions.push(session);

        // Save to Firebase if available
        if (isFirebaseReady() && APP_STATE.isOnline) {
            const { doc, setDoc } = window.FirebaseModules.firestore;
            await setDoc(doc(getFirebaseDB(), 'auditSessions', session.id), session);
        }

        // Log activity
        await logActivity('session_created', 'إنشاء جلسة جرد جديدة', {
            sessionId: session.id,
            sessionName: session.name,
            branch: session.branch
        });

        showToast('تم إنشاء جلسة الجرد بنجاح', 'success');
        renderSessionsList();
        updateSessionStats();
        
        return session;

    } catch (error) {
        console.error('Error creating session:', error);
        showToast('فشل إنشاء جلسة الجرد', 'error');
        return null;
    } finally {
        hideLoading();
    }
}

/**
 * Update session
 */
async function updateSession(sessionId, updates) {
    try {
        const sessionIndex = SESSIONS_STATE.sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex < 0) {
            showToast('جلسة الجرد غير موجودة', 'error');
            return false;
        }

        const session = SESSIONS_STATE.sessions[sessionIndex];
        
        // Check permission
        if (!canAccessBranch(session.branch)) {
            showToast('ليس لديك صلاحية لتعديل هذه الجلسة', 'error');
            return false;
        }

        // Update session
        const updatedSession = {
            ...session,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        // Save to IndexedDB
        await dbPut('auditSessions', updatedSession);
        SESSIONS_STATE.sessions[sessionIndex] = updatedSession;

        // Save to Firebase if available
        if (isFirebaseReady() && APP_STATE.isOnline) {
            const { doc, updateDoc } = window.FirebaseModules.firestore;
            await updateDoc(doc(getFirebaseDB(), 'auditSessions', sessionId), updates);
        }

        // Log activity
        await logActivity('session_updated', 'تحديث جلسة جرد', {
            sessionId,
            updates: Object.keys(updates)
        });

        renderSessionsList();
        updateSessionStats();
        
        return true;

    } catch (error) {
        console.error('Error updating session:', error);
        showToast('فشل تحديث جلسة الجرد', 'error');
        return false;
    }
}

/**
 * Start session
 */
async function startSession(sessionId) {
    return await updateSession(sessionId, {
        status: SESSION_STATUS.ACTIVE,
        actualStartDate: new Date().toISOString()
    });
}

/**
 * Pause session
 */
async function pauseSession(sessionId) {
    return await updateSession(sessionId, {
        status: SESSION_STATUS.PAUSED
    });
}

/**
 * Resume session
 */
async function resumeSession(sessionId) {
    return await updateSession(sessionId, {
        status: SESSION_STATUS.ACTIVE
    });
}

/**
 * Complete session
 */
async function completeSession(sessionId) {
    const session = SESSIONS_STATE.sessions.find(s => s.id === sessionId);
    if (!session) return false;

    // Calculate final stats
    const sessionAssets = APP_STATE.assets.filter(a => a.sessionId === sessionId);
    
    return await updateSession(sessionId, {
        status: SESSION_STATUS.COMPLETED,
        actualEndDate: new Date().toISOString(),
        scannedAssetCount: sessionAssets.length,
        completionRate: session.targetAssetCount > 0 
            ? Math.round((sessionAssets.length / session.targetAssetCount) * 100) 
            : 100
    });
}

/**
 * Cancel session
 */
async function cancelSession(sessionId) {
    return await updateSession(sessionId, {
        status: SESSION_STATUS.CANCELLED,
        cancelledAt: new Date().toISOString(),
        cancelledBy: currentUserData?.id
    });
}

/**
 * Set active session for current user
 */
function setActiveSession(sessionId) {
    SESSIONS_STATE.activeSessionId = sessionId;
    SESSIONS_STATE.currentSession = SESSIONS_STATE.sessions.find(s => s.id === sessionId);
    localStorage.setItem('activeSessionId', sessionId);
    
    updateActiveSessionDisplay();
    showToast('تم تحديد جلسة الجرد النشطة', 'success');
}

/**
 * Get current active session
 */
function getActiveSession() {
    return SESSIONS_STATE.currentSession;
}

/**
 * Update active session display in UI
 */
function updateActiveSessionDisplay() {
    const displayEl = document.getElementById('activeSessionDisplay');
    if (displayEl) {
        if (SESSIONS_STATE.currentSession) {
            displayEl.innerHTML = `
                <div class="flex items-center gap-2 bg-green-100 px-3 py-2 rounded-lg">
                    <i class="fas fa-clipboard-check text-green-600"></i>
                    <span class="text-sm font-medium text-green-800">${SESSIONS_STATE.currentSession.name}</span>
                </div>
            `;
            displayEl.classList.remove('hidden');
        } else {
            displayEl.classList.add('hidden');
        }
    }
}

/**
 * Get session by ID
 */
function getSessionById(sessionId) {
    return SESSIONS_STATE.sessions.find(s => s.id === sessionId);
}

/**
 * Get sessions for current user (filtered by role)
 */
function getFilteredSessions() {
    if (AUTH_STATE.role === USER_ROLES.ADMIN) {
        return SESSIONS_STATE.sessions;
    }
    return SESSIONS_STATE.sessions.filter(s => s.branch === AUTH_STATE.branch);
}

/**
 * Get active sessions
 */
function getActiveSessions() {
    return getFilteredSessions().filter(s => s.status === SESSION_STATUS.ACTIVE);
}

/**
 * Get session statistics
 */
function getSessionStats(sessionId) {
    const session = getSessionById(sessionId);
    if (!session) return null;

    const sessionAssets = APP_STATE.assets.filter(a => a.sessionId === sessionId);
    
    // Group by user
    const userStats = {};
    sessionAssets.forEach(asset => {
        const userId = asset.createdBy || 'unknown';
        if (!userStats[userId]) {
            userStats[userId] = {
                userId,
                userName: asset.createdByName || 'غير معروف',
                count: 0,
                lastActivity: null
            };
        }
        userStats[userId].count++;
        if (!userStats[userId].lastActivity || asset.createdAt > userStats[userId].lastActivity) {
            userStats[userId].lastActivity = asset.createdAt;
        }
    });

    return {
        totalScanned: sessionAssets.length,
        targetCount: session.targetAssetCount,
        completionRate: session.targetAssetCount > 0 
            ? Math.round((sessionAssets.length / session.targetAssetCount) * 100) 
            : 0,
        userStats: Object.values(userStats),
        todayCount: sessionAssets.filter(a => isToday(a.createdAt)).length
    };
}

/**
 * Check if date is today
 */
function isToday(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

/**
 * Render sessions list
 */
function renderSessionsList() {
    const container = document.getElementById('sessionsList');
    if (!container) return;

    const sessions = getFilteredSessions();
    
    if (sessions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <i class="fas fa-clipboard-list text-4xl mb-4"></i>
                <p>لا توجد جلسات جرد</p>
            </div>
        `;
        return;
    }

    container.innerHTML = sessions.map(session => {
        const stats = getSessionStats(session.id);
        const isActive = SESSIONS_STATE.activeSessionId === session.id;
        
        return `
            <div class="bg-white rounded-xl shadow-sm border ${isActive ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-200'} p-6 mb-4">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h3 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                            ${session.name}
                            ${isActive ? '<span class="text-xs bg-green-500 text-white px-2 py-1 rounded">نشطة</span>' : ''}
                        </h3>
                        <p class="text-sm text-gray-500">${session.branchName || session.branch || 'بدون فرع'}</p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-sm ${SESSION_STATUS_COLORS[session.status]}">
                        ${SESSION_STATUS_LABELS[session.status]}
                    </span>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div class="text-center">
                        <p class="text-2xl font-bold text-gov-blue">${stats?.totalScanned || 0}</p>
                        <p class="text-xs text-gray-500">أصول ممسوحة</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-gray-600">${session.targetAssetCount || '-'}</p>
                        <p class="text-xs text-gray-500">الهدف</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-gov-green">${stats?.completionRate || 0}%</p>
                        <p class="text-xs text-gray-500">نسبة الإنجاز</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-gov-gold">${stats?.todayCount || 0}</p>
                        <p class="text-xs text-gray-500">اليوم</p>
                    </div>
                </div>
                
                <div class="flex items-center justify-between pt-4 border-t">
                    <div class="text-sm text-gray-500">
                        <i class="fas fa-users ml-1"></i>
                        ${session.participants?.length || 0} مشارك
                    </div>
                    <div class="flex gap-2">
                        ${session.status === SESSION_STATUS.DRAFT ? `
                            <button onclick="startSession('${session.id}')" class="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
                                <i class="fas fa-play ml-1"></i> بدء
                            </button>
                        ` : ''}
                        ${session.status === SESSION_STATUS.ACTIVE ? `
                            <button onclick="setActiveSession('${session.id}')" class="px-3 py-1 bg-gov-blue text-white rounded-lg text-sm hover:bg-gov-blue-light">
                                <i class="fas fa-check ml-1"></i> تحديد
                            </button>
                            <button onclick="pauseSession('${session.id}')" class="px-3 py-1 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600">
                                <i class="fas fa-pause ml-1"></i> إيقاف
                            </button>
                        ` : ''}
                        ${session.status === SESSION_STATUS.PAUSED ? `
                            <button onclick="resumeSession('${session.id}')" class="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
                                <i class="fas fa-play ml-1"></i> استئناف
                            </button>
                        ` : ''}
                        <button onclick="viewSessionDetails('${session.id}')" class="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                            <i class="fas fa-eye ml-1"></i> تفاصيل
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Update session statistics in dashboard
 */
function updateSessionStats() {
    const activeCount = getActiveSessions().length;
    const el = document.getElementById('activeSessionsCount');
    if (el) {
        el.textContent = activeCount;
    }
}

/**
 * View session details
 */
function viewSessionDetails(sessionId) {
    const session = getSessionById(sessionId);
    if (!session) return;

    const stats = getSessionStats(sessionId);
    
    // Create modal content
    const modalContent = `
        <div class="p-6">
            <h2 class="text-2xl font-bold text-gray-800 mb-6">${session.name}</h2>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-blue-50 rounded-xl p-4 text-center">
                    <p class="text-3xl font-bold text-gov-blue">${stats?.totalScanned || 0}</p>
                    <p class="text-sm text-gray-600">أصول ممسوحة</p>
                </div>
                <div class="bg-gray-50 rounded-xl p-4 text-center">
                    <p class="text-3xl font-bold text-gray-600">${session.targetAssetCount || '-'}</p>
                    <p class="text-sm text-gray-600">الهدف</p>
                </div>
                <div class="bg-green-50 rounded-xl p-4 text-center">
                    <p class="text-3xl font-bold text-gov-green">${stats?.completionRate || 0}%</p>
                    <p class="text-sm text-gray-600">نسبة الإنجاز</p>
                </div>
                <div class="bg-amber-50 rounded-xl p-4 text-center">
                    <p class="text-3xl font-bold text-gov-gold">${stats?.todayCount || 0}</p>
                    <p class="text-sm text-gray-600">اليوم</p>
                </div>
            </div>

            <div class="mb-6">
                <h3 class="font-bold text-gray-800 mb-3">إحصائيات المشاركين</h3>
                <div class="bg-gray-50 rounded-xl p-4">
                    ${stats?.userStats?.length > 0 ? `
                        <table class="w-full">
                            <thead>
                                <tr class="text-right text-gray-600 text-sm">
                                    <th class="pb-2">المستخدم</th>
                                    <th class="pb-2">عدد الأصول</th>
                                    <th class="pb-2">آخر نشاط</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${stats.userStats.map(u => `
                                    <tr class="border-t">
                                        <td class="py-2">${u.userName}</td>
                                        <td class="py-2">${u.count}</td>
                                        <td class="py-2 text-sm text-gray-500">
                                            ${u.lastActivity ? new Date(u.lastActivity).toLocaleString('ar-SA') : '-'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p class="text-gray-500 text-center">لا توجد بيانات</p>'}
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p class="text-gray-500">تاريخ البدء</p>
                    <p class="font-medium">${session.startDate ? new Date(session.startDate).toLocaleDateString('ar-SA') : '-'}</p>
                </div>
                <div>
                    <p class="text-gray-500">تاريخ الانتهاء</p>
                    <p class="font-medium">${session.endDate ? new Date(session.endDate).toLocaleDateString('ar-SA') : '-'}</p>
                </div>
                <div>
                    <p class="text-gray-500">أنشئت بواسطة</p>
                    <p class="font-medium">${session.createdByName || '-'}</p>
                </div>
                <div>
                    <p class="text-gray-500">الحالة</p>
                    <span class="px-2 py-1 rounded ${SESSION_STATUS_COLORS[session.status]}">${SESSION_STATUS_LABELS[session.status]}</span>
                </div>
            </div>
        </div>
    `;

    // Show in modal
    showCustomModal('تفاصيل جلسة الجرد', modalContent);
}

/**
 * Open create session modal
 */
function openCreateSessionModal() {
    document.getElementById('sessionModal')?.classList.remove('hidden');
    document.getElementById('sessionForm')?.reset();
}

/**
 * Close session modal
 */
function closeSessionModal() {
    document.getElementById('sessionModal')?.classList.add('hidden');
}

/**
 * Handle session form submit
 */
async function handleSessionFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const sessionData = {
        name: form.sessionName.value,
        description: form.sessionDescription?.value || '',
        branch: form.sessionBranch?.value || AUTH_STATE.branch,
        branchName: form.sessionBranch?.selectedOptions[0]?.text || '',
        startDate: form.sessionStartDate?.value,
        endDate: form.sessionEndDate?.value,
        targetAssetCount: parseInt(form.targetAssetCount?.value) || 0,
        participants: Array.from(form.participants?.selectedOptions || []).map(o => o.value),
        participantNames: Array.from(form.participants?.selectedOptions || []).map(o => o.text),
        notes: form.sessionNotes?.value || ''
    };

    const session = await createSession(sessionData);
    if (session) {
        closeSessionModal();
    }
}

/**
 * Show custom modal
 */
function showCustomModal(title, content) {
    const modal = document.getElementById('customModal');
    if (modal) {
        document.getElementById('customModalTitle').textContent = title;
        document.getElementById('customModalContent').innerHTML = content;
        modal.classList.remove('hidden');
    }
}

/**
 * Close custom modal
 */
function closeCustomModal() {
    document.getElementById('customModal')?.classList.add('hidden');
}
