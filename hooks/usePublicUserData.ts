'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/firebase';
import { PublicUserDoc } from '@/helpers/publicUserProfile';

export function usePublicUserData(uid: string): PublicUserDoc | null {
    const [userData, setUserData] = useState<PublicUserDoc | null>(null);

    useEffect(() => {
        if (!uid) {
            setUserData(null);
            return;
        }

        const unsubscribe = onSnapshot(
            doc(firestore, 'publicUsers', uid),
            (snap) => {
                if (snap.exists()) {
                    setUserData(snap.data() as PublicUserDoc);
                } else {
                    setUserData(null);
                }
            }
        );

        return () => unsubscribe();
    }, [uid]);

    return userData;
}
