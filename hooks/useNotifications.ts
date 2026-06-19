'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    collection,
    doc,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    writeBatch,
} from 'firebase/firestore';
import { firestore } from '@/firebase';
import type { AppNotification } from '@/app/types/AppNotification';

export function useNotifications(uid: string) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!uid) {
            setNotifications([]);
            setLoading(false);
            return;
        }

        const notificationsQuery = query(
            collection(firestore, 'users', uid, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(40)
        );

        const unsubscribe = onSnapshot(
            notificationsQuery,
            (snapshot) => {
                const nextNotifications = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...(docSnap.data() as Omit<AppNotification, 'id'>),
                }));

                setNotifications(nextNotifications);
                setLoading(false);
            },
            (error) => {
                console.error('Could not load notifications:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [uid]);

    const unreadCount = useMemo(
        () => notifications.filter((item) => !item.readAt).length,
        [notifications]
    );

    const markAllAsRead = async () => {
        if (!uid) return;

        const unread = notifications.filter((item) => !item.readAt);
        if (unread.length === 0) return;

        const batch = writeBatch(firestore);

        unread.forEach((item) => {
            batch.set(
                doc(firestore, 'users', uid, 'notifications', item.id),
                { readAt: serverTimestamp() },
                { merge: true }
            );
        });

        await batch.commit();
    };

    return {
        notifications,
        unreadCount,
        loading,
        markAllAsRead,
    };
}
