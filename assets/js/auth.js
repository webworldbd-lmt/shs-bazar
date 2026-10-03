// Market Koro Authentication & User State Module
import {
  auth,
  db,
  googleProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from './firebase-config.js';

export const SUPER_ADMIN_EMAILS = [
  'banglabazaroffical@gmail.com',
  'marketkoroofficial@gmail.com'
];
export const SUPER_ADMIN_EMAIL = SUPER_ADMIN_EMAILS[0];

export let currentUser = null;
export let userProfile = null;
export let isAuthResolved = false;

// Helper to notify subscribers on auth changes
const authStateListeners = [];

export function onAuthStateUpdate(callback) {
  authStateListeners.push(callback);
  if (isAuthResolved) {
    callback(currentUser, userProfile);
  }
}

function notifyAuthStateListeners() {
  authStateListeners.forEach(cb => cb(currentUser, userProfile));
}

// Safety fallback timeout to resolve auth state if Firebase takes too long
const authTimeoutId = setTimeout(() => {
  if (!isAuthResolved) {
    console.warn('[Auth] Safety timeout reached (10s), forcing auth state resolution.');
    isAuthResolved = true;
    updateHeaderAuthUI();
    notifyAuthStateListeners();
  }
}, 10000);

// Initialize Auth Listener
onAuthStateChanged(auth, async (user) => {
  clearTimeout(authTimeoutId);
  currentUser = user;
  if (user) {
    const userEmailLower = (user.email || '').toLowerCase();
    const isSuperAdmin = SUPER_ADMIN_EMAILS.some(email => email.toLowerCase() === userEmailLower);

    // Fetch user profile document from Firestore with 5s timeout
    const userDocRef = doc(db, 'users', user.uid);
    try {
      let timeoutId;
      const getProfilePromise = getDoc(userDocRef);
      const profileTimeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('User profile fetch timeout')), 5000);
      });

      let snap = await Promise.race([getProfilePromise, profileTimeoutPromise]).finally(() => clearTimeout(timeoutId));

      if (!snap.exists()) {
        // Create user record if missing
        const initialData = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
          photoURL: user.photoURL || '',
          role: isSuperAdmin ? 'admin' : 'customer',
          wishlist: [],
          createdAt: serverTimestamp()
        };
        setDoc(userDocRef, initialData).catch(err => console.warn('Error creating user doc:', err));
        userProfile = initialData;
      } else {
        userProfile = snap.data();
        // Ensure super admin role is enforced
        if (isSuperAdmin && userProfile.role !== 'admin') {
          updateDoc(userDocRef, { role: 'admin' }).catch(err => console.warn('Error setting superadmin role:', err));
          userProfile.role = 'admin';
        }
      }
    } catch (err) {
      console.error('Error loading/creating user profile in Firestore:', err);
      // Fallback profile object if network, timeout or permission error occurs
      userProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
        role: isSuperAdmin ? 'admin' : 'customer',
        wishlist: []
      };
    }
  } else {
    userProfile = null;
  }

  isAuthResolved = true;
  updateHeaderAuthUI();
  notifyAuthStateListeners();
});

// Update Header UI based on user auth state (using relative paths for GitHub Pages compatibility)
function updateHeaderAuthUI() {
  const accountBtns = document.querySelectorAll('.account-icon-btn, .account-link');
  accountBtns.forEach(btn => {
    if (currentUser) {
      btn.href = userProfile && userProfile.role === 'admin' ? 'admin.html' : 'profile.html';
    } else {
      btn.href = 'login.html';
    }
  });

  // Update wishlist count badge
  const wishlistBadges = document.querySelectorAll('.wishlist-count-badge');
  const wishlistCount = (userProfile && userProfile.wishlist) ? userProfile.wishlist.length : getLocalWishlist().length;
  wishlistBadges.forEach(badge => {
    const prevCount = badge.textContent;
    badge.textContent = wishlistCount;
    if (prevCount !== String(wishlistCount)) {
      badge.classList.remove('pop');
      void badge.offsetWidth;
      badge.classList.add('pop');
    }
  });
}

// Wishlist Helpers (supports logged in sync + guest local storage)
export function getLocalWishlist() {
  try {
    const data = localStorage.getItem('bb_wishlist');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn('Error reading wishlist from localStorage:', e);
    return [];
  }
}

export async function toggleWishlist(productId) {
  if (currentUser && userProfile) {
    let wishlist = userProfile.wishlist || [];
    if (wishlist.includes(productId)) {
      wishlist = wishlist.filter(id => id !== productId);
    } else {
      wishlist.push(productId);
    }
    userProfile.wishlist = wishlist;
    await updateDoc(doc(db, 'users', currentUser.uid), { wishlist });
  } else {
    let wishlist = getLocalWishlist();
    if (wishlist.includes(productId)) {
      wishlist = wishlist.filter(id => id !== productId);
    } else {
      wishlist.push(productId);
    }
    localStorage.setItem('bb_wishlist', JSON.stringify(wishlist));
  }
  updateHeaderAuthUI();
  return isProductInWishlist(productId);
}

export function isProductInWishlist(productId) {
  if (userProfile && userProfile.wishlist) {
    return userProfile.wishlist.includes(productId);
  }
  return getLocalWishlist().includes(productId);
}

// Firebase Auth Error Code Helper
function getFriendlyAuthErrorMessage(error) {
  if (!error) return 'An unexpected authentication error occurred.';
  const code = error.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address. Please login instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup closed before completion. Please try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Please try again later.';
    default:
      return error.message || 'Authentication failed. Please try again.';
  }
}

// Auth Actions
export async function registerWithEmail(email, password, displayName) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    const isSuperAdmin = SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === email.toLowerCase());
    const initialData = {
      uid: cred.user.uid,
      email: email,
      displayName: displayName || email.split('@')[0],
      photoURL: '',
      role: isSuperAdmin ? 'admin' : 'customer',
      wishlist: [],
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, 'users', cred.user.uid), initialData);
    return cred.user;
  } catch (error) {
    throw new Error(getFriendlyAuthErrorMessage(error));
  }
}

export async function loginWithEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (error) {
    throw new Error(getFriendlyAuthErrorMessage(error));
  }
}

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    throw new Error(getFriendlyAuthErrorMessage(error));
  }
}

export async function resetPassword(email) {
  try {
    return await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw new Error(getFriendlyAuthErrorMessage(error));
  }
}

export async function logoutUser() {
  await signOut(auth);
  window.location.href = 'index.html';
}
