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

const CommentSection: React.FC<CommentSectionProps> = ({ recipeId }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentText, setCommentText] = useState('');
    const [usersMap, setUsersMap] = useState<Record<string, UserDoc>>({});
    const [submitting, setSubmitting] = useState(false);

    const canSubmit = useMemo(() => commentText.trim().length > 0 && !submitting, [commentText, submitting]);

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

        if (comments.length > 0) fetchUserData();
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
                    className="confirm-button h-12 w-12 p-0"
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
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold text-slate-900 truncate">
                                                {userInfo?.name || 'Ukjent bruker'}
                                            </h3>
                                            <span className="text-xs text-slate-500 whitespace-nowrap">
                        {timeText}
                      </span>
                                        </div>

                                        <p className="mt-1 text-sm text-slate-700 break-words">{comment.text}</p>
                                    </div>
                                </div>
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
