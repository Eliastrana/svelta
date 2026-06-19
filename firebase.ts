// firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import type { Messaging } from 'firebase/messaging';

const runtimeHostname =
    typeof window !== 'undefined' ? window.location.hostname : null;

const shouldUseCurrentDomainForAuth =
    !!runtimeHostname &&
    runtimeHostname !== 'localhost' &&
    runtimeHostname !== '127.0.0.1';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: shouldUseCurrentDomainForAuth
        ? window.location.host
        : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const firestore = getFirestore(app);
const storage = getStorage(app);

let messagingPromise: Promise<Messaging | null> | null = null;

export async function getBrowserMessaging(): Promise<Messaging | null> {
    if (typeof window === 'undefined') return null;
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        return null;
    }

    if (!messagingPromise) {
        messagingPromise = (async () => {
            const { getMessaging, isSupported } = await import(
                'firebase/messaging'
            );

            const supported = await isSupported();
            if (!supported) return null;

            return getMessaging(app);
        })();
    }

    return messagingPromise;
}

export { app, auth, provider, firestore, storage };
