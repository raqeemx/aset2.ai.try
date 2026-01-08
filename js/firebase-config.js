/**
 * Firebase Configuration & Authentication Module
 * نظام Firebase والمصادقة
 * Version 6.5 - With Real Firebase Integration
 */

// === Firebase Configuration ===
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyD4YmVKC1ByE-o5qWoeyHt5mIVM8v_v4ZM",
    authDomain: "aset-5be72.firebaseapp.com",
    projectId: "aset-5be72",
    storageBucket: "aset-5be72.firebasestorage.app",
    messagingSenderId: "4190814584",
    appId: "1:4190814584:web:c1e2354b04344a16db088d"
};

// === User Roles ===
const USER_ROLES = {
    ADMIN: 'admin',           // المشرف العام - وصول كامل
    MANAGER: 'manager',       // مدير الفرع - صلاحيات محدودة في فرعه
    FIELD_USER: 'field_user', // العامل الميداني - إضافة أصول فقط
    CLIENT: 'client'          // العميل - رؤية بياناته والتعديل عليها
};

// === Role Permissions ===
const ROLE_PERMISSIONS = {
    [USER_ROLES.ADMIN]: {
        name: 'المشرف العام',
        description: 'وصول كامل لجميع الفروع والبيانات',
        canViewAllBranches: true,
        canViewAllUsers: true,
        canManageUsers: true,
        canManageBranches: true,
        canManageSessions: true,
        canDeleteAssets: true,
        canEditAllAssets: true,
        canViewReports: true,
        canExportData: true,
        canManageSettings: true,
        canAssignPermissions: true,
        canViewDashboard: true,
        canViewWorkerActivity: true
    },
    [USER_ROLES.MANAGER]: {
        name: 'مدير الفرع',
        description: 'صلاحيات محدودة في فرعه فقط',
        canViewAllBranches: false,
        canViewAllUsers: false, // فقط عمال فرعه
        canManageUsers: false,
        canManageBranches: false,
        canManageSessions: true, // جلسات فرعه فقط
        canDeleteAssets: true, // أصول فرعه فقط
        canEditAllAssets: false, // أصول فرعه فقط
        canViewReports: true, // تقارير فرعه فقط
        canExportData: true,
        canManageSettings: false,
        canAssignPermissions: false,
        canViewDashboard: true,
        canViewWorkerActivity: true // عمال فرعه فقط
    },
    [USER_ROLES.FIELD_USER]: {
        name: 'العامل الميداني',
        description: 'إضافة الأصول ورؤية أصوله فقط',
        canViewAllBranches: false,
        canViewAllUsers: false,
        canManageUsers: false,
        canManageBranches: false,
        canManageSessions: false,
        canDeleteAssets: false,
        canEditAllAssets: false,
        canViewReports: false,
        canExportData: false,
        canManageSettings: false,
        canAssignPermissions: false,
        canViewDashboard: false,
        canViewWorkerActivity: false
    },
    [USER_ROLES.CLIENT]: {
        name: 'العميل',
        description: 'رؤية بياناته والتعديل عليها',
        canViewAllBranches: false,
        canViewAllUsers: false,
        canManageUsers: false,
        canManageBranches: false,
        canManageSessions: false,
        canDeleteAssets: false,
        canEditAllAssets: false, // فقط أصوله
        canViewReports: true, // تقارير أصوله فقط
        canExportData: true, // تصدير أصوله فقط
        canManageSettings: false,
        canAssignPermissions: false,
        canViewDashboard: true, // لوحة محدودة
        canViewWorkerActivity: false,
        canEditOwnAssets: true,
        canViewOwnAssets: true
    }
};

// === Authentication State ===
let AUTH_STATE = {
    isAuthenticated: false,
    currentUser: null,
    userRole: null,
    userBranch: null,
    permissions: null,
    firebaseUser: null,
    isFirebaseInitialized: false
};

// === Firebase Instance ===
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let firebaseStorage = null;

