'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { auth } from '@/firebase';
import { useUserData } from '@/hooks/useUserData';
import { onAuthStateChanged, User } from 'firebase/auth';

type Props = {
    sizeClassName?: string; // default navbar size
    className?: string;
    active?: boolean; // ring when true
};

const UserProfileDisplay = ({
    sizeClassName = 'w-11 h-11',
    className = '',
    active = false,
}: Props) => {
    const [user, setUser] = useState<User | null>(null);
    const userData = useUserData(user?.uid ?? '');

    const ringClass = active
        ? 'ring-2 brown-button ring-offset-2 ring-offset-white'
        : '';

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });

        return () => unsubscribe();
    }, []);

    const profilePhoto = userData?.photoURL?.trim() || user?.photoURL || null;

    // Not logged in
    if (!user) {
        return (
            <div
                className={`${sizeClassName} ${className} ${ringClass} rounded-full bg-slate-100 grid place-items-center`}
            >
                🧑‍🍳
            </div>
        );
    }

    // Logged in
    return (
        <div
            className={`${sizeClassName} ${className} ${ringClass} relative rounded-full overflow-hidden`}
        >
            {profilePhoto ? (
                <Image
                    src={profilePhoto}
                    alt={user.displayName || 'Profile'}
                    fill
                    sizes="48px"
                    className="object-cover"
                />
            ) : (
                <div className="w-full h-full bg-slate-100 grid place-items-center">
                    🧑‍🍳
                </div>
            )}
        </div>
    );
};

export default UserProfileDisplay;
