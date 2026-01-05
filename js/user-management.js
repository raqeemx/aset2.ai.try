/**
 * User Management System
 * نظام إدارة المستخدمين
 * للمشرف العام فقط
 */

// Users State
const USERS_STATE = {
    users: [],
    branches: []
};

/**
 * Initialize User Management
 */
async function initUserManagement() {
    await loadUsers();
    await loadBranches();
    renderUsersTable();
    renderBranchesSelect();
}

/**
 * Load users from storage
 */
async function loadUsers() {
    try {
        USERS_STATE.users = await dbGetAll('users') || [];

        // Sync from Firebase if available
        if (isFirebaseReady() && APP_STATE.isOnline && hasPermission('canManageUsers')) {
            await syncUsers();
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

/**
 * Sync users from Firebase
 */
async function syncUsers() {
    if (!isFirebaseReady()) return;

    try {
        const { collection, getDocs } = window.FirebaseModules.firestore;
        const snapshot = await getDocs(collection(getFirebaseDB(), 'users'));
        
        snapshot.forEach(async (doc) => {
            const userData = { id: doc.id, ...doc.data() };
            const existingIndex = USERS_STATE.users.findIndex(u => u.id === userData.id);
            
            if (existingIndex >= 0) {
                USERS_STATE.users[existingIndex] = userData;
            } else {
                USERS_STATE.users.push(userData);
            }
            
            await dbPut('users', userData);
        });
    } catch (error) {
        console.error('Error syncing users:', error);
    }
}

/**
 * Load branches
 */
async function loadBranches() {
    try {
        USERS_STATE.branches = await dbGetAll('branches') || [];
        
        // Default branches if empty
        if (USERS_STATE.branches.length === 0) {
            USERS_STATE.branches = [
                { id: 'main', name: 'المقر الرئيسي' },
                { id: 'branch1', name: 'فرع 1' },
                { id: 'branch2', name: 'فرع 2' }
            ];
        }
    } catch (error) {
        console.error('Error loading branches:', error);
    }
}

/**
 * Create new user
 */
async function createUser(userData) {
    if (!hasPermission('canManageUsers')) {
        showToast('ليس لديك صلاحية لإضافة مستخدمين', 'error');
        return null;
    }

    try {
        showLoading();

        const newUser = {
            id: generateId(),
            username: userData.username,
            email: userData.email || '',
            displayName: userData.displayName,
            role: userData.role,
            branch: userData.branch || null,
            branchName: USERS_STATE.branches.find(b => b.id === userData.branch)?.name || '',
            phone: userData.phone || '',
            isActive: true,
            createdAt: new Date().toISOString(),
            createdBy: currentUserData?.id,
            stats: {
                totalAssets: 0,
                lastActivity: null
            }
        };

        // Save to IndexedDB
        await dbPut('users', newUser);
        USERS_STATE.users.push(newUser);

        // Save to Firebase if available
        if (isFirebaseReady() && APP_STATE.isOnline) {
            const { doc, setDoc } = window.FirebaseModules.firestore;
            await setDoc(doc(getFirebaseDB(), 'users', newUser.id), newUser);
        }

        // Log activity
        await logActivity('user_created', 'إنشاء مستخدم جديد', {
            userId: newUser.id,
            username: newUser.username,
            role: newUser.role
        });

        showToast('تم إنشاء المستخدم بنجاح', 'success');
        renderUsersTable();
        
        return newUser;

    } catch (error) {
        console.error('Error creating user:', error);
        showToast('فشل إنشاء المستخدم', 'error');
        return null;
    } finally {
        hideLoading();
    }
}

/**
 * Update user
 */
async function updateUser(userId, updates) {
    if (!hasPermission('canManageUsers')) {
        showToast('ليس لديك صلاحية لتعديل المستخدمين', 'error');
        return false;
    }

    try {
        const userIndex = USERS_STATE.users.findIndex(u => u.id === userId);
        if (userIndex < 0) {
            showToast('المستخدم غير موجود', 'error');
            return false;
        }

        const updatedUser = {
            ...USERS_STATE.users[userIndex],
            ...updates,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUserData?.id
        };

        // Save to IndexedDB
        await dbPut('users', updatedUser);
        USERS_STATE.users[userIndex] = updatedUser;

        // Save to Firebase if available
        if (isFirebaseReady() && APP_STATE.isOnline) {
            const { doc, updateDoc } = window.FirebaseModules.firestore;
            await updateDoc(doc(getFirebaseDB(), 'users', userId), updates);
        }

        // Log activity
        await logActivity('user_updated', 'تحديث مستخدم', {
            userId,
            updates: Object.keys(updates)
        });

        showToast('تم تحديث المستخدم بنجاح', 'success');
        renderUsersTable();
        
        return true;

    } catch (error) {
        console.error('Error updating user:', error);
        showToast('فشل تحديث المستخدم', 'error');
        return false;
    }
}

/**
 * Delete user (soft delete)
 */
async function deleteUser(userId) {
    if (!hasPermission('canManageUsers')) {
        showToast('ليس لديك صلاحية لحذف المستخدمين', 'error');
        return false;
    }

    // Prevent self-deletion
    if (userId === currentUserData?.id) {
        showToast('لا يمكنك حذف حسابك الخاص', 'error');
        return false;
    }

    const confirmed = await showConfirmDialog(
        'حذف المستخدم',
        'هل أنت متأكد من حذف هذا المستخدم؟ لن يتم حذف البيانات المرتبطة به.'
    );

    if (!confirmed) return false;

    try {
        // Soft delete
        await updateUser(userId, { isActive: false, deletedAt: new Date().toISOString() });
        
        showToast('تم حذف المستخدم', 'success');
        return true;

    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('فشل حذف المستخدم', 'error');
        return false;
    }
}

/**
 * Activate/Deactivate user
 */
async function toggleUserStatus(userId) {
    const user = USERS_STATE.users.find(u => u.id === userId);
    if (!user) return;

    await updateUser(userId, { isActive: !user.isActive });
}

/**
 * Get user statistics
 */
function getUserStats(userId) {
    const userAssets = APP_STATE.assets.filter(a => a.createdBy === userId);
    const today = new Date().toDateString();
    const todayAssets = userAssets.filter(a => new Date(a.createdAt).toDateString() === today);
    
    const lastAsset = userAssets.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    )[0];

    return {
        totalAssets: userAssets.length,
        todayAssets: todayAssets.length,
        lastActivity: lastAsset?.createdAt || null,
        sessions: [...new Set(userAssets.map(a => a.sessionId).filter(Boolean))].length
    };
}

/**
 * Render users table
 */
function renderUsersTable() {
    const container = document.getElementById('usersTableBody');
    if (!container) return;

    const activeUsers = USERS_STATE.users.filter(u => u.isActive !== false);

    if (activeUsers.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8 text-gray-500">
                    لا يوجد مستخدمين
                </td>
            </tr>
        `;
        return;
    }

    container.innerHTML = activeUsers.map(user => {
        const stats = getUserStats(user.id);
        const isCurrentUser = user.id === currentUserData?.id;
        
        return `
            <tr class="${isCurrentUser ? 'bg-blue-50' : ''}">
                <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-gov-blue text-white rounded-full flex items-center justify-center">
                            ${user.displayName?.charAt(0) || user.username?.charAt(0) || '?'}
                        </div>
                        <div>
                            <p class="font-medium">${user.displayName || user.username}</p>
                            <p class="text-xs text-gray-500">@${user.username}</p>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 rounded-full text-xs ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                    }">
                        ${ROLE_LABELS[user.role] || user.role}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm">${user.branchName || '-'}</td>
                <td class="px-4 py-3">
                    <div class="text-center">
                        <p class="text-lg font-bold text-gov-blue">${stats.totalAssets}</p>
                        <p class="text-xs text-gray-500">أصل</p>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <div class="text-center">
                        <p class="text-lg font-bold text-gov-green">${stats.todayAssets}</p>
                        <p class="text-xs text-gray-500">اليوم</p>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-500">
                    ${stats.lastActivity ? formatTimeAgo(new Date(stats.lastActivity)) : 'لا يوجد نشاط'}
                </td>
                <td class="px-4 py-3">
                    ${!isCurrentUser ? `
                        <div class="flex gap-2">
                            <button onclick="openEditUserModal('${user.id}')" 
                                    class="p-2 text-blue-600 hover:bg-blue-50 rounded">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteUser('${user.id}')" 
                                    class="p-2 text-red-600 hover:bg-red-50 rounded">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    ` : '<span class="text-xs text-gray-400">أنت</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Render branches select
 */
function renderBranchesSelect() {
    const selects = document.querySelectorAll('.branch-select');
    selects.forEach(select => {
        select.innerHTML = `
            <option value="">اختر الفرع</option>
            ${USERS_STATE.branches.map(branch => `
                <option value="${branch.id}">${branch.name}</option>
            `).join('')}
        `;
    });
}

/**
 * Open add user modal
 */
function openAddUserModal() {
    const modal = document.getElementById('userModal');
    if (!modal) return;

    document.getElementById('userModalTitle').textContent = 'إضافة مستخدم جديد';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    
    renderBranchesSelect();
    modal.classList.remove('hidden');
}

/**
 * Open edit user modal
 */
function openEditUserModal(userId) {
    const user = USERS_STATE.users.find(u => u.id === userId);
    if (!user) return;

    const modal = document.getElementById('userModal');
    if (!modal) return;

    document.getElementById('userModalTitle').textContent = 'تعديل المستخدم';
    document.getElementById('userId').value = user.id;
    document.getElementById('userUsername').value = user.username;
    document.getElementById('userDisplayName').value = user.displayName || '';
    document.getElementById('userEmail').value = user.email || '';
    document.getElementById('userPhone').value = user.phone || '';
    document.getElementById('userRole').value = user.role;
    document.getElementById('userBranch').value = user.branch || '';

    renderBranchesSelect();
    modal.classList.remove('hidden');
}

/**
 * Close user modal
 */
function closeUserModal() {
    document.getElementById('userModal')?.classList.add('hidden');
}

/**
 * Handle user form submit
 */
async function handleUserFormSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const userId = form.userId.value;
    
    const userData = {
        username: form.userUsername.value.trim(),
        displayName: form.userDisplayName.value.trim(),
        email: form.userEmail.value.trim(),
        phone: form.userPhone.value.trim(),
        role: form.userRole.value,
        branch: form.userBranch.value || null
    };

    // Validate
    if (!userData.username) {
        showToast('اسم المستخدم مطلوب', 'error');
        return;
    }

    if (!userData.displayName) {
        showToast('الاسم الكامل مطلوب', 'error');
        return;
    }

    if (!userData.role) {
        showToast('الصلاحية مطلوبة', 'error');
        return;
    }

    // Check for duplicate username (except current user)
    const existingUser = USERS_STATE.users.find(u => 
        u.username === userData.username && u.id !== userId
    );
    if (existingUser) {
        showToast('اسم المستخدم موجود مسبقاً', 'error');
        return;
    }

    if (userId) {
        await updateUser(userId, userData);
    } else {
        await createUser(userData);
    }

    closeUserModal();
}

/**
 * Create branch
 */
async function createBranch(branchData) {
    if (!hasPermission('canManageLocations')) {
        showToast('ليس لديك صلاحية لإضافة فروع', 'error');
        return null;
    }

    const branch = {
        id: generateId(),
        name: branchData.name,
        address: branchData.address || '',
        manager: branchData.manager || null,
        createdAt: new Date().toISOString()
    };

    await dbPut('branches', branch);
    USERS_STATE.branches.push(branch);
    
    renderBranchesSelect();
    showToast('تم إنشاء الفرع بنجاح', 'success');
    
    return branch;
}

/**
 * Get users by branch
 */
function getUsersByBranch(branchId) {
    return USERS_STATE.users.filter(u => u.branch === branchId && u.isActive !== false);
}

/**
 * Get users by role
 */
function getUsersByRole(role) {
    return USERS_STATE.users.filter(u => u.role === role && u.isActive !== false);
}

/**
 * Render user statistics dashboard
 */
function renderUserStatsDashboard() {
    const container = document.getElementById('userStatsDashboard');
    if (!container) return;

    const users = USERS_STATE.users.filter(u => u.isActive !== false);
    
    // Calculate stats
    const totalUsers = users.length;
    const adminCount = users.filter(u => u.role === 'admin').length;
    const managerCount = users.filter(u => u.role === 'manager').length;
    const fieldUserCount = users.filter(u => u.role === 'field_user').length;

    // Calculate productivity (assets per user today)
    const today = new Date().toDateString();
    const userProductivity = users.map(user => {
        const todayAssets = APP_STATE.assets.filter(a => 
            a.createdBy === user.id && 
            new Date(a.createdAt).toDateString() === today
        ).length;
        return { ...user, todayAssets };
    }).sort((a, b) => b.todayAssets - a.todayAssets);

    container.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
                <p class="text-3xl font-bold text-gov-blue">${totalUsers}</p>
                <p class="text-sm text-gray-500">إجمالي المستخدمين</p>
            </div>
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
                <p class="text-3xl font-bold text-purple-600">${adminCount}</p>
                <p class="text-sm text-gray-500">مشرفين</p>
            </div>
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
                <p class="text-3xl font-bold text-blue-600">${managerCount}</p>
                <p class="text-sm text-gray-500">مدراء</p>
            </div>
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
                <p class="text-3xl font-bold text-gray-600">${fieldUserCount}</p>
                <p class="text-sm text-gray-500">عمال ميدانيين</p>
            </div>
        </div>
        
        <h4 class="font-bold text-gray-800 mb-3">ترتيب الإنتاجية اليوم</h4>
        <div class="bg-white rounded-xl shadow-sm overflow-hidden">
            ${userProductivity.slice(0, 10).map((user, index) => `
                <div class="flex items-center justify-between p-4 border-b last:border-b-0">
                    <div class="flex items-center gap-3">
                        <span class="w-8 h-8 flex items-center justify-center rounded-full ${
                            index === 0 ? 'bg-yellow-400 text-white' :
                            index === 1 ? 'bg-gray-300 text-gray-700' :
                            index === 2 ? 'bg-amber-600 text-white' :
                            'bg-gray-100 text-gray-600'
                        } font-bold text-sm">
                            ${index + 1}
                        </span>
                        <div>
                            <p class="font-medium">${user.displayName || user.username}</p>
                            <p class="text-xs text-gray-500">${user.branchName || 'بدون فرع'}</p>
                        </div>
                    </div>
                    <div class="text-left">
                        <p class="text-xl font-bold text-gov-blue">${user.todayAssets}</p>
                        <p class="text-xs text-gray-500">أصل اليوم</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Show confirm dialog
 */
function showConfirmDialog(title, message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-xl p-6 max-w-md w-full">
                <h3 class="text-lg font-bold text-gray-800 mb-2">${title}</h3>
                <p class="text-gray-600 mb-6">${message}</p>
                <div class="flex gap-3">
                    <button id="confirmBtn" class="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600">
                        تأكيد
                    </button>
                    <button id="cancelBtn" class="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50">
                        إلغاء
                    </button>
                </div>
            </div>
        `;

        modal.querySelector('#confirmBtn').onclick = () => {
            modal.remove();
            resolve(true);
        };

        modal.querySelector('#cancelBtn').onclick = () => {
            modal.remove();
            resolve(false);
        };

        document.body.appendChild(modal);
    });
}

/**
 * Export User Management functions
 */
window.UserManagement = {
    init: initUserManagement,
    createUser,
    updateUser,
    deleteUser,
    toggleStatus: toggleUserStatus,
    getStats: getUserStats,
    getUsersByBranch,
    getUsersByRole,
    openAddModal: openAddUserModal,
    openEditModal: openEditUserModal,
    createBranch,
    renderStats: renderUserStatsDashboard
};
