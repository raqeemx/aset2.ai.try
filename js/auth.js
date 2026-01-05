/**
 * Authentication System
 * نظام المصادقة وإدارة المستخدمين
 * يدعم ثلاثة أنواع من المستخدمين: Admin, Manager, Field User
 */

// User Roles
const USER_ROLES = {
    ADMIN: 'admin',           // المشرف العام - صلاحيات كاملة
    MANAGER: 'manager',       // المدير - صلاحيات على مستوى الفرع
    FIELD_USER: 'field_user'  // العامل الميداني - صلاحيات محدودة
};

// Role Labels in Arabic
const ROLE_LABELS = {
    admin: 'مشرف عام',
    manager: 'مدير فرع',
    field_user: 'عامل ميداني'
};

// Current User State
let currentUser = null;
let currentUserData = null;

/**
 * Authentication State
 */
const AUTH_STATE = {
    isAuthenticated: false,
    user: null,
    role: null,
    branch: null,
    permissions: []
};

/**
 * Role-based Permissions
 */
const ROLE_PERMISSIONS = {
    admin: {
        canViewAllAssets: true,
        canViewAllBranches: true,
        canViewAllUsers: true,
        canEditAnyAsset: true,
        canDeleteAnyAsset: true,
        canManageUsers: true,
        canCreateSessions: true,
        canViewAllReports: true,
        canExportData: true,
        canManageCategories: true,
        canManageLocations: true,
        canViewAuditLog: true
    },
    manager: {
        canViewAllAssets: false,      // فقط أصول فرعه
        canViewAllBranches: false,
        canViewAllUsers: false,       // فقط عمال فرعه
        canEditAnyAsset: false,       // فقط أصول فرعه
        canDeleteAnyAsset: false,     // فقط أصول فرعه
        canManageUsers: false,
        canCreateSessions: true,      // فقط لفرعه
        canViewAllReports: false,     // فقط تقارير فرعه
        canExportData: true,
        canManageCategories: false,
        canManageLocations: false,
        canViewAuditLog: true         // فقط لفرعه
    },
    field_user: {
        canViewAllAssets: false,      // فقط أصوله
        canViewAllBranches: false,
        canViewAllUsers: false,
        canEditAnyAsset: false,       // فقط أصوله
        canDeleteAnyAsset: false,
        canManageUsers: false,
        canCreateSessions: false,
        canViewAllReports: false,
        canExportData: false,
        canManageCategories: false,
        canManageLocations: false,
        canViewAuditLog: false
    }
};

/**
 * Initialize Authentication System
 */
async function initAuth() {
    // Check for stored session
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            currentUserData = JSON.parse(storedUser);
            AUTH_STATE.isAuthenticated = true;
            AUTH_STATE.user = currentUserData;
            AUTH_STATE.role = currentUserData.role;
            AUTH_STATE.branch = currentUserData.branch;
            AUTH_STATE.permissions = ROLE_PERMISSIONS[currentUserData.role] || {};
            return true;
        } catch (e) {
            localStorage.removeItem('currentUser');
        }
    }

    // If Firebase is configured, listen for auth state changes
    if (isFirebaseReady()) {
        const { onAuthStateChanged } = window.FirebaseModules.auth;
        onAuthStateChanged(getFirebaseAuth(), async (user) => {
            if (user) {
                await loadUserData(user.uid);
                updateUIForRole();
            } else {
                handleLogout();
            }
        });
    }

    return AUTH_STATE.isAuthenticated;
}

/**
 * Load user data from Firestore
 */
