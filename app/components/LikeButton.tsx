'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
import AppModal from '@/app/components/AppModal';

interface LikeButtonProps {
    recipeId: string;
    /**
     * If provided: called when user presses like / "Se hvem" while not logged in.
     * Typical: () => router.push(`/login?next=${encodeURIComponent(path)}`)
     */
    onRequireLogin?: () => void;
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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const fetchLikedUsers = async () => {
            setLoading(true);
            try {
                const likesCollectionRef = collection(firestore, 'recipes', recipeId, 'likes');
                const snap = await getDocs(likesCollectionRef);

                const promises = snap.docs.map(async (docSnap) => {
                    const data = docSnap.data() as { userId?: string };
                    const userId = data.userId || docSnap.id;

                    const userDocRef = doc(firestore, 'users', userId);
                    const userDocSnap = await getDoc(userDocRef);

                    let userData: Partial<LikedUser> = {};
                    if (userDocSnap.exists()) {
                        const docData = userDocSnap.data() as { name?: string; photoURL?: string };
                        userData = {
                            name: docData.name,
                            photoURL: docData.photoURL,
                        };
                    }

                    return { userId, ...userData };
                });

                const results = await Promise.all(promises);

                // Optional: sort by name, fallback to uid
                results.sort((a, b) => {
                    const an = (a.name || a.userId).toLowerCase();
                    const bn = (b.name || b.userId).toLowerCase();
                    return an.localeCompare(bn);
                });

                if (!cancelled) setLikedUsers(results);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchLikedUsers();
        return () => {
            cancelled = true;
        };
    }, [recipeId]);

    return (
        <AppModal onClose={onClose}>
            {({ closeWithAnim, closing }) => (
                <>
                    {/* header */}
                    <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-200">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Tok av seg hatten</h3>
                            <p className="text-sm text-slate-600 mt-0.5">
                                Folk som har likt denne oppskriften.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={closeWithAnim}
                            disabled={closing}
                            className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100 transition active:scale-95"
                            aria-label="Lukk"
                        >
                            <span className="material-symbols-outlined text-slate-700">close</span>
                        </button>
                    </div>

                    {/* content */}
                    <div className="p-4">
                        {loading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div
                                        key={`sk-${i}`}
                                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                                    >
                                        <div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse" />
                                        <div className="flex-1">
                                            <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
                                            <div className="h-3 w-24 rounded bg-slate-100 mt-2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : likedUsers.length === 0 ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-slate-700 font-medium">Ingen likes enda.</p>
                                <p className="text-sm text-slate-600 mt-1">
                                    Vær den første til å ta av deg hatten 👨‍🍳
                                </p>
                            </div>
                        ) : (
                            <ul className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                                {likedUsers.map((u) => (
                                    <li key={u.userId}>
                                        <Link
                                            href={`/user/${u.userId}`} // Change if your profile route is different (e.g. /profil/[id] or /users/[id])
                                            onClick={() => closeWithAnim()}
                                            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 hover:bg-slate-50 transition active:scale-[0.99]"
                                        >
                                            <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-100 shrink-0">
                                                {u.photoURL ? (
                                                    <img
                                                        src={u.photoURL}
                                                        alt={u.name || 'User'}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full grid place-items-center text-slate-500">
                                                        🧑‍🍳
                                                    </div>
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-slate-900 truncate">
                                                    {u.name || 'Ukjent bruker'}
                                                </p>
                                            </div>

                                            <span className="material-symbols-outlined text-slate-400 text-[20px] shrink-0">
                                                chevron_right
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <button
                            type="button"
                            onClick={closeWithAnim}
                            className="mt-4 w-full rounded-full py-2 font-semibold shadow-sm
                       bg-slate-100 hover:bg-slate-200 transition active:scale-[0.99]"
                            disabled={closing}
                        >
                            Ferdig
                        </button>
                    </div>
                </>
            )}
        </AppModal>
    );
};

const LikeButton: React.FC<LikeButtonProps> = ({ recipeId, onRequireLogin }) => {
    const currentUser = useAuthUser();

    const [likeCount, setLikeCount] = useState(0);
    const [hasLiked, setHasLiked] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [toggling, setToggling] = useState(false);

    const requireLogin = () => {
        if (onRequireLogin) onRequireLogin();
        else alert('Please sign in to continue.');
    };

    // Listen to likeCount on recipe doc (cheap)
    useEffect(() => {
        const recipeRef = doc(firestore, 'recipes', recipeId);
        const unsub = onSnapshot(recipeRef, (snap) => {
            const data = snap.data() as { likeCount?: number } | undefined;
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
        const unsub = onSnapshot(likeRef, (snap) => setHasLiked(snap.exists()));
        return () => unsub();
    }, [recipeId, currentUser?.uid]);

    const handleLikeToggle = async () => {
        if (!currentUser?.uid) {
            requireLogin();
            return;
        }
        if (toggling) return;

        const recipeRef = doc(firestore, 'recipes', recipeId);
        const likeRef = doc(firestore, 'recipes', recipeId, 'likes', currentUser.uid);

        try {
            setToggling(true);

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
        } finally {
            setToggling(false);
        }
    };

    const openLikedUsers = () => {
        if (!currentUser?.uid) {
            requireLogin();
            return;
        }
        setShowModal(true);
    };

    const likeLabel = hasLiked ? 'Ta på hatten' : 'Ta av deg hatten';

    return (
        <div className="flex items-center gap-3">
            {/* Like button */}
            <button
                type="button"
                onClick={handleLikeToggle}
                disabled={toggling}
                className={[
                    'inline-flex items-center gap-2 rounded-full px-4 py-2',
                    'border border-slate-200 bg-white shadow-sm',
                    'hover:bg-slate-50 transition active:scale-[0.99]',
                    toggling ? 'opacity-70 cursor-not-allowed' : '',
                ].join(' ')}
                aria-label={likeLabel}
            >
                <span className="h-7 w-7 grid place-items-center">
                    {hasLiked ? (
                        <img src="/icons/chef_white.png" alt="Liked" className="invert w-6 h-6" />
                    ) : (
                        <img src="/icons/chef.png" alt="Not liked" className="w-6 h-6" />
                    )}
                </span>

                <span className="text-lg font-semibold text-slate-900 tabular-nums">{likeCount}</span>

                <span className="text-sm font-semibold text-slate-700 hidden sm:inline">
                    {hasLiked ? 'Likt' : 'Lik'}
                </span>
            </button>

            {/* Open modal */}
            <button
                type="button"
                onClick={openLikedUsers}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-700
                   hover:bg-slate-100 transition active:scale-[0.99]"
            >
                Se hvem
            </button>

            {showModal && <LikedUsersModal recipeId={recipeId} onClose={() => setShowModal(false)} />}
        </div>
    );
};

export default LikeButton;