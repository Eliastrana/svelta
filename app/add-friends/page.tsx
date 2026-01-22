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
    where,
    documentId,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, firestore } from '@/firebase';

interface UserData {
    name?: string;
    following?: string[];
    photoURL?: string;
}

interface UserSearchResult {
    uid: string;
    name: string;
    photoURL?: string;
}

type FriendsTab = 'friends' | 'following' | 'followers';

const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const fetchUsersByIds = async (uids: string[]): Promise<UserSearchResult[]> => {
    if (uids.length === 0) return [];
    const usersRef = collection(firestore, 'users');

    const chunks = chunk(uids, 10);
    const all: UserSearchResult[] = [];

    for (const c of chunks) {
        const q = query(usersRef, where(documentId(), 'in', c));
        const snap = await getDocs(q);
        snap.forEach((d) => {
            const data = d.data() as UserData;
            all.push({
                uid: d.id,
                name: data.name || 'Unnamed User',
                photoURL: data.photoURL,
            });
        });
    }

    // behold rekkefølgen fra input
    const orderIndex = new Map(uids.map((id, i) => [id, i]));
    all.sort((a, b) => (orderIndex.get(a.uid) ?? 999999) - (orderIndex.get(b.uid) ?? 999999));

    return all;
};

/**
 * Hent "followers" uten å lagre followers-array:
 * Followers = alle user-docs der following array-contains uid.
 * Returner både ids + liste.
 */
const fetchFollowersForUid = async (uid: string): Promise<UserSearchResult[]> => {
    if (!uid) return [];

    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where('following', 'array-contains', uid));

    const snap = await getDocs(q);
    const out: UserSearchResult[] = [];
    snap.forEach((d) => {
        const data = d.data() as UserData;
        out.push({
            uid: d.id,
            name: data.name || 'Unnamed User',
            photoURL: data.photoURL,
        });
    });

    // valgfritt: sorter alfabetisk
    out.sort((a, b) => a.name.localeCompare(b.name, 'no'));

    return out;
};

// function normalizeSearch(s: string) {
//     return s
//         .trim()
//         .toLowerCase()
//         .normalize('NFD')
//         .replace(/[\u0300-\u036f]/g, '') // fjerner aksenter
//         .replace(/\s+/g, ' ');
// }

// function buildPrefixTokens(name: string) {
//     const n = normalizeSearch(name);
//     const words = n.split(' ').filter(Boolean);
//
//     const tokens = new Set<string>();
//
//     for (const w of words) {
//         // prefixes: "eli", "elia", "elias" osv
//         for (let i = 1; i <= w.length; i++) {
//             tokens.add(w.slice(0, i));
//         }
//     }
//
//     // også hele strengen uten mellomrom (valgfritt)
//     const compact = n.replace(/\s/g, '');
//     for (let i = 1; i <= compact.length; i++) tokens.add(compact.slice(0, i));
//
//     return Array.from(tokens);
// }

