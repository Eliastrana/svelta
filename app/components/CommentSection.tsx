'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
}

interface CommentSectionProps {
    recipeId: string;
}

type RecipeDoc = {
    userId?: string; // owner of recipe
};

const CommentSection: React.FC<CommentSectionProps> = ({ recipeId }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentText, setCommentText] = useState('');
    const [usersMap, setUsersMap] = useState<Record<string, UserDoc>>({});
    const [submitting, setSubmitting] = useState(false);

    // recipe owner
    const [recipeOwnerId, setRecipeOwnerId] = useState<string>('');

    // delete state
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const currentUid = auth.currentUser?.uid ?? '';

    const canSubmit = useMemo(
        () => commentText.trim().length > 0 && !submitting,
        [commentText, submitting],
    );

    // fetch recipe owner
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

    // subscribe to comments
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

    // fetch user info for commenters
    useEffect(() => {
        const fetchUserData = async () => {
            const uniqueUserIds = Array.from(new Set(comments.map((c) => c.userId)));
            const newUsers: Record<string, UserDoc> = {};

            await Promise.all(
                uniqueUserIds.map(async (uid) => {
                    if (!usersMap[uid]) {
                        const userDocRef = doc(firestore, 'users', uid);
                        const docSnap = await getDoc(userDocRef);
                        if (docSnap.exists()) newUsers[uid] = docSnap.data() as UserDoc;
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
                // ✅ READS først
                const commentSnap = await tx.get(commentRef);
                if (!commentSnap.exists()) return;

                const recipeSnap = await tx.get(recipeRef);

                // ✅ beregn ny count (trygt)
                const currentCountRaw = recipeSnap.exists()
                    ? (recipeSnap.data().commentCount as number | undefined)
                    : undefined;

                const currentCount = typeof currentCountRaw === 'number' ? currentCountRaw : 0;
                const nextCount = Math.max(0, currentCount - 1);

                // ✅ WRITES etterpå
                tx.delete(commentRef);

                if (recipeSnap.exists()) {
                    tx.update(recipeRef, { commentCount: nextCount });
                }
            });

            setDeleteConfirmId(null);
        } catch (error) {
            console.error('Error deleting comment:', error);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="w-full mt-6">
            <h2 className="text-base font-semibold text-slate-900 mb-3">Kommentarer</h2>

            {/* Composer */}
            <form onSubmit={handleAddComment} className="flex items-center gap-2">
                <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Skriv en kommentar..."
                    className="flex-1 p-3 rounded-2xl bg-white shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-slate-200"
                />

                <button
                    type="submit"
                    disabled={!canSubmit}
                    className={[
                        'h-12 w-12 grid place-items-center rounded-2xl shadow-sm transition',
                        canSubmit
                            ? 'brown-button  hover:opacity-95 active:scale-[0.98] cursor-pointer'
                            : 'bg-slate-200 text-slate-500 cursor-not-allowed',
                    ].join(' ')}
                    aria-label="Send kommentar"
                >
                    <span className="material-symbols-outlined">send</span>
                </button>
            </form>

            {/* Comments list */}
            <div className="mt-4 space-y-3">
                {comments.length === 0 ? (
                    <p className="text-slate-600">Vær den første til å kommentere!</p>
                ) : (
                    comments.map((comment) => {
                        const userInfo = usersMap[comment.userId];
                        const timeText =
                            comment.createdAt instanceof Timestamp
                                ? dayjs(comment.createdAt.toDate()).fromNow()
                                : 'Akkurat nå';

                        const showDelete = canDelete(comment);

                        return (
                            <div key={comment.id} className="rounded-2xl bg-white shadow-sm p-3">
                                <div className="flex items-start gap-3">
                                    {userInfo?.photoURL ? (
                                        <img
                                            src={userInfo.photoURL}
                                            alt={userInfo.name || 'User'}
                                            className="w-12 h-12 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-slate-200" />
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className=" items-center min-w-0">
                                                <h3 className="text-sm font-semibold text-slate-900 truncate">
                                                    {userInfo?.name || 'Ukjent bruker'}
                                                </h3>
                                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                                    {timeText}
                                                </span>
                                            </div>

                                            {showDelete ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteConfirmId(comment.id)}
                                                    className="h-9 px-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold flex items-center gap-2"
                                                    aria-label="Slett kommentar"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    Slett
                                                </button>
                                            ) : null}
                                        </div>

                                        <p className="mt-1 text-sm text-slate-700 break-words">{comment.text}</p>
                                    </div>
                                </div>

                                {/* Inline confirm (only for this comment) */}
                                {deleteConfirmId === comment.id ? (
                                    <div className="mt-3 flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setDeleteConfirmId(null)}
                                            className="px-3 py-2 rounded-full border border-slate-200 hover:bg-slate-50 text-sm font-semibold"
                                            disabled={deletingId === comment.id}
                                        >
                                            Avbryt
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleDeleteComment(comment.id)}
                                            className="px-3 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-60"
                                            disabled={deletingId === comment.id}
                                        >
                                            {deletingId === comment.id ? 'Sletter…' : 'Slett'}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })
                )}
            </div>

            {/* space for bottom navbar */}
            <div className="h-20" />
        </div>
    );
};

export default CommentSection;