'use client';

import type { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestore, getBrowserMessaging } from '@/firebase';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim() ?? '';

type PushSetupResult =
    | { ok: true; token: string }
    | {
          ok: false;
          reason:
              | 'unsupported'
              | 'permission-blocked'
              | 'missing-vapid-key'
              | 'missing-token';
      };

async function persistPushToken(user: User, token: string) {
    await setDoc(
        doc(firestore, 'notificationTokens', token),
        {
            token,
            userId: user.uid,
            platform:
                typeof navigator !== 'undefined' ? navigator.userAgent : '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );
}

export async function registerAppServiceWorker() {
    if (typeof window === 'undefined') return null;
    if (!('serviceWorker' in navigator)) return null;

    return navigator.serviceWorker.register('/sw.js');
}

async function getPushTokenForUser(
    user: User,
    opts?: { requestPermission?: boolean }
): Promise<PushSetupResult> {
    if (typeof window === 'undefined') {
        return { ok: false, reason: 'unsupported' };
    }

    const registration = await registerAppServiceWorker();
    const messaging = await getBrowserMessaging();

    if (!registration || !messaging) {
        return { ok: false, reason: 'unsupported' };
    }

    const permission =
        opts?.requestPermission === false
            ? Notification.permission
            : await Notification.requestPermission();

    if (permission !== 'granted') {
        return { ok: false, reason: 'permission-blocked' };
    }

    if (!VAPID_KEY) {
        return { ok: false, reason: 'missing-vapid-key' };
    }

    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
    });

    if (!token) {
        return { ok: false, reason: 'missing-token' };
    }

    await persistPushToken(user, token);
    return { ok: true, token };
}

export async function enablePushNotifications(
    user: User
): Promise<PushSetupResult> {
    return getPushTokenForUser(user, { requestPermission: true });
}

export async function syncPushNotifications(user: User) {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const result = await getPushTokenForUser(user, {
        requestPermission: false,
    });

    if (!result.ok && result.reason !== 'missing-vapid-key') {
        console.error('Could not sync push token:', result.reason);
    }
}
