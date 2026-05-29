'use client';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useUserData } from '@/hooks/useUserData';

interface UserProfileDisplayProps {
    uid: string;
}

const UserProfileDisplayFollowers: React.FC<UserProfileDisplayProps> = ({
    uid,
}) => {
    const userData = useUserData(uid);
    const [followerCount, setFollowerCount] = useState<number>(0);

    useEffect(() => {
        if (typeof userData?.followerCount === 'number') {
            setFollowerCount(userData.followerCount);
        }
    }, [userData?.followerCount]);

    if (!userData) {
        return <div>Loading...</div>;
    }

    return (
        <div className="flex space-x-2 items-center cursor-pointer">
            {userData.photoURL ? (
                <div className="relative h-16 w-16 overflow-hidden rounded-full">
                    <Image
                        src={userData.photoURL}
                        alt={userData.name || 'User'}
                        fill
                        sizes="64px"
                        className="object-cover"
                    />
                </div>
            ) : null}
            <div>
                <h1 className="text-2xl">{userData.name || 'Ukjent bruker'}</h1>
                <p className="text-sm">{followerCount} følgere</p>
            </div>
        </div>
    );
};

export default UserProfileDisplayFollowers;
