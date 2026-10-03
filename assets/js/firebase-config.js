// Firebase Configuration and Initialization Module for Market Koro
// Import standard SDK modules from Firebase CDN (v10 JS ESM)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    addDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    deleteDoc,
    serverTimestamp,
    onSnapshot,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Firebase config object
const firebaseConfig = window.firebaseConfig || {
  apiKey: "AIzaSyAPbxQ9I5RL_5dOYDJvLoUyd4T-rOMQPdY",
  authDomain: "bangla-bazar-shop.firebaseapp.com",
  databaseURL: "https://bangla-bazar-shop-default-rtdb.firebaseio.com",
  projectId: "bangla-bazar-shop",
  storageBucket: "bangla-bazar-shop.firebasestorage.app",
  messagingSenderId: "452097132694",
  appId: "1:452097132694:web:65b32cc9e5dffc15cc5ab7",
  measurementId: "G-4W3CLLVZ4T"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export {
    app,
    auth,
    db,
    storage,
    googleProvider,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    addDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    deleteDoc,
    serverTimestamp,
    onSnapshot,
    runTransaction,
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
};
