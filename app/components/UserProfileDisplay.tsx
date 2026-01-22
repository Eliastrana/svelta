'use client';

import { useEffect, useState } from 'react';
import { auth, firestore } from '@/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

type UserDoc = {
    photoURL?: string;
};

type Props = {
    sizeClassName?: string; // default navbar size
    className?: string;
    active?: boolean;       // ring when true
};

const UserProfileDisplay = ({
                                sizeClassName = 'w-10 h-10',
                                className = '',
                                active = false,
                            }: Props) => {
    const [user, setUser] = useState<User | null>(null);
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
    const [loadingPhoto, setLoadingPhoto] = useState(false);

    const ringClass = active ? 'ring-2 ring-cyan-200 ring-offset-2 ring-offset-white' : '';

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (!currentUser) {
                setProfilePhoto(null);
                setLoadingPhoto(false);
                return;
            }

            setLoadingPhoto(true);
            try {
                const snap = await getDoc(doc(firestore, 'users', currentUser.uid));
                const data = snap.exists() ? (snap.data() as UserDoc) : null;
                const url = (data?.photoURL?.trim() || currentUser.photoURL || null) as string | null;
                setProfilePhoto(url);
            } catch {
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
            <div className={`${sizeClassName} ${className} ${ringClass} rounded-full bg-slate-100 grid place-items-center`}>
                🧑‍🍳
            </div>
        );
    }

    // Loading state
    if (loadingPhoto) {
        return <div className={`${sizeClassName} ${className} ${ringClass} rounded-full bg-slate-200 animate-pulse`} />;
    }

    // Logged in
    return (
        <div className={`${sizeClassName} ${className} ${ringClass} rounded-full overflow-hidden`}>
            {profilePhoto ? (
                <img src={profilePhoto} alt={user.displayName || 'Profile'} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full bg-slate-100 grid place-items-center">🧑‍🍳</div>
            )}
        </div>
    );
};

export default UserProfileDisplay;