// === Initialize Firebase ===
async function initializeFirebase() {
    try {
        // Check if Firebase SDK is loaded
        if (typeof firebase === 'undefined') {
            console.log('Firebase SDK not loaded, using local authentication');
            AUTH_STATE.isFirebaseInitialized = false;
            return false;
        }

        // Initialize Firebase
        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
        } else {
            firebaseApp = firebase.app();
        }

        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();
        firebaseStorage = firebase.storage();

        AUTH_STATE.isFirebaseInitialized = true;
        console.log('Firebase initialized successfully');

        // Listen for auth state changes
        firebaseAuth.onAuthStateChanged(async (user) => {
            if (user) {
                await handleFirebaseAuthStateChange(user);
            } else {
                AUTH_STATE.isAuthenticated = false;
                AUTH_STATE.currentUser = null;
            }
        });

        return true;
    } catch (error) {
        console.error('Firebase initialization error:', error);
        AUTH_STATE.isFirebaseInitialized = false;
        return false;
    }
}

// === Handle Firebase Auth State Change ===
async function handleFirebaseAuthStateChange(firebaseUser) {
    try {
        AUTH_STATE.firebaseUser = firebaseUser;
        
        // Get user data from Firestore
        if (firebaseDb) {
            const userDoc = await firebaseDb.collection('users').doc(firebaseUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                AUTH_STATE.currentUser = {
                    id: firebaseUser.uid,
                    email: firebaseUser.email,
                    name: userData.name || firebaseUser.displayName,
                    role: userData.role || USER_ROLES.CLIENT,
                    branch: userData.branch,
                    permissions: userData.customPermissions || null
                };
                AUTH_STATE.userRole = userData.role || USER_ROLES.CLIENT;
                AUTH_STATE.userBranch = userData.branch;
                AUTH_STATE.permissions = getPermissionsForRole(AUTH_STATE.userRole, userData.customPermissions);
                AUTH_STATE.isAuthenticated = true;
            }
        }
    } catch (error) {
        console.error('Error handling auth state change:', error);
    }
}

// === Get Permissions for Role ===
function getPermissionsForRole(role, customPermissions = null) {
    const basePermissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[USER_ROLES.CLIENT];
    
    // If custom permissions are set, merge them
    if (customPermissions) {
        return { ...basePermissions, ...customPermissions };
    }
    
    return basePermissions;
}

// === Check Permission ===
function hasPermission(permission) {
    if (!AUTH_STATE.permissions) return false;
    return AUTH_STATE.permissions[permission] === true;
}

// === Firebase Authentication Functions ===
async function signInWithEmail(email, password) {
    if (!AUTH_STATE.isFirebaseInitialized) {
        // Fallback to local authentication
        return await localSignIn(email, password);
    }

    try {
        const result = await firebaseAuth.signInWithEmailAndPassword(email, password);
        return { success: true, user: result.user };
    } catch (error) {
        console.error('Firebase sign in error:', error);
        // Fallback to local authentication
        return await localSignIn(email, password);
    }
}

async function signUpWithEmail(email, password, userData) {
    if (!AUTH_STATE.isFirebaseInitialized) {
        return await localSignUp(email, password, userData);
    }

    try {
        const result = await firebaseAuth.createUserWithEmailAndPassword(email, password);
        
        // Save user data to Firestore
        if (firebaseDb) {
            await firebaseDb.collection('users').doc(result.user.uid).set({
                ...userData,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                role: userData.role || USER_ROLES.CLIENT,
                active: true
            });
        }

        // Also save to local IndexedDB
        await saveUserToLocal({
            id: result.user.uid,
            email: email,
            ...userData
        });

        return { success: true, user: result.user };
    } catch (error) {
        console.error('Firebase sign up error:', error);
        return { success: false, error: error.message };
    }
}

