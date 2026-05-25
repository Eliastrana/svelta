'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    doc,
    getDoc,
    onSnapshot,
    collection,
    serverTimestamp,
    increment,
    getDocs,
    writeBatch,
} from 'firebase/firestore';
import { firestore } from '@/firebase';
import { useAuthUser } from '@/hooks/useAuthUser';
import AppModal from '@/app/components/AppModal';

interface LikeButtonProps {
    recipeId: string;
    onRequireLogin?: () => void;
    className?: string;
    variant?: 'default' | 'compact';
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
                        const docData = userDocSnap.data() as {
                            name?: string;
                            photoURL?: string;
                        };

                        userData = {
                            name: docData.name,
                            photoURL: docData.photoURL,
                        };
                    }

                    return { userId, ...userData };
                });

                const results = await Promise.all(promises);

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
                    <div className="flex items-start justify-between gap-3 border-b border-[#d8d7cb] p-4">
                        <div>
                            <h3 className="text-lg font-bold text-[#12340d]">
                                Tok av seg hatten
                            </h3>

                            <p className="mt-0.5 text-sm text-[#496444]">
                                Folk som har likt denne oppskriften.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={closeWithAnim}
                            disabled={closing}
                            className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-[#e5e5d7] active:scale-95"
                            aria-label="Lukk"
                        >
                            <span className="material-symbols-outlined text-[#12340d]">
                                close
                            </span>
                        </button>
                    </div>

                    <div className="p-4">
                        {loading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div
                                        key={`sk-${i}`}
                                        className="flex items-center gap-3 rounded-xl bg-[#f2f1e8] p-3"
                                    >
                                        <div className="h-10 w-10 animate-pulse rounded-full bg-[#d8d7cb]" />

                                        <div className="flex-1">
                                            <div className="h-4 w-32 animate-pulse rounded bg-[#d8d7cb]" />
                                            <div className="mt-2 h-3 w-24 rounded bg-[#e5e5d7]" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : likedUsers.length === 0 ? (
                            <div className="rounded-xl bg-[#f2f1e8] p-4">
                                <p className="font-bold text-[#12340d]">
                                    Ingen likes enda.
                                </p>

                                <p className="mt-1 text-sm text-[#496444]">
                                    Vær den første til å ta av deg hatten 👨‍🍳
                                </p>
                            </div>
                        ) : (
                            <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                                {likedUsers.map((u) => (
                                    <li key={u.userId}>
                                        <Link
                                            href={`/user/${u.userId}`}
                                            onClick={() => closeWithAnim()}
                                            className="flex items-center gap-3 rounded-xl bg-[#f2f1e8] p-3 transition hover:bg-[#e8e7dc] active:scale-[0.99]"
                                        >
                                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#deded0]">
                                                {u.photoURL ? (
                                                    <img
                                                        src={u.photoURL}
                                                        alt={u.name || 'User'}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="grid h-full w-full place-items-center text-[#496444]">
                                                        🧑‍🍳
                                                    </div>
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-bold text-[#12340d]">
                                                    {u.name || 'Ukjent bruker'}
                                                </p>
                                            </div>

                                            <span className="material-symbols-outlined shrink-0 text-[20px] text-[#496444]">
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
                            className="mt-4 w-full rounded-full bg-[#12340d] py-2 font-semibold text-white transition hover:opacity-90 active:scale-[0.99]"
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

const LikeButton: React.FC<LikeButtonProps> = ({
                                                   recipeId,
                                                   onRequireLogin,
                                                   className,
                                                   variant = 'default',
                                               }) => {
    const currentUser = useAuthUser();

    const [likeCount, setLikeCount] = useState(0);
    const [hasLiked, setHasLiked] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [toggling, setToggling] = useState(false);

    const requireLogin = () => {
        if (onRequireLogin) onRequireLogin();
        else alert('Please sign in to continue.');
    };

    useEffect(() => {
        const recipeRef = doc(firestore, 'recipes', recipeId);

        const unsub = onSnapshot(recipeRef, (snap) => {
            const data = snap.data() as { likeCount?: number } | undefined;
            setLikeCount(typeof data?.likeCount === 'number' ? data.likeCount : 0);
        });

        return () => unsub();
    }, [recipeId]);

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
        const nextHasLiked = !hasLiked;
        const delta = nextHasLiked ? 1 : -1;

        try {
            setToggling(true);
            setHasLiked(nextHasLiked);
            setLikeCount((prev) => Math.max(0, prev + delta));

            const batch = writeBatch(firestore);

            if (nextHasLiked) {
                batch.set(likeRef, {
                    userId: currentUser.uid,
                    createdAt: serverTimestamp(),
                });
            } else {
                batch.delete(likeRef);
            }

            batch.update(recipeRef, { likeCount: increment(delta) });
            await batch.commit();
        } catch (error) {
            setHasLiked(!nextHasLiked);
            setLikeCount((prev) => Math.max(0, prev - delta));
            console.error('Error toggling like:', error);
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

    if (variant === 'compact') {
        return (
            <>
                <div
                    className={[
                        'flex h-full w-full flex-col items-center justify-center text-center text-xs text-[#12340d]',
                        className ?? '',
                    ].join(' ')}
                >
                    <button
                        type="button"
                        onClick={handleLikeToggle}
                        disabled={toggling}
                        className={[
                            'group flex flex-col items-center justify-center',
                            'transition active:scale-[0.96]',
                            toggling ? 'cursor-not-allowed opacity-70' : '',
                        ].join(' ')}
                        aria-label={likeLabel}
                    >
                    <span
                        className={[
                            'relative mb-1 grid h-9 w-9 place-items-center rounded-full transition',
                            hasLiked
                                ? 'bg-[#12340d] text-white'
                                : 'bg-[#e5e5d7] text-[#12340d] group-hover:bg-[#d8d7cb]',
                        ].join(' ')}
                    >
                        <img
                            src={hasLiked ? '/icons/chef_white.png' : '/icons/chef.png'}
                            alt=""
                            className="h-6 w-6"
                            draggable={false}
                        />

                        {likeCount > 0 && (
                            <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#b9e77a] px-1 text-[10px] font-bold leading-none text-[#12340d] ring-2 ring-[#f2f1e8]">
                                {likeCount > 99 ? '99+' : likeCount}
                            </span>
                        )}
                    </span>

                        <span className="font-medium leading-tight">
                        {hasLiked ? 'Likt' : 'Lik'}
                    </span>
                    </button>

                    {likeCount > 0 && (
                        <button
                            type="button"
                            onClick={openLikedUsers}
                            className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[#496444] underline-offset-2 hover:underline"
                        >
                            Se hvem
                        </button>
                    )}
                </div>

                {showModal && (
                    <LikedUsersModal
                        recipeId={recipeId}
                        onClose={() => setShowModal(false)}
                    />
                )}
            </>
        );
    }


    return (
        <>
            <div
                className={[
                    'flex items-center gap-3',
                    className ?? '',
                ].join(' ')}
            >
                <button
                    type="button"
                    onClick={handleLikeToggle}
                    disabled={toggling}
                    className={[
                        'inline-flex items-center gap-2 rounded-full px-4 py-2',
                        'border border-[#d8d7cb] bg-[#f2f1e8]',
                        'transition hover:bg-[#e8e7dc] active:scale-[0.99]',
                        toggling ? 'cursor-not-allowed opacity-70' : '',
                    ].join(' ')}
                    aria-label={likeLabel}
                >
                    <span
                        className={[
                            'grid h-8 w-8 place-items-center rounded-full',
                            hasLiked ? 'bg-[#12340d]' : 'bg-[#e5e5d7]',
                        ].join(' ')}
                    >
                        <img
                            src={hasLiked ? '/icons/chef_white.png' : '/icons/chef.png'}
                            alt=""
                            className="h-6 w-6"
                            draggable={false}
                        />
                    </span>

                    <span className="text-lg font-bold tabular-nums text-[#12340d]">
                        {likeCount}
                    </span>

                    <span className="hidden text-sm font-bold text-[#12340d] sm:inline">
                        {hasLiked ? 'Likt' : 'Lik'}
                    </span>
                </button>

                {likeCount > 0 && (
                    <button
                        type="button"
                        onClick={openLikedUsers}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-[#12340d] transition hover:bg-[#e8e7dc] active:scale-[0.99]"
                    >
                        Se hvem
                    </button>
                )}
            </div>

            {showModal && (
                <LikedUsersModal
                    recipeId={recipeId}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
};

export default LikeButton;
