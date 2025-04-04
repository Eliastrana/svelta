'use client';
import { useEffect, useState } from 'react';
import { firestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface UserDoc {
    name?: string;
    following?: string[];
    photoURL?: string;
}

export function useUserData(uid: string): UserDoc | null {
    const [userData, setUserData] = useState<UserDoc | null>(null);

    useEffect(() => {
        if (!uid) {
            setUserData(null);
            return;
        }
        const fetchUserData = async () => {
            const userDocRef = doc(firestore, 'users', uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                setUserData(docSnap.data() as UserDoc);
            } else {
                setUserData(null);
            }
        };
        fetchUserData();
    }, [uid]);

    return userData;
}
