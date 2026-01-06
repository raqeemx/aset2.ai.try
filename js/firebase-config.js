/**
 * Firebase Configuration and Authentication Module
 * نظام المصادقة والتكامل مع Firebase
 * Version 6.0
 */

// === Firebase Configuration ===
// Replace with your Firebase project credentials
const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    databaseURL: "https://YOUR_PROJECT.firebaseio.com"
};

// === User Roles ===
const USER_ROLES = {
    ADMIN: 'admin',           // المشرف العام - صلاحيات كاملة
    MANAGER: 'manager',       // المدير - صلاحيات على مستوى الفرع
    FIELD_USER: 'field_user'  // العامل الميداني - إضافة فقط
};

// === Role Permissions ===
const ROLE_PERMISSIONS = {
    admin: {
        canViewAllAssets: true,
        canViewAllBranches: true,
        canViewAllUsers: true,
        canEditAllAssets: true,
        canDeleteAllAssets: true,
        canManageUsers: true,
        canManageBranches: true,
        canManageSessions: true,
        canExportReports: true,
        canViewAnalytics: true,
        canAccessSettings: true
    },
    manager: {
        canViewAllAssets: false,       // Only branch assets
        canViewAllBranches: false,
        canViewAllUsers: false,        // Only branch users
        canEditAllAssets: false,       // Only branch assets
        canDeleteAllAssets: false,
        canManageUsers: false,
        canManageBranches: false,
        canManageSessions: true,       // Branch sessions only
        canExportReports: true,        // Branch reports only
        canViewAnalytics: true,        // Branch analytics only
        canAccessSettings: false
    },
    field_user: {
        canViewAllAssets: false,       // Only own assets
        canViewAllBranches: false,
        canViewAllUsers: false,
        canEditAllAssets: false,
        canDeleteAllAssets: false,
        canManageUsers: false,
        canManageBranches: false,
        canManageSessions: false,
        canExportReports: false,
        canViewAnalytics: false,
        canAccessSettings: false
    }
};

// === Authentication State ===
let AUTH_STATE = {
    isAuthenticated: false,
    currentUser: null,
    userRole: null,
    userBranch: null,
    firebaseInitialized: false,
    useLocalAuth: true  // Set to false when Firebase is configured
};

// === Demo Users for Testing ===
const DEMO_USERS = [
    {
        id: 'admin-001',
        username: 'admin',
        password: 'admin123',
        name: 'المشرف العام',
        email: 'admin@gov.sa',
        role: USER_ROLES.ADMIN,
        branch: null,  // Admin can access all branches
        employeeId: 'EMP-001',
        phone: '0500000001',
        avatar: null,
        active: true,
        createdAt: '2024-01-01T00:00:00Z'
    },
    {
        id: 'manager-001',
        username: 'manager_riyadh',
        password: 'manager123',
        name: 'مدير فرع الرياض',
        email: 'manager.riyadh@gov.sa',
        role: USER_ROLES.MANAGER,
        branch: 'branch-riyadh',
        employeeId: 'EMP-002',
        phone: '0500000002',
        avatar: null,
        active: true,
        createdAt: '2024-01-01T00:00:00Z'
    },
    {
        id: 'manager-002',
        username: 'manager_jeddah',
        password: 'manager123',
        name: 'مدير فرع جدة',
        email: 'manager.jeddah@gov.sa',
        role: USER_ROLES.MANAGER,
        branch: 'branch-jeddah',
        employeeId: 'EMP-003',
        phone: '0500000003',
        avatar: null,
        active: true,
        createdAt: '2024-01-01T00:00:00Z'
    },
    {
        id: 'field-001',
        username: 'worker1',
        password: 'worker123',
        name: 'أحمد محمد العامري',
        email: 'ahmed@gov.sa',
        role: USER_ROLES.FIELD_USER,
        branch: 'branch-riyadh',
        employeeId: 'EMP-004',
        phone: '0500000004',
        avatar: null,
        active: true,
        createdAt: '2024-01-01T00:00:00Z'
    },
    {
        id: 'field-002',
        username: 'worker2',
        password: 'worker123',
        name: 'محمد عبدالله السالم',
        email: 'mohammed@gov.sa',
        role: USER_ROLES.FIELD_USER,
        branch: 'branch-riyadh',
        employeeId: 'EMP-005',
        phone: '0500000005',
        avatar: null,
        active: true,
        createdAt: '2024-01-01T00:00:00Z'
    },
    {
        id: 'field-003',
        username: 'worker3',
        password: 'worker123',
        name: 'خالد سعد الحربي',
        email: 'khaled@gov.sa',
        role: USER_ROLES.FIELD_USER,
        branch: 'branch-jeddah',
        employeeId: 'EMP-006',
        phone: '0500000006',
        avatar: null,
        active: true,
        createdAt: '2024-01-01T00:00:00Z'
    }
];

