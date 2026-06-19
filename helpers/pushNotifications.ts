'use client';

import type { User } from 'firebase/auth';
import {
    deleteDoc,
    doc,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { firestore, getBrowserMessaging } from '@/firebase';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim() ?? '';
const PUSH_DISABLED_KEY_PREFIX = 'svelta-push-disabled';

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

type PushDisableResult =
    | { ok: true }
    | {
          ok: false;
          reason: 'unsupported' | 'missing-vapid-key';
      };

export type PushNotificationsStatus =
    | 'unsupported'
    | 'blocked'
    | 'available'
    | 'enabled'
    | 'paused';

function getPushDisabledKey(uid: string) {
    return `${PUSH_DISABLED_KEY_PREFIX}:${uid}`;
}

export function isPushNotificationsPaused(uid: string) {
    if (!uid || typeof window === 'undefined') return false;
    return window.localStorage.getItem(getPushDisabledKey(uid)) === '1';
}

export function getPushNotificationsStatus(uid?: string): PushNotificationsStatus {
    if (typeof window === 'undefined') return 'unsupported';

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return 'unsupported';
    }

    if (Notification.permission === 'denied') return 'blocked';
    if (Notification.permission !== 'granted') return 'available';
    if (uid && isPushNotificationsPaused(uid)) return 'paused';

    return 'enabled';
}

function clearPushNotificationsPaused(uid: string) {
    if (!uid || typeof window === 'undefined') return;
    window.localStorage.removeItem(getPushDisabledKey(uid));
}

function pausePushNotifications(uid: string) {
    if (!uid || typeof window === 'undefined') return;
    window.localStorage.setItem(getPushDisabledKey(uid), '1');
}

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
    clearPushNotificationsPaused(user.uid);
    return getPushTokenForUser(user, { requestPermission: true });
}

export async function disablePushNotifications(
    user: User
): Promise<PushDisableResult> {
    pausePushNotifications(user.uid);

    if (typeof window === 'undefined') {
        return { ok: false, reason: 'unsupported' };
    }

    const messaging = await getBrowserMessaging();
    if (!messaging) {
        return { ok: false, reason: 'unsupported' };
    }

    if (!VAPID_KEY) {
        return { ok: false, reason: 'missing-vapid-key' };
    }

    if (Notification.permission !== 'granted') {
        return { ok: true };
    }

    const { deleteToken, getToken } = await import('firebase/messaging');
    const registration = await registerAppServiceWorker();

    if (!registration) {
        return { ok: false, reason: 'unsupported' };
    }

    const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
    }).catch(() => '');

    if (token) {
        await deleteDoc(doc(firestore, 'notificationTokens', token)).catch(
            () => undefined
        );
    }

    await deleteToken(messaging).catch(() => undefined);

    return { ok: true };
}

export async function syncPushNotifications(user: User) {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (isPushNotificationsPaused(user.uid)) return;

    const result = await getPushTokenForUser(user, {
        requestPermission: false,
    });

    if (!result.ok && result.reason !== 'missing-vapid-key') {
        console.error('Could not sync push token:', result.reason);
    }
}
