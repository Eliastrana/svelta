'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    getDoc,
    serverTimestamp,
    Timestamp,
    doc,
    increment,
    runTransaction,
} from 'firebase/firestore';
import { auth, firestore } from '@/firebase';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/nb';
import AppModal from '@/app/components/AppModal';

dayjs.extend(relativeTime);
dayjs.locale('nb');

interface Comment {
    id: string;
    text: string;
    userId: string;
    createdAt?: Timestamp;
}

interface UserDoc {
    name?: string;
    photoURL?: string;
    favoriteFood?: string;
}

interface CommentSectionProps {
    recipeId: string;
}

type RecipeDoc = {
    userId?: string;
};

const CommentSection: React.FC<CommentSectionProps> = ({ recipeId }) => {
    const router = useRouter();

    const [comments, setComments] = useState<Comment[]>([]);
    const [commentText, setCommentText] = useState('');
    const [usersMap, setUsersMap] = useState<Record<string, UserDoc>>({});
    const [submitting, setSubmitting] = useState(false);

    const [recipeOwnerId, setRecipeOwnerId] = useState<string>('');

    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const currentUid = auth.currentUser?.uid ?? '';

    const canSubmit = useMemo(
        () => commentText.trim().length > 0 && !submitting,
        [commentText, submitting],
    );

    const goToProfile = (uid: string) => {
        if (!uid) return;
        router.push(`/user/${uid}`);
    };

    useEffect(() => {
        const fetchOwner = async () => {
            try {
                const recipeRef = doc(firestore, 'recipes', recipeId);
                const snap = await getDoc(recipeRef);

                if (snap.exists()) {
                    const data = snap.data() as RecipeDoc;
                    setRecipeOwnerId(data.userId ?? '');
                } else {
                    setRecipeOwnerId('');
                }
            } catch (e) {
                console.error('Error fetching recipe owner:', e);
                setRecipeOwnerId('');
            }
        };

        if (recipeId) void fetchOwner();
    }, [recipeId]);

    useEffect(() => {
        const commentsRef = collection(firestore, 'recipes', recipeId, 'comments');
        const commentsQuery = query(commentsRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
            const commentsData: Comment[] = snapshot.docs.map((d) => {
                const data = d.data() as Omit<Comment, 'id'>;
                return { id: d.id, ...data };
            });

            setComments(commentsData);
        });

        return () => unsubscribe();
    }, [recipeId]);

    useEffect(() => {
        const fetchUserData = async () => {
            const uniqueUserIds = Array.from(new Set(comments.map((c) => c.userId)));
            const newUsers: Record<string, UserDoc> = {};

            await Promise.all(
                uniqueUserIds.map(async (uid) => {
                    if (!usersMap[uid]) {
                        const userDocRef = doc(firestore, 'publicUsers', uid);
                        const docSnap = await getDoc(userDocRef);

                        if (docSnap.exists()) {
                            newUsers[uid] = docSnap.data() as UserDoc;
                        }
                    }
                }),
            );

            if (Object.keys(newUsers).length > 0) {
                setUsersMap((prev) => ({ ...prev, ...newUsers }));
            }
        };

        if (comments.length > 0) void fetchUserData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comments]);

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();

        const user = auth.currentUser;

        if (!user) {
            alert('Please sign in to comment.');
            return;
        }

        const text = commentText.trim();

        if (!text || submitting) return;

        const recipeRef = doc(firestore, 'recipes', recipeId);
        const commentsRef = collection(firestore, 'recipes', recipeId, 'comments');

        try {
            setSubmitting(true);

            await runTransaction(firestore, async (tx) => {
                const newCommentRef = doc(commentsRef);

                tx.set(newCommentRef, {
                    text,
                    userId: user.uid,
                    createdAt: serverTimestamp(),
                });

                tx.update(recipeRef, { commentCount: increment(1) });
            });

            setCommentText('');
        } catch (error) {
            console.error('Error adding comment: ', error);
        } finally {
            setSubmitting(false);
        }
    };

    const canDelete = (comment: Comment): boolean => {
        if (!currentUid) return false;

        const isOwn = comment.userId === currentUid;
        const isRecipeOwner = !!recipeOwnerId && recipeOwnerId === currentUid;

        return isOwn || isRecipeOwner;
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!currentUid) {
            alert('Du må være logget inn.');
            return;
        }

        const comment = comments.find((c) => c.id === commentId);
        if (!comment) return;

        if (!canDelete(comment)) {
            alert('Du kan ikke slette denne kommentaren.');
            return;
        }

        const recipeRef = doc(firestore, 'recipes', recipeId);
        const commentRef = doc(firestore, 'recipes', recipeId, 'comments', commentId);

        try {
            setDeletingId(commentId);

            await runTransaction(firestore, async (tx) => {
                const commentSnap = await tx.get(commentRef);

                if (!commentSnap.exists()) return;

                const recipeSnap = await tx.get(recipeRef);

                const currentCountRaw = recipeSnap.exists()
                    ? (recipeSnap.data().commentCount as number | undefined)
                    : undefined;

                const currentCount = typeof currentCountRaw === 'number' ? currentCountRaw : 0;
                const nextCount = Math.max(0, currentCount - 1);

                tx.delete(commentRef);

                if (recipeSnap.exists()) {
                    tx.update(recipeRef, { commentCount: nextCount });
                }
            });
        } catch (error) {
            console.error('Error deleting comment:', error);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="w-full text-[#12340d]">
            <div className="mb-5 flex items-end justify-between gap-3">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">
                        Kommentarer
                    </h2>

                    <p className="mt-1 text-sm text-[#496444]">
                        {comments.length === 1
                            ? '1 kommentar'
                            : `${comments.length} kommentarer`}
                    </p>
                </div>
            </div>

            {/* Composer */}
            <form onSubmit={handleAddComment} className="flex items-center gap-2">
                <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Skriv en kommentar..."
                    className="min-w-0 flex-1 rounded-xl border border-[#d8d7cb] bg-[#fbfaf4] px-4 py-3 text-[#12340d] placeholder:text-[#6f8068] outline-none transition focus:border-[#12340d] focus:ring-2 focus:ring-[#12340d]/10"
                />

                <button
                    type="submit"
                    disabled={!canSubmit}
                    className={[
                        'grid h-12 w-12 shrink-0 place-items-center rounded-xl transition active:scale-[0.98]',
                        canSubmit
                            ? 'bg-[#12340d] text-white hover:opacity-90 cursor-pointer'
                            : 'bg-[#deded0] text-[#7a8774] cursor-not-allowed',
                    ].join(' ')}
                    aria-label="Send kommentar"
                >
                    <span className="material-symbols-outlined">
                        {submitting ? 'progress_activity' : 'send'}
                    </span>
                </button>
            </form>

            {/* Comments list */}
            <div className="mt-5 space-y-3">
                {comments.length === 0 ? (
                    <div className="rounded-xl border border-[#d8d7cb] bg-[#fbfaf4] p-4">
                        <p className="font-medium text-[#12340d]">
                            Vær den første til å kommentere!
                        </p>

                        <p className="mt-1 text-sm text-[#496444]">
                            Del et tips, en erfaring eller bare litt matglede.
                        </p>
                    </div>
                ) : (
                    comments.map((comment) => {
                        const userInfo = usersMap[comment.userId];

                        const timeText =
                            comment.createdAt instanceof Timestamp
                                ? dayjs(comment.createdAt.toDate()).fromNow()
                                : 'Akkurat nå';

                        const showDelete = canDelete(comment);

                        return (
                            <article
                                key={comment.id}
                                className="rounded-xl border border-[#d8d7cb] bg-[#fbfaf4] p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <button
                                        type="button"
                                        onClick={() => goToProfile(comment.userId)}
                                        className="group flex min-w-0 items-start gap-3 text-left"
                                        aria-label={`Åpne profil for ${userInfo?.name ?? 'bruker'}`}
                                    >
                                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#deded0] ring-1 ring-[#d8d7cb] transition group-hover:ring-[#12340d]/30">
                                            {userInfo?.photoURL ? (
                                                <img
                                                    src={userInfo.photoURL}
                                                    alt={userInfo.name || 'User'}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="grid h-full w-full place-items-center text-[#496444]">
                                                    🧑‍🍳
                                                </div>
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                <h3 className="truncate text-sm font-bold text-[#12340d]">
                                                    {userInfo?.name || 'Ukjent bruker'}
                                                </h3>

                                                <span className="whitespace-nowrap text-xs text-[#6f8068]">
                                                    {timeText}
                                                </span>
                                            </div>

                                            {userInfo?.favoriteFood ? (
                                                <p className="mt-0.5 truncate text-xs text-[#496444]">
                                                    <span className="font-bold">
                                                        Favorittmat:
                                                    </span>{' '}
                                                    {userInfo.favoriteFood}
                                                </p>
                                            ) : null}
                                        </div>
                                    </button>

                                    {showDelete ? (
                                        <button
                                            type="button"
                                            onClick={() => setDeleteConfirmId(comment.id)}
                                            className="ml-auto inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#e5e5d7] px-3 text-sm font-medium text-[#12340d] transition hover:bg-[#d8d7cb]"
                                            aria-label="Slett kommentar"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">
                                                delete
                                            </span>
                                            <span className="hidden sm:inline">Slett</span>
                                        </button>
                                    ) : null}
                                </div>

                                <p className="mt-3 break-words text-sm leading-relaxed text-[#12340d]">
                                    {comment.text}
                                </p>
                            </article>
                        );
                    })
                )}
            </div>

            {deleteConfirmId ? (
                <AppModal onClose={() => setDeleteConfirmId(null)}>
                    {({ closeWithAnim, closing }) => (
                        <div className="p-6 text-[#12340d]">
                            <h2 className="text-xl font-bold">
                                Slette kommentaren?
                            </h2>

                            <p className="mt-2 text-[#496444]">
                                Dette kan ikke angres.
                            </p>

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeWithAnim}
                                    className="rounded-full border border-[#d8d7cb] px-4 py-2 text-[#12340d] transition hover:bg-[#f2f1e8]"
                                    disabled={deletingId === deleteConfirmId || closing}
                                >
                                    Avbryt
                                </button>

                                <button
                                    type="button"
                                    onClick={async () => {
                                        await handleDeleteComment(deleteConfirmId);
                                        closeWithAnim();
                                    }}
                                    className="rounded-full bg-red-500 px-4 py-2 text-white transition hover:bg-red-600 disabled:opacity-60"
                                    disabled={deletingId === deleteConfirmId || closing}
                                >
                                    {deletingId === deleteConfirmId ? 'Sletter…' : 'Slett'}
                                </button>
                            </div>
                        </div>
                    )}
                </AppModal>
            ) : null}
        </div>
    );
};

export default CommentSection;