// === Demo Branches ===
const DEMO_BRANCHES = [
    {
        id: 'branch-riyadh',
        name: 'فرع الرياض',
        code: 'RYD',
        address: 'الرياض - حي العليا',
        phone: '0112345678',
        manager: 'manager-001',
        active: true,
        createdAt: '2024-01-01T00:00:00Z'
    },
    {
        id: 'branch-jeddah',
        name: 'فرع جدة',
        code: 'JED',
        address: 'جدة - حي الروضة',
        phone: '0122345678',
        manager: 'manager-002',
        active: true,
        createdAt: '2024-01-01T00:00:00Z'
    },
    {
        id: 'branch-dammam',
        name: 'فرع الدمام',
        code: 'DMM',
        address: 'الدمام - حي الشاطئ',
        phone: '0132345678',
        manager: null,
        active: true,
        createdAt: '2024-01-01T00:00:00Z'
    }
];

// === Initialize Firebase ===
async function initializeFirebase() {
    // Check if Firebase SDK is loaded
    if (typeof firebase !== 'undefined') {
        try {
            firebase.initializeApp(FIREBASE_CONFIG);
            AUTH_STATE.firebaseInitialized = true;
            AUTH_STATE.useLocalAuth = false;
            console.log('Firebase initialized successfully');
            
            // Listen for auth state changes
            firebase.auth().onAuthStateChanged(handleAuthStateChange);
            
        } catch (error) {
            console.warn('Firebase initialization failed, using local auth:', error);
            AUTH_STATE.useLocalAuth = true;
        }
    } else {
        console.log('Firebase SDK not loaded, using local authentication');
        AUTH_STATE.useLocalAuth = true;
    }
    
    // Initialize local auth data
    await initializeLocalAuthData();
}

// === Initialize Local Auth Data ===
async function initializeLocalAuthData() {
    try {
        // Store demo users in IndexedDB if not exists
        const existingUsers = await dbGetAll('users');
        if (!existingUsers || existingUsers.length === 0) {
            for (const user of DEMO_USERS) {
                await dbPut('users', user);
            }
            console.log('Demo users initialized');
        }
        
        // Store demo branches
        const existingBranches = await dbGetAll('branches');
        if (!existingBranches || existingBranches.length === 0) {
            for (const branch of DEMO_BRANCHES) {
                await dbPut('branches', branch);
            }
            console.log('Demo branches initialized');
        }
        
        // Check for saved session
        await restoreSession();
        
    } catch (error) {
        console.error('Error initializing local auth data:', error);
    }
}

// === Authentication Functions ===
async function login(username, password) {
    showLoading();
    
    try {
        if (AUTH_STATE.useLocalAuth) {
            return await localLogin(username, password);
        } else {
            return await firebaseLogin(username, password);
        }
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    } finally {
        hideLoading();
    }
}

