'use client';
import React, { useEffect, useState } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { firestore } from '@/firebase';
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
        const fetchFollowers = async () => {
            const usersRef = collection(firestore, 'users');
            const snapshot = await getDocs(usersRef);
            const followers = snapshot.docs.filter((docSnap) => {
                const data = docSnap.data();
                return (
                    data.following &&
                    Array.isArray(data.following) &&
                    data.following.includes(uid)
                );
            });
            setFollowerCount(followers.length);
        };
        if (uid) {
            fetchFollowers();
        }
    }, [uid]);

    if (!userData) {
        return <div>Loading...</div>;
    }

    return (
        <div className="flex space-x-2 items-center cursor-pointer">
            {userData.photoURL && (
                <img
                    src={userData.photoURL}
                    alt={userData.name || 'User'}
                    className="h-16 w-16 rounded-full overflow-hidden"
                />
            )}
            <div>
                <h1 className="text-2xl">{userData.name || 'Ukjent bruker'}</h1>
                <p className="text-sm">{followerCount} følgere</p>
            </div>
        </div>
    );
};

export default UserProfileDisplayFollowers;
