'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    collection,
    startAt,
    endAt,
    query,
    getDocs,
    orderBy,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, firestore } from '@/firebase';
import Button from '@/app/components/Button';

interface UserData {
    name?: string;
    following?: string[];
}

interface UserSearchResult {
    uid: string;
    name: string;
}

const AddFriendsPage: React.FC = () => {
    const router = useRouter();

    const [authReady, setAuthReady] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentFollowing, setCurrentFollowing] = useState<string[]>([]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setCurrentUser(u);
            setAuthReady(true);
            if (!u) router.push('/login');
        });
        return () => unsub();
    }, [router]);

    const uid = currentUser?.uid ?? '';

    // fetch following once
    useEffect(() => {
        const fetchCurrentUserFollowing = async () => {
            if (!uid) return;
            const userDocRef = doc(firestore, 'users', uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as UserData;
                setCurrentFollowing(data.following ?? []);
            }
        };
        fetchCurrentUserFollowing();
    }, [uid]);

    // normalize search term for consistent ordering (optional)
    const trimmed = useMemo(() => searchTerm.trim(), [searchTerm]);

    // search
    useEffect(() => {
        if (trimmed.length < 3) {
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
                    startAt(trimmed),
                    endAt(trimmed + '\uf8ff'),
                );

                const querySnapshot = await getDocs(q);
                const users: UserSearchResult[] = [];
                querySnapshot.forEach((d) => {
                    const data = d.data() as UserData;
                    users.push({
                        uid: d.id,
                        name: data.name || 'Unnamed User',
                    });
                });
                setResults(users);
            } catch (err) {
                console.error('Error fetching users:', err);
            }
            setLoading(false);
        };

        fetchUsers();
    }, [trimmed]);

    const handleFollow = async (targetUid: string) => {
        if (!uid) {
            alert('Please log in to follow users.');
            return;
        }

        const currentUserRef = doc(firestore, 'users', uid);

        try {
            if (currentFollowing.includes(targetUid)) {
                await updateDoc(currentUserRef, { following: arrayRemove(targetUid) });
                setCurrentFollowing((prev) => prev.filter((x) => x !== targetUid));
            } else {
                await updateDoc(currentUserRef, { following: arrayUnion(targetUid) });
                setCurrentFollowing((prev) => [...prev, targetUid]);
            }
        } catch (err) {
            console.error('Error updating following:', err);
        }
    };

    if (!authReady) return <div className="p-4 text-slate-600">Laster…</div>;
    if (!currentUser) return null; // redirected to /login

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Top bar */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
                <div className="mx-auto max-w-xl px-4 py-3 flex items-center justify-between">
                    <Button
                        onClick={() => router.back()}
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        Tilbake
                    </Button>

                    <h1 className="text-lg font-semibold text-slate-900">Søk etter kokker</h1>

                    <div className="w-10" />
                </div>
            </div>

            {/* Content */}
            <div className="mx-auto max-w-xl px-4 py-6">
                <input
                    type="text"
                    placeholder="Søk etter navn..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                />

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="p-4">
                        {loading ? (
                            <p className="text-slate-600">Laster…</p>
                        ) : trimmed.length < 3 ? (
                            <p className="text-slate-600">Søk etter vennene dine, hvis du har noen 🙄</p>
                        ) : results.length === 0 ? (
                            <p className="text-slate-600">Ingen kokker funnet.</p>
                        ) : (
                            <div className="max-h-[60vh] overflow-y-auto">
                                {results.map((u) => (
                                    <div
                                        key={u.uid}
                                        className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0"
                                    >
                                        <span className="text-slate-900 font-medium">{u.name}</span>

                                        {uid === u.uid ? (
                                            <span className="text-sm text-slate-500">Deg</span>
                                        ) : (
                                            <Button
                                                onClick={() => handleFollow(u.uid)}
                                                className="text-sm"
                                                aria-label={currentFollowing.includes(u.uid) ? 'Slutt å følge' : 'Følg'}
                                            >
                                                {currentFollowing.includes(u.uid) ? (
                                                    <span className="material-symbols-outlined">close</span>
                                                ) : (
                                                    <span className="material-symbols-outlined">add</span>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddFriendsPage;