async function localLogin(username, password) {
    const users = await dbGetAll('users');
    const user = users.find(u => 
        (u.username === username || u.email === username) && 
        u.password === password && 
        u.active
    );
    
    if (!user) {
        throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
    
    // Set auth state
    AUTH_STATE.isAuthenticated = true;
    AUTH_STATE.currentUser = user;
    AUTH_STATE.userRole = user.role;
    AUTH_STATE.userBranch = user.branch;
    
    // Save session
    await saveSession();
    
    // Log activity
    await logActivity('login', 'تسجيل دخول', { userId: user.id });
    
    return user;
}

async function firebaseLogin(email, password) {
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    const firebaseUser = userCredential.user;
    
    // Get user data from Firestore
    const userDoc = await firebase.firestore().collection('users').doc(firebaseUser.uid).get();
    
    if (!userDoc.exists) {
        throw new Error('بيانات المستخدم غير موجودة');
    }
    
    const userData = userDoc.data();
    
    AUTH_STATE.isAuthenticated = true;
    AUTH_STATE.currentUser = { ...userData, id: firebaseUser.uid };
    AUTH_STATE.userRole = userData.role;
    AUTH_STATE.userBranch = userData.branch;
    
    await saveSession();
    
    return AUTH_STATE.currentUser;
}

async function logout() {
    try {
        // Log activity before logout
        if (AUTH_STATE.currentUser) {
            await logActivity('logout', 'تسجيل خروج', { userId: AUTH_STATE.currentUser.id });
        }
        
        if (!AUTH_STATE.useLocalAuth && AUTH_STATE.firebaseInitialized) {
            await firebase.auth().signOut();
        }
        
        // Clear auth state
        AUTH_STATE.isAuthenticated = false;
        AUTH_STATE.currentUser = null;
        AUTH_STATE.userRole = null;
        AUTH_STATE.userBranch = null;
        
        // Clear saved session
        await clearSession();
        
        // Show login screen
        showLoginScreen();
        
    } catch (error) {
        console.error('Logout error:', error);
    }
}

async function saveSession() {
    const session = {
        userId: AUTH_STATE.currentUser?.id,
        userRole: AUTH_STATE.userRole,
        userBranch: AUTH_STATE.userBranch,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };
    
    localStorage.setItem('auth_session', JSON.stringify(session));
}

async function restoreSession() {
    try {
        const sessionData = localStorage.getItem('auth_session');
        if (!sessionData) return false;
        
        const session = JSON.parse(sessionData);
        
        // Check if session expired
        if (new Date(session.expiresAt) < new Date()) {
            await clearSession();
            return false;
        }
        
        // Get user data
        const users = await dbGetAll('users');
        const user = users.find(u => u.id === session.userId);
        
        if (user && user.active) {
            AUTH_STATE.isAuthenticated = true;
            AUTH_STATE.currentUser = user;
            AUTH_STATE.userRole = user.role;
            AUTH_STATE.userBranch = user.branch;
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error restoring session:', error);
        return false;
    }
}

async function clearSession() {
    localStorage.removeItem('auth_session');
}

function handleAuthStateChange(firebaseUser) {
    if (firebaseUser) {
        // User is signed in
        console.log('Firebase user signed in:', firebaseUser.email);
    } else {
        // User is signed out
        console.log('Firebase user signed out');
    }
}

// === Permission Checking ===
function hasPermission(permission) {
    if (!AUTH_STATE.isAuthenticated || !AUTH_STATE.userRole) {
        return false;
    }
    
    const permissions = ROLE_PERMISSIONS[AUTH_STATE.userRole];
    return permissions ? permissions[permission] === true : false;
}

function canAccessAsset(asset) {
    if (!AUTH_STATE.isAuthenticated) return false;
    
    const role = AUTH_STATE.userRole;
    
    // Admin can access all
    if (role === USER_ROLES.ADMIN) return true;
    
    // Manager can access branch assets
    if (role === USER_ROLES.MANAGER) {
        return asset.branch === AUTH_STATE.userBranch;
    }
    
    // Field user can only access own assets
    if (role === USER_ROLES.FIELD_USER) {
        return asset.createdBy === AUTH_STATE.currentUser?.id;
    }
    
    return false;
}

function canEditAsset(asset) {
    if (!AUTH_STATE.isAuthenticated) return false;
    
    const role = AUTH_STATE.userRole;
    
    // Admin can edit all
    if (role === USER_ROLES.ADMIN) return true;
    
    // Manager can edit branch assets
    if (role === USER_ROLES.MANAGER) {
        return asset.branch === AUTH_STATE.userBranch;
    }
    
    // Field user cannot edit
    return false;
}

function canDeleteAsset(asset) {
    if (!AUTH_STATE.isAuthenticated) return false;
    
    const role = AUTH_STATE.userRole;
    
    // Only admin can delete
    return role === USER_ROLES.ADMIN;
}

// === User Management Functions ===
async function getUsers() {
    if (!hasPermission('canManageUsers') && !hasPermission('canViewAllUsers')) {
        // Return only users in same branch for managers
        if (AUTH_STATE.userRole === USER_ROLES.MANAGER) {
            const allUsers = await dbGetAll('users');
            return allUsers.filter(u => u.branch === AUTH_STATE.userBranch);
        }
        return [];
    }
    
    return await dbGetAll('users');
}

async function createUser(userData) {
    if (!hasPermission('canManageUsers')) {
        throw new Error('ليس لديك صلاحية لإضافة مستخدمين');
    }
    
    const newUser = {
        id: generateId('user'),
        ...userData,
        createdAt: new Date().toISOString(),
        createdBy: AUTH_STATE.currentUser?.id
    };
    
    // If using Firebase, create in Firestore
    if (!AUTH_STATE.useLocalAuth && AUTH_STATE.firebaseInitialized) {
        // Create Firebase auth user
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(
            userData.email, 
            userData.password
        );
        
        newUser.id = userCredential.user.uid;
        delete newUser.password;
        
        await firebase.firestore().collection('users').doc(newUser.id).set(newUser);
    }
    
    await dbPut('users', newUser);
    await logActivity('create_user', 'إنشاء مستخدم جديد', { userId: newUser.id, name: newUser.name });
    
    return newUser;
}

async function updateUser(userId, updates) {
    if (!hasPermission('canManageUsers')) {
        throw new Error('ليس لديك صلاحية لتعديل المستخدمين');
    }
    
    const user = await dbGet('users', userId);
    if (!user) {
        throw new Error('المستخدم غير موجود');
    }
    
    const updatedUser = {
        ...user,
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy: AUTH_STATE.currentUser?.id
    };
    
    await dbPut('users', updatedUser);
    await logActivity('update_user', 'تعديل بيانات مستخدم', { userId, updates });
    
    return updatedUser;
}

async function deleteUser(userId) {
    if (!hasPermission('canManageUsers')) {
        throw new Error('ليس لديك صلاحية لحذف المستخدمين');
    }
    
    // Don't allow deleting self
    if (userId === AUTH_STATE.currentUser?.id) {
        throw new Error('لا يمكنك حذف حسابك الخاص');
    }
    
    await dbDelete('users', userId);
    await logActivity('delete_user', 'حذف مستخدم', { userId });
}

async function toggleUserStatus(userId) {
    const user = await dbGet('users', userId);
    if (!user) throw new Error('المستخدم غير موجود');
    
    user.active = !user.active;
    await dbPut('users', user);
    
    return user;
}

// === Branch Management Functions ===
async function getBranches() {
    const branches = await dbGetAll('branches');
    
    if (AUTH_STATE.userRole === USER_ROLES.ADMIN) {
        return branches;
    }
    
    if (AUTH_STATE.userRole === USER_ROLES.MANAGER) {
        return branches.filter(b => b.id === AUTH_STATE.userBranch);
    }
    
    return [];
}

async function createBranch(branchData) {
    if (!hasPermission('canManageBranches')) {
        throw new Error('ليس لديك صلاحية لإضافة فروع');
    }
    
    const newBranch = {
        id: generateId('branch'),
        ...branchData,
        createdAt: new Date().toISOString(),
        createdBy: AUTH_STATE.currentUser?.id
    };
    
    await dbPut('branches', newBranch);
    await logActivity('create_branch', 'إنشاء فرع جديد', { branchId: newBranch.id, name: newBranch.name });
    
    return newBranch;
}

async function updateBranch(branchId, updates) {
    if (!hasPermission('canManageBranches')) {
        throw new Error('ليس لديك صلاحية لتعديل الفروع');
    }
    
    const branch = await dbGet('branches', branchId);
    if (!branch) throw new Error('الفرع غير موجود');
    
    const updatedBranch = {
        ...branch,
        ...updates,
        updatedAt: new Date().toISOString()
    };
    
    await dbPut('branches', updatedBranch);
    return updatedBranch;
}

async function deleteBranch(branchId) {
    if (!hasPermission('canManageBranches')) {
        throw new Error('ليس لديك صلاحية لحذف الفروع');
    }
    
    await dbDelete('branches', branchId);
    await logActivity('delete_branch', 'حذف فرع', { branchId });
}

// === Activity Logging ===
async function logActivity(type, description, details = {}) {
    const activity = {
        id: generateId('activity'),
        type,
        description,
        details,
        userId: AUTH_STATE.currentUser?.id,
        userName: AUTH_STATE.currentUser?.name,
        userRole: AUTH_STATE.userRole,
        branch: AUTH_STATE.userBranch,
        timestamp: new Date().toISOString(),
        isOnline: navigator.onLine
    };
    
    await dbPut('activityLogs', activity);
    
    return activity;
}

// === Helper Functions ===
function generateId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getRoleName(role) {
    const roleNames = {
        [USER_ROLES.ADMIN]: 'المشرف العام',
        [USER_ROLES.MANAGER]: 'مدير فرع',
        [USER_ROLES.FIELD_USER]: 'عامل ميداني'
    };
    return roleNames[role] || role;
}

function getRoleBadgeClass(role) {
    const classes = {
        [USER_ROLES.ADMIN]: 'bg-purple-100 text-purple-800',
        [USER_ROLES.MANAGER]: 'bg-blue-100 text-blue-800',
        [USER_ROLES.FIELD_USER]: 'bg-green-100 text-green-800'
    };
    return classes[role] || 'bg-gray-100 text-gray-800';
}

// === Export for global access ===
window.AUTH_STATE = AUTH_STATE;
window.USER_ROLES = USER_ROLES;
window.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
window.initializeFirebase = initializeFirebase;
window.login = login;
window.logout = logout;
window.hasPermission = hasPermission;
window.canAccessAsset = canAccessAsset;
window.canEditAsset = canEditAsset;
window.canDeleteAsset = canDeleteAsset;
window.getUsers = getUsers;
window.createUser = createUser;
window.updateUser = updateUser;
window.deleteUser = deleteUser;
window.toggleUserStatus = toggleUserStatus;
window.getBranches = getBranches;
window.createBranch = createBranch;
window.updateBranch = updateBranch;
window.deleteBranch = deleteBranch;
window.logActivity = logActivity;
window.getRoleName = getRoleName;
window.getRoleBadgeClass = getRoleBadgeClass;