async function loadUserData(userId) {
    if (!isFirebaseReady()) return null;

    try {
        const { doc, getDoc } = window.FirebaseModules.firestore;
        const userDoc = await getDoc(doc(getFirebaseDB(), 'users', userId));
        
        if (userDoc.exists()) {
            currentUserData = { id: userId, ...userDoc.data() };
            AUTH_STATE.isAuthenticated = true;
            AUTH_STATE.user = currentUserData;
            AUTH_STATE.role = currentUserData.role;
            AUTH_STATE.branch = currentUserData.branch;
            AUTH_STATE.permissions = ROLE_PERMISSIONS[currentUserData.role] || {};
            
            // Store in localStorage for offline access
            localStorage.setItem('currentUser', JSON.stringify(currentUserData));
            
            return currentUserData;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
    return null;
}

/**
 * Login with email and password (Firebase)
 */
async function loginWithEmail(email, password) {
    if (!isFirebaseReady()) {
        showToast('Firebase غير متاح. استخدم تسجيل الدخول المحلي.', 'error');
        return false;
    }

    try {
        showLoading();
        const { signInWithEmailAndPassword } = window.FirebaseModules.auth;
        const userCredential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
        
        await loadUserData(userCredential.user.uid);
        
        // Log activity
        await logActivity('login', 'تسجيل دخول', { method: 'email' });
        
        showToast('تم تسجيل الدخول بنجاح', 'success');
        hideLoginPage();
        updateUIForRole();
        
        return true;
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'فشل تسجيل الدخول';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'المستخدم غير موجود';
                break;
            case 'auth/wrong-password':
                errorMessage = 'كلمة المرور غير صحيحة';
                break;
            case 'auth/invalid-email':
                errorMessage = 'البريد الإلكتروني غير صالح';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'محاولات كثيرة. حاول لاحقاً';
                break;
        }
        
        showToast(errorMessage, 'error');
        return false;
    } finally {
        hideLoading();
    }
}

/**
 * Login with username and ID (Local/Offline)
 */
async function loginWithCredentials(username, userId) {
    try {
        showLoading();
        
        // Try to find user in local storage or IndexedDB
        const users = await dbGetAll('users') || [];
        const user = users.find(u => u.username === username && u.id === userId);
        
        if (user) {
            currentUserData = user;
            AUTH_STATE.isAuthenticated = true;
            AUTH_STATE.user = user;
            AUTH_STATE.role = user.role;
            AUTH_STATE.branch = user.branch;
            AUTH_STATE.permissions = ROLE_PERMISSIONS[user.role] || {};
            
            localStorage.setItem('currentUser', JSON.stringify(user));
            
            await logActivity('login', 'تسجيل دخول محلي', { method: 'credentials' });
            
            showToast('تم تسجيل الدخول بنجاح', 'success');
            hideLoginPage();
            updateUIForRole();
            
            return true;
        } else {
            showToast('بيانات الدخول غير صحيحة', 'error');
            return false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('فشل تسجيل الدخول', 'error');
        return false;
    } finally {
        hideLoading();
    }
}

/**
 * Register new user (Admin only)
 */
async function registerUser(userData) {
    if (!hasPermission('canManageUsers')) {
        showToast('ليس لديك صلاحية لإضافة مستخدمين', 'error');
        return false;
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
            phone: userData.phone || '',
            createdAt: new Date().toISOString(),
            createdBy: currentUserData?.id || 'system',
            isActive: true
        };

        // Save to IndexedDB
        await dbPut('users', newUser);

        // If Firebase is ready, also save there
        if (isFirebaseReady() && userData.email && userData.password) {
            const { createUserWithEmailAndPassword, updateProfile } = window.FirebaseModules.auth;
            const { doc, setDoc } = window.FirebaseModules.firestore;
            
            // Create Firebase auth user
            const userCredential = await createUserWithEmailAndPassword(
                getFirebaseAuth(), 
                userData.email, 
                userData.password
            );
            
            // Update display name
            await updateProfile(userCredential.user, {
                displayName: userData.displayName
            });
            
            // Save user data to Firestore
            newUser.id = userCredential.user.uid;
            await setDoc(doc(getFirebaseDB(), 'users', userCredential.user.uid), newUser);
        }

        // Log activity
        await logActivity('user_created', 'إنشاء مستخدم جديد', {
            userId: newUser.id,
            username: newUser.username,
            role: newUser.role
        });

        showToast('تم إنشاء المستخدم بنجاح', 'success');
        return newUser;

    } catch (error) {
        console.error('Register error:', error);
        showToast('فشل إنشاء المستخدم: ' + error.message, 'error');
        return false;
    } finally {
        hideLoading();
    }
}

/**
 * Logout user
 */
async function logout() {
    try {
        // Log activity before clearing session
        await logActivity('logout', 'تسجيل خروج');

        // Sign out from Firebase if available
        if (isFirebaseReady()) {
            const { signOut } = window.FirebaseModules.auth;
            await signOut(getFirebaseAuth());
        }

        handleLogout();
        showToast('تم تسجيل الخروج', 'success');

    } catch (error) {
        console.error('Logout error:', error);
        handleLogout();
    }
}

/**
 * Handle logout cleanup
 */
function handleLogout() {
    currentUser = null;
    currentUserData = null;
    AUTH_STATE.isAuthenticated = false;
    AUTH_STATE.user = null;
    AUTH_STATE.role = null;
    AUTH_STATE.branch = null;
    AUTH_STATE.permissions = [];

    localStorage.removeItem('currentUser');
    showLoginPage();
}

/**
 * Check if user has specific permission
 */
function hasPermission(permission) {
    if (!AUTH_STATE.isAuthenticated) return false;
    return AUTH_STATE.permissions[permission] === true;
}

/**
 * Check if user can access specific branch
 */
function canAccessBranch(branchId) {
    if (!AUTH_STATE.isAuthenticated) return false;
    if (AUTH_STATE.role === USER_ROLES.ADMIN) return true;
    return AUTH_STATE.branch === branchId;
}

/**
 * Check if user can modify specific asset
 */
function canModifyAsset(asset) {
    if (!AUTH_STATE.isAuthenticated) return false;
    if (AUTH_STATE.role === USER_ROLES.ADMIN) return true;
    if (AUTH_STATE.role === USER_ROLES.MANAGER) {
        return asset.branch === AUTH_STATE.branch;
    }
    if (AUTH_STATE.role === USER_ROLES.FIELD_USER) {
        return asset.createdBy === AUTH_STATE.user.id;
    }
    return false;
}

/**
 * Get assets visible to current user
 */
function filterAssetsForUser(assets) {
    if (!AUTH_STATE.isAuthenticated) return [];
    
    if (AUTH_STATE.role === USER_ROLES.ADMIN) {
        return assets; // Can see all
    }
    
    if (AUTH_STATE.role === USER_ROLES.MANAGER) {
        return assets.filter(a => a.branch === AUTH_STATE.branch);
    }
    
    if (AUTH_STATE.role === USER_ROLES.FIELD_USER) {
        return assets.filter(a => a.createdBy === AUTH_STATE.user.id);
    }
    
    return [];
}

/**
 * Update UI based on user role
 */
function updateUIForRole() {
    if (!AUTH_STATE.isAuthenticated) return;

    const role = AUTH_STATE.role;
    
    // Update user display
    const userDisplayElements = document.querySelectorAll('.user-display-name');
    userDisplayElements.forEach(el => {
        el.textContent = currentUserData?.displayName || currentUserData?.username || 'مستخدم';
    });

    const roleDisplayElements = document.querySelectorAll('.user-role-display');
    roleDisplayElements.forEach(el => {
        el.textContent = ROLE_LABELS[role] || role;
    });

    // Show/hide elements based on role
    document.querySelectorAll('[data-role-required]').forEach(el => {
        const requiredRoles = el.dataset.roleRequired.split(',');
        el.style.display = requiredRoles.includes(role) ? '' : 'none';
    });

    document.querySelectorAll('[data-permission-required]').forEach(el => {
        const permission = el.dataset.permissionRequired;
        el.style.display = hasPermission(permission) ? '' : 'none';
    });

    // Update navigation based on role
    updateNavigationForRole(role);

    // Refresh data with role filter
    if (typeof loadAllData === 'function') {
        loadAllData();
    }
}

/**
 * Update navigation menu based on role
 */
function updateNavigationForRole(role) {
    // Hide users management for non-admins
    const usersNav = document.querySelector('[data-nav="users"]');
    if (usersNav) {
        usersNav.style.display = role === USER_ROLES.ADMIN ? '' : 'none';
    }

    // Hide audit sessions creation for field users
    const sessionsNav = document.querySelector('[data-nav="sessions"]');
    if (sessionsNav && role === USER_ROLES.FIELD_USER) {
        // Field users can view but not create sessions
    }
}

/**
 * Show login page
 */
function showLoginPage() {
    document.getElementById('loginPage')?.classList.remove('hidden');
    document.getElementById('mainApp')?.classList.add('hidden');
}

/**
 * Hide login page
 */
function hideLoginPage() {
    document.getElementById('loginPage')?.classList.add('hidden');
    document.getElementById('mainApp')?.classList.remove('hidden');
}

/**
 * Log activity for audit trail
 */
async function logActivity(type, description, details = {}) {
    try {
        const activityLog = {
            id: generateId(),
            type,
            description,
            details,
            userId: currentUserData?.id || 'anonymous',
            userName: currentUserData?.displayName || currentUserData?.username || 'غير معروف',
            userRole: AUTH_STATE.role,
            branch: AUTH_STATE.branch,
            timestamp: new Date().toISOString(),
            ipAddress: null // Would need server-side for this
        };

        // Save to IndexedDB
        await dbPut('activityLogs', activityLog);

        // Sync to Firebase if available
        if (isFirebaseReady() && APP_STATE.isOnline) {
            const { doc, setDoc } = window.FirebaseModules.firestore;
            await setDoc(doc(getFirebaseDB(), 'activityLogs', activityLog.id), activityLog);
        }

    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

/**
 * Get current user info
 */
function getCurrentUser() {
    return currentUserData;
}

/**
 * Get current user role
 */
function getCurrentRole() {
    return AUTH_STATE.role;
}

/**
 * Get current user branch
 */
function getCurrentBranch() {
    return AUTH_STATE.branch;
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
