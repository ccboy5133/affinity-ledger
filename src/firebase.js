import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut as fbSignOut } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const googleOAuth = {
  clientId: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Persistent local cache — all reads/writes are cached in IndexedDB.
// Writes made while offline are queued and automatically synced when
// the connection is restored. The app keeps working on cached data offline.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export async function signInWithGoogleIdToken(idToken) {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export function signOut() {
  return fbSignOut(auth);
}
