'use client';

import { useEffect, useState } from 'react';
import { auth, firestore } from '@/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

type UserDoc = {
    photoURL?: string;
};

const UserProfileDisplay = () => {
    const [user, setUser] = useState<User | null>(null);
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
    const [loadingPhoto, setLoadingPhoto] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (!currentUser) {
                setProfilePhoto(null);
                return;
            }

            setLoadingPhoto(true);
            try {
                const snap = await getDoc(doc(firestore, 'users', currentUser.uid));
                const data = snap.exists() ? (snap.data() as UserDoc) : null;

                // Prefer custom photo from Firestore, fallback to Google photoURL
                const url = (data?.photoURL?.trim() || currentUser.photoURL || null) as string | null;
                setProfilePhoto(url);
            } catch {
                // If Firestore fails, fallback to Google
                setProfilePhoto(currentUser.photoURL || null);
            } finally {
                setLoadingPhoto(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Not logged in
    if (!user) {
        return (
            <div className="p-4 items-center">
                <a href="/login" className="hover:underline">
                    🧑‍🍳
                </a>
            </div>
        );
    }

    // Loading state (optional)
    if (loadingPhoto) {
        return (
            <div className="flex items-center p-2">
                <div className="w-12 h-12 rounded-full bg-slate-200 animate-pulse" />
            </div>
        );
    }

    // Logged in
    return (
        <div className="flex items-center p-2">
            {profilePhoto ? (
                <img
                    src={profilePhoto}
                    alt={user.displayName || 'Profile'}
                    className="w-12 h-12 rounded-full object-cover"
                />
            ) : (
                <div className="w-12 h-12 rounded-full bg-slate-100 grid place-items-center">
                    🧑‍🍳
                </div>
            )}
        </div>
    );
};

export default UserProfileDisplay;