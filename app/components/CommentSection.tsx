'use client';

import React, { useState, useEffect } from 'react';
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
    createdAt?: Timestamp; // ✅ optional because serverTimestamp resolves later
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

        const uid = user.uid;

        if (commentText.trim() === '') return;

        const recipeRef = doc(firestore, 'recipes', recipeId);
        const commentsRef = collection(firestore, 'recipes', recipeId, 'comments');

        try {
            await runTransaction(firestore, async (tx) => {
                const newCommentRef = doc(commentsRef); // auto-id
                tx.set(newCommentRef, {
                    text: commentText,
                    userId: uid,
                    createdAt: serverTimestamp(),
                });
                tx.update(recipeRef, { commentCount: increment(1) });
            });

            setCommentText('');
        } catch (error) {
            console.error('Error adding comment: ', error);
        }
    };


    return (
        <div className="mt-4 w-full mb-20">
            <h2 className="text-lg font-semibold mb-2 text-slate-900">Kommentarer</h2>

            <form onSubmit={handleAddComment} className="mb-4 flex items-center space-x-2">
                <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Skriv en kommentar..."
                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
                <button type="submit" className="px-3 py-2 confirm-button rounded-full">
                    <span className="material-symbols-outlined">send</span>
                </button>
            </form>

            <div>
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
                            <div key={comment.id} className="py-4 border-b border-slate-100 last:border-b-0">
                                <div className="flex items-center space-x-2">
                                    {userInfo?.photoURL ? (
                                        <img
                                            src={userInfo.photoURL}
                                            alt={userInfo.name || 'User'}
                                            className="w-16 h-16 rounded-full"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-gray-400" />
                                    )}
                                    <div>
                                        <h1 className="text-base font-semibold text-slate-900">
                                            {userInfo?.name || 'Ukjent bruker'}
                                        </h1>
                                        <p className="text-xs text-slate-500">{timeText}</p>
                                        <p className="mt-1 text-sm text-slate-700">{comment.text}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default CommentSection;
