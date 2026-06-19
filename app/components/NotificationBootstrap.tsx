'use client';

import { useEffect } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import {
    registerAppServiceWorker,
    syncPushNotifications,
} from '@/helpers/pushNotifications';

export default function NotificationBootstrap() {
    const user = useAuthUser();

    useEffect(() => {
        void registerAppServiceWorker().catch((error) => {
            console.error('Could not register service worker:', error);
        });
    }, []);

    useEffect(() => {
        if (!user) return;

        void syncPushNotifications(user).catch((error) => {
            console.error('Could not sync push notifications:', error);
        });
    }, [user]);

    return null;
}
