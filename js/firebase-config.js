/**
 * Firebase Configuration and Initialization
 * إعدادات Firebase وتهيئة الاتصال
 * 
 * ⚠️ هام: يجب استبدال القيم أدناه بإعدادات مشروعك من Firebase Console
 */

// Firebase Configuration - استبدل هذه القيم بإعدادات مشروعك
const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Flag to check if Firebase is configured
const IS_FIREBASE_CONFIGURED = FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY";

// Firebase instances
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDB = null;
let firebaseStorage = null;

/**
 * Initialize Firebase
 */
async function initFirebase() {
    if (!IS_FIREBASE_CONFIGURED) {
        console.warn('⚠️ Firebase غير مُهيأ. يرجى تحديث firebase-config.js بإعدادات مشروعك.');
        return false;
    }

    try {
        // Import Firebase modules from CDN
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        const { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, writeBatch } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');

        // Initialize Firebase App
        firebaseApp = initializeApp(FIREBASE_CONFIG);
        firebaseAuth = getAuth(firebaseApp);
        firebaseDB = getFirestore(firebaseApp);
        firebaseStorage = getStorage(firebaseApp);

        // Store modules globally for use in other files
        window.FirebaseModules = {
            auth: { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile },
            firestore: { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, writeBatch },
            storage: { ref, uploadBytes, getDownloadURL, deleteObject }
        };

        console.log('✅ Firebase initialized successfully');
        return true;

    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        return false;
    }
}

/**
 * Get Firebase Auth instance
 */
function getFirebaseAuth() {
    return firebaseAuth;
}

/**
 * Get Firebase Firestore instance
 */
function getFirebaseDB() {
    return firebaseDB;
}

/**
 * Get Firebase Storage instance
 */
function getFirebaseStorage() {
    return firebaseStorage;
}

/**
 * Check if Firebase is ready
 */
function isFirebaseReady() {
    return IS_FIREBASE_CONFIGURED && firebaseApp !== null;
}
