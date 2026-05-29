'use client';
import { useEffect, useState } from 'react';
import { firestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export interface UserDoc {
    name?: string;
    following?: string[];
    followingCount?: number;
    followerCount?: number;
    incomingFollowRequests?: string[];
    outgoingFollowRequests?: string[];
    isProfilePrivate?: boolean;
    hasCompletedOnboarding?: boolean;
    photoURL?: string;
    backgroundPhotoURL?: string;
    bio?: string;
    favoriteFood?: string;
    profileThemeId?: string;
    profileFontId?: string;
}

export function useUserData(uid: string): UserDoc | null {
    const [userData, setUserData] = useState<UserDoc | null>(null);

    useEffect(() => {
        if (!uid) {
            setUserData(null);
            return;
        }

        const userDocRef = doc(firestore, 'users', uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setUserData(docSnap.data() as UserDoc);
            } else {
                setUserData(null);
            }
        });

        return () => unsubscribe();
    }, [uid]);

    return userData;
}