const AddFriendsPage: React.FC = () => {
    const router = useRouter();

    const [authReady, setAuthReady] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);

    const [currentFollowing, setCurrentFollowing] = useState<string[]>([]);

    const [activeTab, setActiveTab] = useState<FriendsTab>('friends');

    const [friendsList, setFriendsList] = useState<UserSearchResult[]>([]);
    const [followingList, setFollowingList] = useState<UserSearchResult[]>([]);
    const [followersList, setFollowersList] = useState<UserSearchResult[]>([]);
    const [loadingTopList, setLoadingTopList] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setCurrentUser(u);
            setAuthReady(true);
            if (!u) router.push('/login');
        });
        return () => unsub();
    }, [router]);

    const uid = currentUser?.uid ?? '';

    // hent following for current user
    useEffect(() => {
        const fetchMyFollowing = async () => {
            if (!uid) return;

            const meRef = doc(firestore, 'users', uid);
            const snap = await getDoc(meRef);

            if (!snap.exists()) {
                setCurrentFollowing([]);
                return;
            }

            const data = snap.data() as UserData;
            setCurrentFollowing(data.following ?? []);
        };

        fetchMyFollowing();
    }, [uid]);

    // Bygg topp-lister (friends/following/followers)
    useEffect(() => {
        const buildLists = async () => {
            if (!uid) return;

            setLoadingTopList(true);
            try {
                // 1) Following-list (fra ids)
                const followingUsers = await fetchUsersByIds(currentFollowing);
                setFollowingList(followingUsers);

                // 2) Followers-list (uten å lagre) via array-contains
                const followersUsers = await fetchFollowersForUid(uid);
                setFollowersList(followersUsers);

                // 3) Friends = intersection mellom currentFollowing og followersIds
                const followersIds = new Set(followersUsers.map((u) => u.uid));
                const friendsIds = currentFollowing.filter((id) => followersIds.has(id));
                const friendsUsers = await fetchUsersByIds(friendsIds);
                setFriendsList(friendsUsers);
            } catch (err) {
                console.error('Error building top lists:', err);
            } finally {
                setLoadingTopList(false);
            }
        };

        buildLists();
    }, [uid, currentFollowing]);

    const trimmed = useMemo(() => searchTerm.trim(), [searchTerm]);

    // search
    useEffect(() => {
        if (trimmed.length < 3) {
            setResults([]);
            setLoadingSearch(false);
            return;
        }

        const fetchUsers = async () => {
            setLoadingSearch(true);
            try {
                const usersRef = collection(firestore, 'users');
                const q = query(usersRef, orderBy('name'), startAt(trimmed), endAt(trimmed + '\uf8ff'));

                const querySnapshot = await getDocs(q);
                const users: UserSearchResult[] = [];
                querySnapshot.forEach((d) => {
                    const data = d.data() as UserData;
                    users.push({
                        uid: d.id,
                        name: data.name || 'Unnamed User',
                        photoURL: data.photoURL,
                    });
                });
                setResults(users);
            } catch (err) {
                console.error('Error fetching users:', err);
            }
            setLoadingSearch(false);
        };

        fetchUsers();
    }, [trimmed]);

    // ✅ follow/unfollow oppdaterer KUN currentUser.following
    const handleFollow = async (targetUid: string) => {
        if (!uid) {
            alert('Please log in to follow users.');
            return;
        }

        const meRef = doc(firestore, 'users', uid);

        try {
            const isFollowing = currentFollowing.includes(targetUid);

            if (isFollowing) {
                await updateDoc(meRef, { following: arrayRemove(targetUid) });
                setCurrentFollowing((prev) => prev.filter((x) => x !== targetUid));
            } else {
                await updateDoc(meRef, { following: arrayUnion(targetUid) });
                setCurrentFollowing((prev) => [...prev, targetUid]);
            }
        } catch (err) {
            console.error('Error updating following:', err);
        }
    };

    if (!authReady) return <div className="p-4 text-slate-600">Laster…</div>;
    if (!currentUser) return null;

    const FollowButton = ({ targetUid }: { targetUid: string }) => {
        const isFollowing = currentFollowing.includes(targetUid);

        return (
            <button
                type="button"
                onClick={() => handleFollow(targetUid)}
                className={[
                    'px-4 py-2 rounded-full text-sm font-semibold transition',
                    isFollowing
                        ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                        : 'bg-cyan-100 text-slate-900 hover:bg-cyan-200',
                ].join(' ')}
                aria-label={isFollowing ? 'Slutt å følge' : 'Følg'}
            >
                {isFollowing ? 'Slutt å følge' : 'Følg'}
            </button>
        );
    };

    const TopRow = ({ u }: { u: UserSearchResult }) => (
        <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0">
            <button
                type="button"
                onClick={() => router.push(`/user/${u.uid}`)}
                className="flex items-center gap-3 text-left"
            >
                <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-100 shrink-0">
                    {u.photoURL ? (
                        <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full grid place-items-center text-slate-500">🧑‍🍳</div>
                    )}
                </div>
                <span className="text-slate-900 font-medium">{u.name}</span>
            </button>

            {uid === u.uid ? <span className="text-sm text-slate-500">Deg</span> : <FollowButton targetUid={u.uid} />}
        </div>
    );

    const topList =
        activeTab === 'friends' ? friendsList : activeTab === 'following' ? followingList : followersList;

    const activeCount =
        activeTab === 'friends'
            ? friendsList.length
            : activeTab === 'following'
                ? followingList.length
                : followersList.length;

    return (
        <div className="min-h-screen">
            {/* Top bar */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
                <div className="mx-auto max-w-xl px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="h-10 w-10 grid place-items-center rounded-full hover:bg-slate-100"
                        aria-label="Tilbake"
                        type="button"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>

                    <h1 className="text-lg font-semibold text-slate-900">Søk etter kokker</h1>

                    <div className="w-10" />
                </div>
            </div>

            {/* Content */}
            <div className="mx-auto max-w-xl px-4 py-6 space-y-4">
                {/* Toggle list */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="p-4">
                        {/* Tabs */}
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="relative inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                                <div
                                    className="absolute top-0 left-0 h-full w-1/3 rounded-full bg-white shadow-sm transition-transform duration-300"
                                    style={{
                                        transform:
                                            activeTab === 'friends'
                                                ? 'translateX(0%)'
                                                : activeTab === 'following'
                                                    ? 'translateX(100%)'
                                                    : 'translateX(200%)',
                                    }}
                                />

                                <button
                                    type="button"
                                    onClick={() => setActiveTab('friends')}
                                    className={`relative px-4 py-1 text-sm font-medium focus:outline-none ${
                                        activeTab === 'friends' ? 'text-slate-900' : 'text-slate-500'
                                    }`}
                                >
                                    Venner
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveTab('following')}
                                    className={`relative px-4 py-1 text-sm font-medium focus:outline-none ${
                                        activeTab === 'following' ? 'text-slate-900' : 'text-slate-500'
                                    }`}
                                >
                                    Følger
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveTab('followers')}
                                    className={`relative px-4 py-1 text-sm font-medium focus:outline-none ${
                                        activeTab === 'followers' ? 'text-slate-900' : 'text-slate-500'
                                    }`}
                                >
                                    Følgere
                                </button>
                            </div>

                            {/* Counts */}
                            <div className="text-sm text-slate-500">{activeCount}</div>
                        </div>

                        {/* List */}
                        {loadingTopList ? (
                            <p className="text-slate-600">Laster…</p>
                        ) : topList.length === 0 ? (
                            <p className="text-slate-600">
                                {activeTab === 'friends'
                                    ? 'Ingen venner enda (må følge hverandre).'
                                    : activeTab === 'following'
                                        ? 'Du følger ingen enda.'
                                        : 'Ingen følger deg enda.'}
                            </p>
                        ) : (
                            <div className="max-h-[40vh] overflow-y-auto">
                                {topList.map((u) => (
                                    <TopRow key={`${activeTab}-${u.uid}`} u={u} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Search input */}
                <input
                    type="text"
                    placeholder="Søk etter navn..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                />

                {/* Search results */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="p-4">
                        {loadingSearch ? (
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
                                        <button
                                            type="button"
                                            onClick={() => router.push(`/user/${u.uid}`)}
                                            className="flex items-center gap-3 text-left"
                                        >
                                            <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-100 shrink-0">
                                                {u.photoURL ? (
                                                    <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full grid place-items-center text-slate-500">🧑‍🍳</div>
                                                )}
                                            </div>
                                            <span className="text-slate-900 font-medium">{u.name}</span>
                                        </button>

                                        {uid === u.uid ? (
                                            <span className="text-sm text-slate-500">Deg</span>
                                        ) : (
                                            <FollowButton targetUid={u.uid} />
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