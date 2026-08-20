import { auth, db, firebaseConfig } from './firebase.js';
import { initializeApp, getApps } from 'firebase/app';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  getAuth
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { fastGetDoc } from './utils/fastFetch.js';

let currentUserProfile = null;
try {
  const cached = localStorage.getItem('waterboi_cached_profile');
  if (cached) currentUserProfile = JSON.parse(cached);
} catch (e) {}

let authInitialized = false;
let authReadyResolve;
const authReadyPromise = new Promise(resolve => {
  authReadyResolve = resolve;
});

export function isAuthReady() {
  return authInitialized;
}

export async function waitForAuth() {
  if (authInitialized) return getCurrentUser();
  await authReadyPromise;
  return getCurrentUser();
}

const listeners = new Set();

export function subscribeAuth(callback) {
  listeners.add(callback);
  callback(currentUserProfile, auth.currentUser);
  return () => listeners.delete(callback);
}

function notifyListeners() {
  listeners.forEach(cb => cb(currentUserProfile, auth.currentUser));
}

export function getCurrentUser() {
  return {
    firebaseUser: auth.currentUser,
    profile: currentUserProfile
  };
}

export async function login(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await fetchUserProfile(userCredential.user.uid);
  return { user: userCredential.user, profile };
}

export async function logout() {
  await firebaseSignOut(auth);
  currentUserProfile = null;
  try {
    localStorage.removeItem('waterboi_cached_profile');
  } catch (e) {}
  notifyListeners();
}

export async function fetchUserProfile(uid) {
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await fastGetDoc(userDocRef);
    if (snap.exists && snap.exists()) {
      currentUserProfile = { id: snap.id, ...snap.data() };
      try {
        localStorage.setItem('waterboi_cached_profile', JSON.stringify(currentUserProfile));
      } catch (e) {}
    }
    notifyListeners();
    return currentUserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    notifyListeners();
    return currentUserProfile;
  }
}

// Global Auth State Observer
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await fetchUserProfile(user.uid);
  } else {
    currentUserProfile = null;
    notifyListeners();
  }
  if (!authInitialized) {
    authInitialized = true;
    authReadyResolve();
  }
});

/**
 * Creates an employee user in Firebase Auth and sets up their profile in Firestore.
 * Uses a secondary Firebase App instance so the current admin session is not interrupted.
 */
export async function createEmployeeAccount({ name, phone, email, password, isDummy = false }) {
  const appName = 'SecondaryAuthApp';
  const existingApps = getApps();
  let secondaryApp = existingApps.find(a => a.name === appName);
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, appName);
  }

  const secondaryAuth = getAuth(secondaryApp);
  const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const uid = userCredential.user.uid;

  // Immediately sign out from secondary auth
  await firebaseSignOut(secondaryAuth);

  // Store user document in Firestore under primary db
  const userDocRef = doc(db, 'users', uid);
  await setDoc(userDocRef, {
    name,
    phone,
    email,
    role: 'employee',
    status: 'active',
    isDummy: !!isDummy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return uid;
}