async function signOut() {
    try {
        if (AUTH_STATE.isFirebaseInitialized && firebaseAuth) {
            await firebaseAuth.signOut();
        }
        
        localStorage.removeItem('auth_session');
        AUTH_STATE = {
            isAuthenticated: false,
            currentUser: null,
            userRole: null,
            userBranch: null,
            permissions: null,
            firebaseUser: null,
            isFirebaseInitialized: AUTH_STATE.isFirebaseInitialized
        };
        
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

// === Local Authentication (Fallback) ===
async function localSignIn(emailOrUsername, password) {
    try {
        const users = await dbGetAll('users') || [];
        
        const user = users.find(u => 
            (u.email === emailOrUsername || u.username === emailOrUsername) && 
            u.password === password &&
            u.active !== false
        );

        if (!user) {
            return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
        }

        // Create session
        const session = {
            userId: user.id,
            userRole: user.role,
            userBranch: user.branch,
            userName: user.name,
            userEmail: user.email,
            loginTime: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        localStorage.setItem('auth_session', JSON.stringify(session));

        // Update AUTH_STATE
        AUTH_STATE.isAuthenticated = true;
        AUTH_STATE.currentUser = user;
        AUTH_STATE.userRole = user.role;
        AUTH_STATE.userBranch = user.branch;
        AUTH_STATE.permissions = getPermissionsForRole(user.role, user.customPermissions);

        return { success: true, user: user };
    } catch (error) {
        console.error('Local sign in error:', error);
        return { success: false, error: error.message };
    }
}

async function localSignUp(email, password, userData) {
    try {
        const users = await dbGetAll('users') || [];
        
        // Check if user exists
        if (users.find(u => u.email === email || u.username === userData.username)) {
            return { success: false, error: 'المستخدم موجود بالفعل' };
        }

        const newUser = {
            id: 'user-' + Date.now(),
            email: email,
            password: password,
            ...userData,
            role: userData.role || USER_ROLES.CLIENT,
            active: true,
            createdAt: new Date().toISOString()
        };

        await dbPut('users', newUser);

        return { success: true, user: newUser };
    } catch (error) {
        console.error('Local sign up error:', error);
        return { success: false, error: error.message };
    }
}

// === Save User to Local ===
async function saveUserToLocal(userData) {
    try {
        await dbPut('users', {
            ...userData,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error saving user to local:', error);
    }
}

// === User Management Functions ===
async function createUser(userData) {
    // Check permission
    if (!hasPermission('canManageUsers')) {
        return { success: false, error: 'ليس لديك صلاحية إنشاء مستخدمين' };
    }

    try {
        // Generate password or use provided
        const password = userData.password || generateRandomPassword();

        if (AUTH_STATE.isFirebaseInitialized) {
            // Create in Firebase
            const result = await signUpWithEmail(userData.email, password, userData);
            return result;
        } else {
            // Create locally
            return await localSignUp(userData.email, password, userData);
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function updateUser(userId, updates) {
    // Check permission
    if (!hasPermission('canManageUsers') && AUTH_STATE.currentUser?.id !== userId) {
        return { success: false, error: 'ليس لديك صلاحية تعديل هذا المستخدم' };
    }

    try {
        if (AUTH_STATE.isFirebaseInitialized && firebaseDb) {
            await firebaseDb.collection('users').doc(userId).update({
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // Also update in local IndexedDB
        const user = await dbGet('users', userId);
        if (user) {
            await dbPut('users', { ...user, ...updates, updatedAt: new Date().toISOString() });
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function deleteUser(userId) {
    if (!hasPermission('canManageUsers')) {
        return { success: false, error: 'ليس لديك صلاحية حذف مستخدمين' };
    }

    try {
        if (AUTH_STATE.isFirebaseInitialized && firebaseDb) {
            // Soft delete in Firebase
            await firebaseDb.collection('users').doc(userId).update({
                active: false,
                deletedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // Update in local IndexedDB
        const user = await dbGet('users', userId);
        if (user) {
            await dbPut('users', { ...user, active: false, deletedAt: new Date().toISOString() });
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// === Update User Permissions ===
async function updateUserPermissions(userId, permissions) {
    if (!hasPermission('canAssignPermissions')) {
        return { success: false, error: 'ليس لديك صلاحية تعديل الصلاحيات' };
    }

    try {
        const updates = {
            customPermissions: permissions
        };

        return await updateUser(userId, updates);
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// === Update User Role ===
async function updateUserRole(userId, newRole) {
    if (!hasPermission('canAssignPermissions')) {
        return { success: false, error: 'ليس لديك صلاحية تعديل الأدوار' };
    }

    if (!Object.values(USER_ROLES).includes(newRole)) {
        return { success: false, error: 'دور غير صالح' };
    }

    try {
        const updates = {
            role: newRole,
            customPermissions: null // Reset custom permissions when role changes
        };

        return await updateUser(userId, updates);
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// === Get All Users ===
async function getAllUsers(options = {}) {
    const { branchFilter = null, roleFilter = null, includeInactive = false } = options;

    try {
        let users = [];

        // Get from local IndexedDB
        users = await dbGetAll('users') || [];

        // Try to sync with Firebase if available
        if (AUTH_STATE.isFirebaseInitialized && firebaseDb && navigator.onLine) {
            try {
                let query = firebaseDb.collection('users');
                
                if (!includeInactive) {
                    query = query.where('active', '==', true);
                }

                const snapshot = await query.get();
                const firebaseUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Merge with local users
                for (const fbUser of firebaseUsers) {
                    const existingIndex = users.findIndex(u => u.id === fbUser.id);
                    if (existingIndex >= 0) {
                        users[existingIndex] = fbUser;
                    } else {
                        users.push(fbUser);
                    }
                    // Save to local
                    await dbPut('users', fbUser);
                }
            } catch (e) {
                console.log('Could not sync users from Firebase:', e);
            }
        }

        // Apply filters
        if (branchFilter) {
            users = users.filter(u => u.branch === branchFilter);
        }

        if (roleFilter) {
            users = users.filter(u => u.role === roleFilter);
        }

        if (!includeInactive) {
            users = users.filter(u => u.active !== false);
        }

        // Filter based on user's permissions
        if (AUTH_STATE.userRole === USER_ROLES.MANAGER) {
            // Manager can only see users from their branch
            users = users.filter(u => u.branch === AUTH_STATE.userBranch);
        } else if (AUTH_STATE.userRole === USER_ROLES.FIELD_USER || AUTH_STATE.userRole === USER_ROLES.CLIENT) {
            // Can only see themselves
            users = users.filter(u => u.id === AUTH_STATE.currentUser?.id);
        }

        return users;
    } catch (error) {
        console.error('Error getting users:', error);
        return [];
    }
}

// === Get User by ID ===
async function getUserById(userId) {
    try {
        // Try local first
        let user = await dbGet('users', userId);

        // Try Firebase
        if (!user && AUTH_STATE.isFirebaseInitialized && firebaseDb) {
            const doc = await firebaseDb.collection('users').doc(userId).get();
            if (doc.exists) {
                user = { id: doc.id, ...doc.data() };
                await dbPut('users', user);
            }
        }

        return user;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

// === Password Reset ===
async function sendPasswordResetEmail(email) {
    if (!AUTH_STATE.isFirebaseInitialized) {
        return { success: false, error: 'Firebase غير متصل، يرجى تغيير كلمة المرور يدوياً' };
    }

    try {
        await firebaseAuth.sendPasswordResetEmail(email);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// === Generate Random Password ===
function generateRandomPassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// === Role Display Names ===
function getRoleName(role) {
    const names = {
        [USER_ROLES.ADMIN]: 'المشرف العام',
        [USER_ROLES.MANAGER]: 'مدير فرع',
        [USER_ROLES.FIELD_USER]: 'عامل ميداني',
        [USER_ROLES.CLIENT]: 'عميل'
    };
    return names[role] || role;
}

function getRoleBadgeClass(role) {
    const classes = {
        [USER_ROLES.ADMIN]: 'bg-purple-500 text-white',
        [USER_ROLES.MANAGER]: 'bg-blue-500 text-white',
        [USER_ROLES.FIELD_USER]: 'bg-green-500 text-white',
        [USER_ROLES.CLIENT]: 'bg-cyan-500 text-white'
    };
    return classes[role] || 'bg-gray-500 text-white';
}

// === Get Current User's Assets ===
async function getCurrentUserAssets() {
    try {
        let assets = APP_STATE.assets || [];

        // Filter based on role
        switch (AUTH_STATE.userRole) {
            case USER_ROLES.ADMIN:
                // Can see all assets
                return assets;
            
            case USER_ROLES.MANAGER:
                // Can see assets from their branch
                return assets.filter(a => a.branch === AUTH_STATE.userBranch);
            
            case USER_ROLES.FIELD_USER:
                // Can see only their own assets
                return assets.filter(a => 
                    a.addedBy === AUTH_STATE.currentUser?.id ||
                    a.inventoryPerson === AUTH_STATE.currentUser?.name
                );
            
            case USER_ROLES.CLIENT:
                // Can see assets assigned to them or added by them
                return assets.filter(a => 
                    a.assignee === AUTH_STATE.currentUser?.name ||
                    a.assignee === AUTH_STATE.currentUser?.id ||
                    a.clientId === AUTH_STATE.currentUser?.id
                );
            
            default:
                return [];
        }
    } catch (error) {
        console.error('Error getting user assets:', error);
        return [];
    }
}

// === Check if User Can Edit Asset ===
function canEditAsset(asset) {
    if (!AUTH_STATE.isAuthenticated) return false;

    switch (AUTH_STATE.userRole) {
        case USER_ROLES.ADMIN:
            return true;
        
        case USER_ROLES.MANAGER:
            return asset.branch === AUTH_STATE.userBranch;
        
        case USER_ROLES.FIELD_USER:
            // Can only edit assets they added today
            const today = new Date().toISOString().split('T')[0];
            const assetDate = (asset.createdAt || '').split('T')[0];
            return (asset.addedBy === AUTH_STATE.currentUser?.id) && (assetDate === today);
        
        case USER_ROLES.CLIENT:
            return asset.clientId === AUTH_STATE.currentUser?.id ||
                   asset.assignee === AUTH_STATE.currentUser?.name;
        
        default:
            return false;
    }
}

// === Check if User Can Delete Asset ===
function canDeleteAsset(asset) {
    if (!AUTH_STATE.isAuthenticated) return false;

    if (AUTH_STATE.userRole === USER_ROLES.ADMIN) return true;
    if (AUTH_STATE.userRole === USER_ROLES.MANAGER && asset.branch === AUTH_STATE.userBranch) return true;
    
    return false;
}

// === Initialize Auth State from Session ===
async function initializeAuthFromSession() {
    try {
        const sessionData = localStorage.getItem('auth_session');
        if (!sessionData) return false;

        const session = JSON.parse(sessionData);
        
        // Check if session expired
        if (new Date(session.expiresAt) < new Date()) {
            localStorage.removeItem('auth_session');
            return false;
        }

        // Get user data
        const user = await getUserById(session.userId);
        if (!user) return false;

        AUTH_STATE.isAuthenticated = true;
        AUTH_STATE.currentUser = user;
        AUTH_STATE.userRole = user.role;
        AUTH_STATE.userBranch = user.branch;
        AUTH_STATE.permissions = getPermissionsForRole(user.role, user.customPermissions);

        return true;
    } catch (error) {
        console.error('Error initializing auth from session:', error);
        return false;
    }
}

// === Export Functions ===
window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.USER_ROLES = USER_ROLES;
window.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
window.AUTH_STATE = AUTH_STATE;

window.initializeFirebase = initializeFirebase;
window.signInWithEmail = signInWithEmail;
window.signUpWithEmail = signUpWithEmail;
window.signOut = signOut;
window.createUser = createUser;
window.updateUser = updateUser;
window.deleteUser = deleteUser;
window.updateUserPermissions = updateUserPermissions;
window.updateUserRole = updateUserRole;
window.getAllUsers = getAllUsers;
window.getUserById = getUserById;
window.sendPasswordResetEmail = sendPasswordResetEmail;

window.hasPermission = hasPermission;
window.getPermissionsForRole = getPermissionsForRole;
window.getRoleName = getRoleName;
window.getRoleBadgeClass = getRoleBadgeClass;
window.getCurrentUserAssets = getCurrentUserAssets;
window.canEditAsset = canEditAsset;
window.canDeleteAsset = canDeleteAsset;
window.initializeAuthFromSession = initializeAuthFromSession;
