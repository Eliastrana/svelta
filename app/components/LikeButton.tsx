'use client';

import React, { useEffect, useState } from 'react';
import {
    doc,
    getDoc,
    onSnapshot,
    collection,
    serverTimestamp,
    runTransaction,
    increment,
    getDocs,
} from 'firebase/firestore';
import { firestore } from '@/firebase';
import { useAuthUser } from '@/hooks/useAuthUser';

interface LikeButtonProps {
    recipeId: string;
}

interface LikedUser {
    userId: string;
    name?: string;
    photoURL?: string;
}

const LikedUsersModal: React.FC<{ recipeId: string; onClose: () => void }> = ({
                                                                                  recipeId,
                                                                                  onClose,
                                                                              }) => {
    const [likedUsers, setLikedUsers] = useState<LikedUser[]>([]);

    useEffect(() => {
        const fetchLikedUsers = async () => {
            const likesCollectionRef = collection(firestore, 'recipes', recipeId, 'likes');
            const snap = await getDocs(likesCollectionRef);

            const promises = snap.docs.map(async (docSnap) => {
                const data = docSnap.data() as { userId?: string };
                const userId = data.userId || docSnap.id;

                const userDocRef = doc(firestore, 'users', userId);
                const userDocSnap = await getDoc(userDocRef);

                let userData: Partial<LikedUser> = {};
                if (userDocSnap.exists()) {
                    const docData = userDocSnap.data();
                    userData = {
                        name: docData.name,
                        photoURL: docData.photoURL,
                    };
                }

                return { userId, ...userData };
            });

            const results = await Promise.all(promises);
            setLikedUsers(results);
        };

        fetchLikedUsers();
    }, [recipeId]);

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50">
            <div
                className="relative w-[90vw] max-w-md z-50 p-4 rounded-2xl shadow-xl backdrop-blur bg-white/95 border border-slate-200"
            >
                <h1 className="text-2xl font-semibold mb-4 text-slate-900">
                    Hvem som har tatt av seg hatten:
                </h1>

                <ul>
                    {likedUsers.length > 0 ? (
                        likedUsers.map((user) => (
                            <li key={user.userId} className="mb-2 flex items-center space-x-2">
                                {user.photoURL ? (
                                    <img
                                        src={user.photoURL}
                                        alt={user.name || 'User'}
                                        className="w-8 h-8 rounded-full"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-gray-400" />
                                )}
                                <span className="text-slate-700">{user.name || user.userId}</span>
                            </li>
                        ))
                    ) : (
                        <p className="text-slate-600">Ingen har likt denne oppskriften ennå.</p>
                    )}
                </ul>

                <button onClick={onClose} className="mt-4 px-4 py-2 confirm-button rounded-full">
                    Lukk
                </button>
            </div>
        </div>
    );
};

const LikeButton: React.FC<LikeButtonProps> = ({ recipeId }) => {
    const [likeCount, setLikeCount] = useState(0);
    const [hasLiked, setHasLiked] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const currentUser = useAuthUser();

    // Listen to likeCount on recipe doc (cheap)
    useEffect(() => {
        const recipeRef = doc(firestore, 'recipes', recipeId);
        const unsub = onSnapshot(recipeRef, (snap) => {
            const data = snap.data();
            setLikeCount(typeof data?.likeCount === 'number' ? data.likeCount : 0);
        });
        return () => unsub();
    }, [recipeId]);

    // Listen to current user's like doc (cheap)
    useEffect(() => {
        if (!currentUser?.uid) {
            setHasLiked(false);
            return;
        }
        const likeRef = doc(firestore, 'recipes', recipeId, 'likes', currentUser.uid);
        const unsub = onSnapshot(likeRef, (snap) => {
            setHasLiked(snap.exists());
        });
        return () => unsub();
    }, [recipeId, currentUser?.uid]);

    const handleLikeToggle = async () => {
        if (!currentUser?.uid) {
            alert('Please sign in to like a recipe.');
            return;
        }

        const recipeRef = doc(firestore, 'recipes', recipeId);
        const likeRef = doc(firestore, 'recipes', recipeId, 'likes', currentUser.uid);

        // Transaction keeps count + like doc consistent
        await runTransaction(firestore, async (tx) => {
            const likeSnap = await tx.get(likeRef);

            if (likeSnap.exists()) {
                tx.delete(likeRef);
                tx.update(recipeRef, { likeCount: increment(-1) });
            } else {
                tx.set(likeRef, {
                    userId: currentUser.uid,
                    createdAt: serverTimestamp(),
                });
                tx.update(recipeRef, { likeCount: increment(1) });
            }
        });
    };

    return (
        <div className="flex items-center space-x-2">
            <button onClick={handleLikeToggle} className="flex items-center space-x-2 text-slate-900">
        <span className="h-8 w-8">
          {hasLiked ? (
              <img src="/icons/chef_white.png" alt="Like" className="invert" />
          ) : (
              <img src="/icons/chef.png" alt="not liked" />
          )}
        </span>
                <span className="text-2xl font-semibold">{likeCount}</span>
            </button>

            <button onClick={() => setShowModal(true)} className="text-sm text-slate-600 underline">
                tok av seg hatten
            </button>

            {showModal && <LikedUsersModal recipeId={recipeId} onClose={() => setShowModal(false)} />}
        </div>
    );
};

export default LikeButton;
