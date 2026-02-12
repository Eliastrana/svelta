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
    favoriteFood?: string; // ✅ add
}

interface CommentSectionProps {
    recipeId: string;
}

type RecipeDoc = {
    userId?: string; // owner of recipe
};

const CommentSection: React.FC<CommentSectionProps> = ({ recipeId }) => {
    const router = useRouter();

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

    const goToProfile = (uid: string) => {
        if (!uid) return;
        router.push(`/user/${uid}`);
    };

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
                            ? 'brown-button hover:opacity-95 active:scale-[0.98] cursor-pointer'
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
                                    {/* ✅ clickable avatar + name */}
                                    <button
                                        type="button"
                                        onClick={() => goToProfile(comment.userId)}
                                        className="flex items-center gap-3 text-left group"
                                        aria-label={`Åpne profil for ${userInfo?.name ?? 'bruker'}`}
                                    >
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 shrink-0 ring-1 ring-slate-200 group-hover:ring-slate-300 transition hover:cursor-pointer">
                                            {userInfo?.photoURL ? (
                                                <img
                                                    src={userInfo.photoURL}
                                                    alt={userInfo.name || 'User'}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full grid place-items-center text-slate-500">🧑‍🍳</div>
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-baseline gap-2 min-w-0 group-hover:cursor-pointer">
                                                <h3 className="text-sm font-semibold text-slate-900 truncate ">
                                                    {userInfo?.name || 'Ukjent bruker'}
                                                </h3>
                                                <span className="text-xs text-slate-500 whitespace-nowrap">{timeText}</span>
                                            </div>

                                            {/* ✅ favorite food */}
                                            {userInfo?.favoriteFood ? (
                                                <p className="mt-0.5 text-xs  truncate">
                                                    <span className="font-semibold ">Favorittmat:</span>{' '}
                                                    {userInfo.favoriteFood}
                                                </p>
                                            ) : null}
                                        </div>
                                    </button>

                                    {/* right side actions */}
                                    <div className="ml-auto">
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
                                </div>

                                <p className="mt-2 text-sm  break-words">{comment.text}</p>

                            </div>
                        );
                    })
                )}
            </div>

            {deleteConfirmId ? (
                <AppModal onClose={() => setDeleteConfirmId(null)}>
                    {({ closeWithAnim, closing }) => (
                        <div className="p-6">
                            <h2 className="text-xl font-semibold text-slate-900">Slette kommentaren?</h2>
                            <p className="text-slate-600 mt-2">Dette kan ikke angres.</p>

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeWithAnim}
                                    className="px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-50"
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
                                    className="px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white disabled:opacity-60"
                                    disabled={deletingId === deleteConfirmId || closing}
                                >
                                    {deletingId === deleteConfirmId ? 'Sletter…' : 'Slett'}
                                </button>
                            </div>
                        </div>
                    )}
                </AppModal>
            ) : null}

            <div className="h-20" />
        </div>
    );
};

export default CommentSection;
