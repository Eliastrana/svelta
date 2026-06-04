'use client';
import React, { useState, useEffect } from 'react';
import {
    doc,
    getDoc,
    collection,
    startAt,
    endAt,
    query,
    getDocs,
    orderBy,
} from 'firebase/firestore';
import { auth, firestore } from '@/firebase';
import { User } from 'firebase/auth';
import AppModal from '@/app/components/AppModal';
import {
    FollowableUserDoc,
    getFollowState,
    toggleFollowAction,
} from '@/helpers/followRequests';

type UserData = FollowableUserDoc;

interface UserSearchResult {
    uid: string;
    name: string;
    isProfilePrivate?: boolean;
}

interface UserSearchModalProps {
    onClose: () => void;
}

const UserSearchModal: React.FC<UserSearchModalProps> = ({ onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentUserDoc, setCurrentUserDoc] = useState<UserData | null>(null);
    const currentUser: User | null = auth.currentUser;

    /* ---------------- FETCH CURRENT FOLLOWING ---------------- */
    useEffect(() => {
        const fetchCurrentUserFollowing = async () => {
            if (!currentUser) return;
            const userDocRef = doc(firestore, 'users', currentUser.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as UserData;
                setCurrentUserDoc(data);
            }
        };
        fetchCurrentUserFollowing();
    }, [currentUser]);

    /* ---------------- SEARCH LOGIC ---------------- */
    useEffect(() => {
        // Skip querying until the user has typed at least 3 non-space characters
        if (searchTerm.trim().length < 3) {
            setResults([]);
            setLoading(false);
            return;
        }

        const fetchUsers = async () => {
            setLoading(true);
            try {
                const usersRef = collection(firestore, 'users');
                const q = query(
                    usersRef,
                    orderBy('name'),
                    startAt(searchTerm),
                    endAt(searchTerm + '\uf8ff')
                );

                const querySnapshot = await getDocs(q);
                const users: UserSearchResult[] = [];
                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data() as UserData;
                    users.push({
                        uid: docSnap.id,
                        name: data.name || 'Unnamed User',
                        isProfilePrivate: data.isProfilePrivate,
                    });
                });
                setResults(users);
            } catch (err) {
                console.error('Error fetching users:', err);
            }
            setLoading(false);
        };

        fetchUsers();
    }, [searchTerm]);

    /* ---------------- FOLLOW / UNFOLLOW ---------------- */
    const handleFollow = async (targetUid: string) => {
        if (!currentUser) {
            alert('Please log in to follow users.');
            return;
        }

        try {
            const result = await toggleFollowAction(currentUser.uid, targetUid);
            setCurrentUserDoc((prev) => ({
                ...(prev ?? {}),
                following:
                    result === 'followed'
                        ? Array.from(
                              new Set([...(prev?.following ?? []), targetUid])
                          )
                        : (prev?.following ?? []).filter(
                              (uid) => uid !== targetUid
                          ),
                outgoingFollowRequests:
                    result === 'requested'
                        ? Array.from(
                              new Set([
                                  ...(prev?.outgoingFollowRequests ?? []),
                                  targetUid,
                              ])
                          )
                        : (prev?.outgoingFollowRequests ?? []).filter(
                              (uid) => uid !== targetUid
                          ),
            }));
        } catch (err) {
            console.error('Error updating following:', err);
        }
    };

    return (
        <AppModal onClose={onClose}>
            {({ closeWithAnim }) => (
                <div className="relative p-4">
                    {/* Inner content */}
                    <div className="relative">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-slate-900">
                                Søk etter kokker
                            </h2>
                            <button
                                onClick={closeWithAnim}
                                className="cursor-pointer text-2xl leading-none text-slate-500"
                                aria-label="Lukk"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Search input */}
                        <input
                            type="text"
                            placeholder="Søk etter navn..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 rounded-lg mb-4 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        />

                        {/* Results list */}
                        {loading ? (
                            <p className="text-slate-600">Laster…</p>
                        ) : (
                            <div className="max-h-60 overflow-y-auto">
                                {searchTerm.trim().length < 3 ? (
                                    <p className="text-slate-600">
                                        Søk etter vennene dine, hvis du har noen
                                        🙄
                                    </p>
                                ) : results.length === 0 ? (
                                    <p className="text-slate-600">
                                        Ingen kokker funnet.
                                    </p>
                                ) : (
                                    results.map((user) => (
                                        <div
                                            key={user.uid}
                                            className="flex items-center justify-between py-2 text-slate-800"
                                        >
                                            <span>{user.name}</span>
                                            {currentUser &&
                                            currentUser.uid === user.uid ? (
                                                <span className="text-sm text-slate-500">
                                                    Deg
                                                </span>
                                            ) : (
                                                (() => {
                                                    const state =
                                                        getFollowState(
                                                            currentUser?.uid ??
                                                                '',
                                                            user.uid,
                                                            currentUserDoc,
                                                            user
                                                        );
                                                    const isFollowing =
                                                        state === 'following';
                                                    const isRequested =
                                                        state === 'requested';
                                                    return (
                                                        <button
                                                            onClick={() =>
                                                                handleFollow(
                                                                    user.uid
                                                                )
                                                            }
                                                            className={[
                                                                'px-3 py-1 rounded-full text-sm cursor-pointer transition',
                                                                isFollowing
                                                                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                                    : isRequested
                                                                      ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                                                      : 'bg-[var(--accent-strong)] text-[#12340d] hover:bg-[var(--accent)]',
                                                            ].join(' ')}
                                                        >
                                                            {isFollowing ? (
                                                                <span className="material-symbols-outlined">
                                                                    close
                                                                </span>
                                                            ) : isRequested ? (
                                                                <span className="material-symbols-outlined">
                                                                    schedule
                                                                </span>
                                                            ) : user.isProfilePrivate ? (
                                                                <span className="material-symbols-outlined">
                                                                    person_add
                                                                </span>
                                                            ) : (
                                                                <span className="material-symbols-outlined">
                                                                    add
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })()
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AppModal>
    );
};

export default UserSearchModal;
