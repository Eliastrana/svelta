'use client';
import { useEffect, useState } from 'react';
import { firestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export function useUserFollowing(uid: string): string[] {
    const [following, setFollowing] = useState<string[]>([]);

    useEffect(() => {
        if (!uid) {
            setFollowing([]);
            return;
        }
        const fetchFollowing = async () => {
            const userDocRef = doc(firestore, 'users', uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setFollowing(data.following || []);
            }
        };
        fetchFollowing();
    }, [uid]);

    return following;
}
