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
    const [followingReady, setFollowingReady] = useState(false);

    const [activeTab, setActiveTab] = useState<FriendsTab>('friends');

    const [friendsList, setFriendsList] = useState<UserSearchResult[]>([]);
    const [followingList, setFollowingList] = useState<UserSearchResult[]>([]);
    const [followersList, setFollowersList] = useState<UserSearchResult[]>([]);
    const [loadingTopList, setLoadingTopList] = useState(true);

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
            if (!uid) {
                setCurrentFollowing([]);
                setFollowingReady(false);
                return;
            }

            setFollowingReady(false);

            try {
                const meRef = doc(firestore, 'users', uid);
                const snap = await getDoc(meRef);

                if (!snap.exists()) {
                    setCurrentFollowing([]);
                    return;
                }

                const data = snap.data() as UserData;
                setCurrentFollowing(data.following ?? []);
            } finally {
                setFollowingReady(true);
            }
        };

        void fetchMyFollowing();
    }, [uid]);

    // Bygg topp-lister (friends/following/followers)
    useEffect(() => {
        const buildLists = async () => {
            if (!uid || !followingReady) return;

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

        void buildLists();
    }, [uid, currentFollowing, followingReady]);

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

        void fetchUsers();
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

    if (!authReady) {
        return (
            <div className="flex min-h-screen items-center justify-center px-4">
                <div className="flex flex-col items-center gap-4 text-slate-600">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent-soft)] border-t-[var(--accent)]" />
                    <p className="text-sm font-medium">Laster venner…</p>
                </div>
            </div>
        );
    }
    if (!currentUser) return null;

    const FollowButton = ({ targetUid }: { targetUid: string }) => {
        const isFollowing = currentFollowing.includes(targetUid);

        return (
            <button
                type="button"
                onClick={() => handleFollow(targetUid)}
                className={[
                    'rounded-full px-4 py-2 text-sm font-semibold transition',
                    isFollowing
                        ? 'border border-[#d9dfcf] bg-[#f5f3e8] text-[#496444] hover:bg-[#eeebdc]'
                        : 'bg-[var(--accent-strong)] text-[#12340d] hover:bg-[var(--accent)]',
                ].join(' ')}
                aria-label={isFollowing ? 'Slutt å følge' : 'Følg'}
            >
                {isFollowing ? 'Slutt å følge' : 'Følg'}
            </button>
        );
    };

    const TopRow = ({ u }: { u: UserSearchResult }) => (
        <div className="flex items-center justify-between border-b border-[#ece8da] py-3 last:border-b-0">
            <button
                type="button"
                onClick={() => router.push(`/user/${u.uid}`)}
                className="flex items-center gap-3 text-left"
            >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#eef3e4]">
                    {u.photoURL ? (
                        <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="grid h-full w-full place-items-center text-[#6c8765]">🧑‍🍳</div>
                    )}
                </div>
                <span className="font-medium text-[#12340d]">{u.name}</span>
            </button>

            {uid === u.uid ? <span className="text-sm text-[#6c8765]">Deg</span> : <FollowButton targetUid={u.uid} />}
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
    const topListPending = !followingReady || loadingTopList;

    return (
        <div className="min-h-screen pb-24">
            <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
               

                <div className="rounded-xl border border-[#e4e1d3] bg-white/95 shadow-sm">
                    <div className="p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="relative inline-flex w-full max-w-md rounded-full border border-slate-200 bg-slate-100/70 p-1 shadow-inner">
                                <div
                                    className="absolute top-1 left-1 h-[calc(100%-0.5rem)] rounded-full bg-white shadow-sm ring-1 ring-slate-100 transition-transform duration-300 ease-out"
                                    style={{
                                        width: 'calc((100% - 0.5rem) / 3)',
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
                                    className={`relative z-10 flex-1 py-2 text-sm font-semibold transition-colors focus:outline-none ${
                                        activeTab === 'friends' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Venner
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveTab('following')}
                                    className={`relative z-10 flex-1 py-2 text-sm font-semibold transition-colors focus:outline-none ${
                                        activeTab === 'following' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Følger
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveTab('followers')}
                                    className={`relative z-10 flex-1 py-2 text-sm font-semibold transition-colors focus:outline-none ${
                                        activeTab === 'followers' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Følgere
                                </button>
                            </div>

                            <div className="rounded-full bg-[#f5f3e8] px-3 py-1 text-sm font-semibold text-[#496444]">
                                {activeCount}
                            </div>
                        </div>

                        {topListPending ? (
                            <div className="flex min-h-[220px] items-center justify-center">
                                <div className="flex flex-col items-center gap-4 text-slate-600">
                                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent-soft)] border-t-[var(--accent)]" />
                                    <p className="text-sm font-medium">Laster venner…</p>
                                </div>
                            </div>
                        ) : topList.length === 0 ? (
                            <div className="rounded-xl bg-[#f8f6ed] p-5 text-center text-[#496444]">
                                <p className="font-medium">
                                    {activeTab === 'friends'
                                        ? 'Ingen venner enda.'
                                        : activeTab === 'following'
                                            ? 'Du følger ingen enda.'
                                            : 'Ingen følger deg enda.'}
                                </p>
                                <p className="mt-2 text-sm text-[#6c8765]">
                                    {activeTab === 'friends'
                                        ? 'Når dere følger hverandre, dukker de opp her.'
                                        : activeTab === 'following'
                                            ? 'Søk etter noen under for å komme i gang.'
                                            : 'Del profilen din for å få flere følgere.'}
                                </p>
                            </div>
                        ) : (
                            <div className="max-h-[40vh] overflow-y-auto">
                                {topList.map((u) => (
                                    <TopRow key={`${activeTab}-${u.uid}`} u={u} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border border-[#e4e1d3] bg-white/95 shadow-sm">
                    <div className="p-4">
                        <label className="mb-4 block">
                            <span className="mb-2 block text-sm font-semibold text-[#12340d]">Søk etter kokker</span>
                            <input
                                type="text"
                                placeholder="Søk etter navn..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-xl border border-[#d9dfcf] bg-[#fbfaf4] px-4 py-3 text-[#12340d] placeholder:text-[#6c8765] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                            />
                        </label>

                        {loadingSearch ? (
                            <div className="flex min-h-[220px] items-center justify-center">
                                <div className="flex flex-col items-center gap-4 text-slate-600">
                                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent-soft)] border-t-[var(--accent)]" />
                                    <p className="text-sm font-medium">Leter etter kokker…</p>
                                </div>
                            </div>
                        ) : trimmed.length < 3 ? (
                            <div className="rounded-xl bg-[#f8f6ed] p-5 text-center text-sm text-[#496444]">
                                Skriv minst tre bokstaver for å søke etter venner.
                            </div>
                        ) : results.length === 0 ? (
                            <div className="rounded-xl bg-[#f8f6ed] p-5 text-center text-sm text-[#496444]">
                                Ingen kokker funnet.
                            </div>
                        ) : (
                            <div className="max-h-[60vh] overflow-y-auto">
                                {results.map((u) => (
                                    <div
                                        key={u.uid}
                                        className="flex items-center justify-between border-b border-[#ece8da] py-3 last:border-b-0"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => router.push(`/user/${u.uid}`)}
                                            className="flex items-center gap-3 text-left"
                                        >
                                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#eef3e4]">
                                                {u.photoURL ? (
                                                    <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="grid h-full w-full place-items-center text-[#6c8765]">🧑‍🍳</div>
                                                )}
                                            </div>
                                            <span className="font-medium text-[#12340d]">{u.name}</span>
                                        </button>

                                        {uid === u.uid ? (
                                            <span className="text-sm text-[#6c8765]">Deg</span>
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
