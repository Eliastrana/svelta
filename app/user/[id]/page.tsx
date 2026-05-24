'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    collection,
    deleteDoc,
    getDocs,
} from 'firebase/firestore';
import { auth, firestore, storage } from '@/firebase';
import { signOut, User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useQuery } from '@tanstack/react-query';

import { useUserRecipes } from '@/hooks/useUserRecipes';
import RecipeCard from '@/app/components/RecipeCard';
import { useUserLikedRecipes } from '@/hooks/useLikedRecipes';
import AppModal from '@/app/components/AppModal';
import CollectionCard from '@/app/components/CollectionCard';
import { CollectionDoc, fetchPublicCollections } from '@/helpers/collectionHelpers';
import { useCollectionSummaries } from '@/hooks/collections/useCollectionSummaries';

interface UserData {
    name?: string;
    following?: string[];
    photoURL?: string;
    backgroundPhotoURL?: string;
    bio?: string;
    favoriteFood?: string;
}

interface ProfileListUser {
    userId: string;
    name?: string;
    photoURL?: string;
}

const FollowersModal: React.FC<{
    profileUserId: string;
    profileName?: string;
    onClose: () => void;
}> = ({ profileUserId, profileName, onClose }) => {
    const [followers, setFollowers] = useState<ProfileListUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const fetchFollowers = async () => {
            setLoading(true);
            try {
                const usersSnap = await getDocs(collection(firestore, 'users'));

                const results: ProfileListUser[] = usersSnap.docs
                    .filter((d) => {
                        const data = d.data() as UserData;
                        return Array.isArray(data.following) && data.following.includes(profileUserId);
                    })
                    .map((d) => {
                        const data = d.data() as UserData;
                        return {
                            userId: d.id,
                            name: data.name,
                            photoURL: data.photoURL,
                        };
                    });

                results.sort((a, b) => {
                    const an = (a.name || a.userId).toLowerCase();
                    const bn = (b.name || b.userId).toLowerCase();
                    return an.localeCompare(bn);
                });

                if (!cancelled) setFollowers(results);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void fetchFollowers();

        return () => {
            cancelled = true;
        };
    }, [profileUserId]);

    return (
        <AppModal onClose={onClose}>
            {({ closeWithAnim, closing }) => (
                <>
                    {/* header */}
                    <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
                        <div>
                            <h3 className="text-lg font-semibold tracking-tight text-slate-900">Følgere</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {profileName ? `Folk som følger ${profileName}.` : 'Folk som følger denne brukeren.'}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={closeWithAnim}
                            disabled={closing}
                            className="h-10 w-10 grid place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition active:scale-90"
                            aria-label="Lukk"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* content */}
                    <div className="p-5">
                        {loading ? (
                            <div className="space-y-2.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div
                                        key={`sk-${i}`}
                                        className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3"
                                    >
                                        <div className="h-11 w-11 rounded-full bg-slate-200 animate-pulse" />
                                        <div className="flex-1">
                                            <div className="h-4 w-32 rounded-full bg-slate-200 animate-pulse" />
                                            <div className="h-3 w-24 rounded-full bg-slate-100 mt-2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : followers.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)] text-2xl">
                                    👨‍🍳
                                </div>
                                <p className="text-slate-800 font-semibold">Ingen følgere enda.</p>
                                <p className="text-sm text-slate-500 mt-1">Vær den første til å følge</p>
                            </div>
                        ) : (
                            <ul className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1 -mr-1">
                                {followers.map((u) => (
                                    <li key={u.userId}>
                                        <Link
                                            href={`/user/${u.userId}`}
                                            onClick={() => closeWithAnim()}
                                            className="group flex items-center gap-3 rounded-2xl border border-transparent p-2.5 transition hover:border-slate-100 hover:bg-slate-50 active:scale-[0.99]"
                                        >
                                            <div className="h-11 w-11 rounded-full overflow-hidden bg-[var(--accent-soft)] shrink-0 ring-1 ring-slate-100">
                                                {u.photoURL ? (
                                                    <img
                                                        src={u.photoURL}
                                                        alt={u.name || 'User'}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full grid place-items-center text-slate-500">
                                                        🧑‍🍳
                                                    </div>
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-slate-900 truncate">
                                                    {u.name || 'Ukjent bruker'}
                                                </p>
                                            </div>

                                            <span className="material-symbols-outlined text-slate-300 text-[20px] shrink-0 transition group-hover:translate-x-0.5 group-hover:text-slate-500">
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
                            className="mt-5 w-full rounded-full py-2.5 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition active:scale-[0.99]"
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

// Ensure a Firestore doc exists for every signed-in user
const createUserDocumentIfNotExists = async (user: User) => {
    const userDocRef = doc(firestore, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
        await setDoc(userDocRef, {
            name: user.displayName || 'Unnamed User',
            following: [],
            photoURL: user.photoURL || '',
            backgroundPhotoURL: '',
            bio: '',
            favoriteFood: '',
        });
    }
};

// Run on every auth-state change to bootstrap user data
auth.onAuthStateChanged(async (user) => {
    if (user) {
        await createUserDocumentIfNotExists(user);
    }
});

const ProfileSkeleton: React.FC = () => {
    return (
        <div className="pb-24">
            <div className="relative h-[34vh] min-h-[220px] w-full overflow-hidden bg-[var(--accent-soft)]">
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/15" />
            </div>

            <div className="relative z-10 mx-auto -mt-16 max-w-5xl px-4 md:-mt-20 md:w-2/3">
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <div className="flex items-end gap-5 md:gap-8">
                        <div className="h-28 w-28 shrink-0 rounded-[28px] bg-white p-1.5 shadow-xl ring-1 ring-slate-200/70 md:h-40 md:w-40">
                            <div className="h-full w-full rounded-[22px] bg-slate-200/70 animate-pulse" />
                        </div>
                        <div className="space-y-3 pb-2">
                            <div className="h-9 w-52 rounded-2xl bg-slate-200/70 animate-pulse" />
                            <div className="h-7 w-32 rounded-full bg-slate-200/60 animate-pulse" />
                            <div className="h-4 w-64 rounded-full bg-slate-200/40 animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mx-auto mt-10 max-w-5xl px-4 md:w-2/3">
                <div className="h-12 w-full max-w-md rounded-full bg-slate-100 animate-pulse" />
            </div>

            <div className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-4 px-4 md:w-2/3 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={`sk-${i}`} className="animate-pulse">
                        <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
                            <div className="h-72 bg-slate-100" />
                        </div>

                        <div className="mt-4 space-y-2">
                            <div className="h-7 w-2/3 rounded-xl bg-slate-100" />
                            <div className="h-4 w-full rounded-full bg-slate-100" />
                            <div className="h-4 w-5/6 rounded-full bg-slate-100" />
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-10 w-10 rounded-full bg-slate-100" />
                                <div className="space-y-2">
                                    <div className="h-4 w-28 rounded-full bg-slate-100" />
                                    <div className="h-3 w-36 rounded-full bg-slate-100" />
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="h-5 w-12 rounded-full bg-slate-100" />
                                <div className="h-5 w-12 rounded-full bg-slate-100" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

type EditProfileModalProps = {
    open: boolean;
    onClose: () => void;
    initialName: string;
    initialBio: string;
    initialFavoriteFood: string;
    initialPhotoURL: string;
    initialBackgroundPhotoURL: string;
    uid: string;
    onSaved: (next: { bio: string; favoriteFood: string; photoURL: string; backgroundPhotoURL: string }) => void;
};

const EditProfileModal: React.FC<EditProfileModalProps> = ({
                                                               open,
                                                               onClose,
                                                               initialName,
                                                               initialBio,
                                                               initialFavoriteFood,
                                                               initialPhotoURL,
                                                               initialBackgroundPhotoURL,
                                                               uid,
                                                               onSaved,
                                                           }) => {
    const [bio, setBio] = useState(initialBio);
    const [favoriteFood, setFavoriteFood] = useState(initialFavoriteFood);

    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string>(initialPhotoURL);
    const [backgroundPhotoFile, setBackgroundPhotoFile] = useState<File | null>(null);
    const [backgroundPhotoPreview, setBackgroundPhotoPreview] = useState<string>(initialBackgroundPhotoURL);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // sync when modal opens with new initial values
    useEffect(() => {
        if (!open) return;
        setBio(initialBio);
        setFavoriteFood(initialFavoriteFood);
        setPhotoFile(null);
        setPhotoPreview(initialPhotoURL);
        setBackgroundPhotoFile(null);
        setBackgroundPhotoPreview(initialBackgroundPhotoURL);
        setError(null);
    }, [open, initialBio, initialFavoriteFood, initialPhotoURL, initialBackgroundPhotoURL]);

    useEffect(() => {
        return () => {
            if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
            if (backgroundPhotoPreview.startsWith('blob:')) URL.revokeObjectURL(backgroundPhotoPreview);
        };
    }, [photoPreview, backgroundPhotoPreview]);

    if (!open) return null;

    const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setPhotoFile(file);
        const url = URL.createObjectURL(file);
        setPhotoPreview(url);
    };

    const onPickBackgroundPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setBackgroundPhotoFile(file);
        const url = URL.createObjectURL(file);
        setBackgroundPhotoPreview(url);
    };

    const save = async (closeWithAnim: () => void) => {
        setBusy(true);
        setError(null);

        try {
            let nextPhotoURL = initialPhotoURL;
            let nextBackgroundPhotoURL = initialBackgroundPhotoURL;

            if (photoFile) {
                const imageRef = ref(storage, `profile-pictures/${uid}/${Date.now()}-${photoFile.name}`);
                const snap = await uploadBytes(imageRef, photoFile);
                nextPhotoURL = await getDownloadURL(snap.ref);
            }

            if (backgroundPhotoFile) {
                const imageRef = ref(storage, `profile-backgrounds/${uid}/${Date.now()}-${backgroundPhotoFile.name}`);
                const snap = await uploadBytes(imageRef, backgroundPhotoFile);
                nextBackgroundPhotoURL = await getDownloadURL(snap.ref);
            }

            const userRef = doc(firestore, 'users', uid);
            await updateDoc(userRef, {
                bio: bio.trim(),
                favoriteFood: favoriteFood.trim(),
                photoURL: nextPhotoURL,
                backgroundPhotoURL: nextBackgroundPhotoURL,
            });

            onSaved({
                bio: bio.trim(),
                favoriteFood: favoriteFood.trim(),
                photoURL: nextPhotoURL,
                backgroundPhotoURL: nextBackgroundPhotoURL,
            });

            closeWithAnim();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppModal onClose={onClose}>
            {({ closeWithAnim, closing }) => (
                <div className="w-full p-5 relative">
                    <button
                        type="button"
                        onClick={closeWithAnim}
                        className="absolute top-4 right-4 h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 grid place-items-center transition active:scale-90"
                        aria-label="Lukk"
                        disabled={closing}
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>

                    <h2 className="text-xl font-semibold tracking-tight text-slate-900">Rediger profil</h2>
                    <p className="text-sm text-slate-500 mt-1">Oppdater bio, favorittmat, profilbilde og bakgrunnsbilde.</p>


                    <div className="mt-5">
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Bakgrunnsbilde</label>
                        <label className="group block cursor-pointer overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 transition hover:border-slate-300">
                            <div className="relative h-40 w-full overflow-hidden bg-[var(--accent-soft)]">
                                {backgroundPhotoPreview ? (
                                    <img src={backgroundPhotoPreview} alt="Bakgrunnsbilde" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                                ) : (
                                    <div className="grid h-full w-full place-items-center text-slate-400">
                                        <span className="material-symbols-outlined text-4xl">photo_camera</span>
                                    </div>
                                )}
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
                            </div>
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-sm font-semibold text-slate-900">Bytt bakgrunnsbilde</span>
                                <span className="material-symbols-outlined text-slate-400 transition group-hover:text-slate-600">image</span>
                            </div>
                            <input type="file" accept="image/*" className="hidden" onChange={onPickBackgroundPhoto} />
                        </label>
                    </div>

                    <div className="mt-5 flex items-center gap-4">
                        <div className="h-16 w-16 shrink-0 rounded-2xl overflow-hidden border border-slate-200 bg-[var(--accent-soft)] shadow-sm">
                            {photoPreview ? (
                                <img src={photoPreview} alt="Profilbilde" className="w-full h-full object-cover" />
                            ) : (
                                <div className="grid h-full w-full place-items-center text-2xl text-slate-400">🧑‍🍳</div>
                            )}
                        </div>

                        <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-900">{initialName}</p>
                            <label className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 hover:bg-slate-200 transition active:scale-95 cursor-pointer w-fit">
                                <span className="material-symbols-outlined text-base">photo_camera</span>
                                <span className="text-sm font-semibold">Bytt bilde</span>
                                <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
                            </label>
                        </div>
                    </div>

                    <div className="mt-5">
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Favorittmat</label>
                        <input
                            value={favoriteFood}
                            onChange={(e) => setFavoriteFood(e.target.value)}
                            placeholder="f.eks. carbonara"
                            className="w-full p-3 rounded-2xl border border-slate-200 bg-slate-50/50 transition focus:bg-white focus:outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                        />
                    </div>

                    <div className="mt-4">
                        <label className="block text-sm font-semibold text-slate-900 mb-2">Bio</label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Skriv litt om deg selv..."
                            className="w-full min-h-[120px] p-3 rounded-2xl border border-slate-200 bg-slate-50/50 transition focus:bg-white focus:outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                        />
                    </div>

                    {error ? (
                        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 p-3">
                            <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>
                            <p className="text-red-600 text-sm">{error}</p>
                        </div>
                    ) : null}

                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={closeWithAnim}
                            className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 transition active:scale-95 cursor-pointer"
                            disabled={busy || closing}
                        >
                            Avbryt
                        </button>
                        <button
                            type="button"
                            onClick={() => void save(closeWithAnim)}
                            className="brown-button px-5 py-2.5 rounded-full font-semibold shadow-sm transition hover:opacity-95 active:scale-95 disabled:opacity-50"
                            disabled={busy || closing}
                        >
                            {busy ? 'Lagrer…' : 'Lagre'}
                        </button>
                    </div>
                </div>
            )}
        </AppModal>
    );
};

const UserProfile: React.FC = () => {
    const params = useParams();
    const router = useRouter();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const userRecipes = useUserRecipes(id || '');
    const userLikedRecipes = useUserLikedRecipes(id || '');

    const [activeTab, setActiveTab] = useState<'myRecipes' | 'likedRecipes' | 'publicCollections'>('myRecipes');
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    const [profileLoading, setProfileLoading] = useState(true);

    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showFollowersModal, setShowFollowersModal] = useState(false);

    const { data: publicCollections = [] } = useQuery<CollectionDoc[]>({
        queryKey: ['publicCollections', id],
        queryFn: () => fetchPublicCollections(id || ''),
        enabled: !!id,
        placeholderData: (prev) => prev ?? [],
    });
    const collectionSummaries = useCollectionSummaries(publicCollections);

    const logout = async () => {
        try {
            await signOut(auth);
            router.replace('/logout');
        } catch (err) {
            console.error('Error logging out:', err);
        }
    };

    useEffect(() => {
        if (!id) return;

        setProfileLoading(true);

        (async () => {
            try {
                const snap = await getDoc(doc(firestore, 'users', id));
                if (snap.exists()) setUserData(snap.data() as UserData);
                else setUserData(null);

                if (auth.currentUser) {
                    const meSnap = await getDoc(doc(firestore, 'users', auth.currentUser.uid));
                    const following: string[] = meSnap.exists()
                        ? ((meSnap.data() as UserData).following || [])
                        : [];
                    setIsFollowing(following.includes(id));
                }
            } finally {
                setProfileLoading(false);
            }
        })();
    }, [id]);

    useEffect(() => {
        if (!id) return;
        (async () => {
            const all = await getDocs(collection(firestore, 'users'));
            setFollowerCount(
                all.docs.filter((d) => Array.isArray(d.data().following) && d.data().following.includes(id)).length,
            );
        })();
    }, [id]);

    if (!id) return <div className="p-4">No user id provided.</div>;
    if (profileLoading) return <ProfileSkeleton />;
    if (!userData) return <div className="p-4">Fant ikke bruker.</div>;

    const isOwner = auth.currentUser?.uid === id;
    const displayedRecipes = activeTab === 'myRecipes' ? userRecipes : userLikedRecipes;

    const name = userData.name || 'User Profile';
    const photoURL = userData.photoURL || '';
    const backgroundPhotoURL = userData.backgroundPhotoURL || '';
    const bio = userData.bio || '';
    const favoriteFood = userData.favoriteFood || '';
    const tabs: Array<{ key: 'myRecipes' | 'likedRecipes' | 'publicCollections'; label: string }> = [
        { key: 'myRecipes', label: 'Oppskrifter' },
        { key: 'likedRecipes', label: 'Likte' },
        { key: 'publicCollections', label: 'Kokebøker' },
    ];
    const activeTabIndex = tabs.findIndex((tab) => tab.key === activeTab);

    return (
        <div className="pb-24">
            {/* Banner */}
            <div className="relative h-[34vh] min-h-[220px] w-full overflow-hidden bg-[var(--accent-soft)]">
                {backgroundPhotoURL ? (
                    <img src={backgroundPhotoURL} alt={`${name} bakgrunnsbilde`} className="absolute inset-0 h-full w-full scale-105 object-cover" />
                ) : (
                    <div className="absolute inset-0 h-full w-full bg-[var(--accent)]" />
                )}
                {/* layered depth: soft vignette */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/25" />
                <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            </div>

            {/* Profile card — below the banner, solid background, avatar overlaps up */}
            <div className="relative z-10 mx-auto -mt-16 max-w-5xl px-4 md:-mt-20 md:w-2/3">
                <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <div className="md:flex md:items-end md:justify-between md:gap-10">
                        <div className="flex items-start md:items-end gap-5 md:gap-8">
                            <div className="relative shrink-0">
                                <div className="h-28 w-28 rounded-[28px] bg-white p-1.5 shadow-sm ring-1 ring-slate-200/70 md:h-40 md:w-40">
                                    <div className="h-full w-full overflow-hidden rounded-[22px] bg-[var(--accent-soft)]">
                                        {photoURL ? (
                                            <img src={photoURL} alt="User Avatar" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="grid h-full w-full place-items-center text-4xl text-slate-400">
                                                🧑‍🍳
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="min-w-0 pt-2 md:pb-2">
                                <div className="flex items-center gap-3">
                                    <h1 className="truncate text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                                        {name}
                                    </h1>

                                    {isOwner ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowEditProfile(true)}
                                            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 hover:rotate-12 active:scale-90"
                                            aria-label="Rediger profil"
                                            title="Rediger profil"
                                        >
                                            <span className="material-symbols-outlined">edit</span>
                                        </button>
                                    ) : null}
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600 md:text-base">
                                    <button
                                        type="button"
                                        onClick={() => setShowFollowersModal(true)}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 transition hover:border-slate-300 hover:bg-slate-100 active:scale-95"
                                        aria-label="Se følgere"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">group</span>
                                        <span>
                                            <span className="font-semibold text-slate-900">{followerCount}</span> følgere
                                        </span>
                                    </button>

                                    {favoriteFood ? (
                                        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                            <span className="material-symbols-outlined text-[20px]">restaurant</span>
                                            <span className="truncate">
                                                <span className="font-semibold text-slate-900">Favorittmat:</span> {favoriteFood}
                                            </span>
                                        </span>
                                    ) : null}
                                </div>

                                {bio ? (
                                    <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
                                        {bio}
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        <div className="mt-6 flex items-center gap-3 md:mt-0 md:justify-end md:pb-2 shrink-0">
                            {isOwner ? (
                                <button
                                    onClick={logout}
                                    className="rounded-full px-6 py-3 text-base font-semibold brown-button shadow-md hover:opacity-95 active:scale-95 transition"
                                >
                                    Logg ut
                                </button>
                            ) : auth.currentUser ? (
                                <button
                                    onClick={async () => {
                                        const meRef = doc(firestore, 'users', auth.currentUser!.uid);
                                        await updateDoc(meRef, {
                                            following: isFollowing ? arrayRemove(id) : arrayUnion(id),
                                        });

                                        setIsFollowing((prev) => !prev);
                                        setFollowerCount((prev) => prev + (isFollowing ? -1 : 1));
                                    }}
                                    className={[
                                        'inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold shadow-md transition active:scale-95',
                                        isFollowing
                                            ? 'border border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100'
                                            : 'brown-button hover:opacity-95',
                                    ].join(' ')}
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {isFollowing ? 'check' : 'add'}
                                    </span>
                                    {isFollowing ? 'Følger' : 'Følg'}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="mx-auto mt-10 max-w-5xl px-4 md:w-2/3">
                <div className="relative inline-flex w-full max-w-md rounded-full border border-slate-200 bg-slate-100/70 p-1 shadow-inner">
                    <div
                        className="absolute top-1 left-1 h-[calc(100%-0.5rem)] rounded-full bg-white shadow-sm ring-1 ring-slate-100 transition-transform duration-300 ease-out"
                        style={{
                            width: `calc((100% - 0.5rem) / ${tabs.length})`,
                            transform: `translateX(${activeTabIndex * 100}%)`,
                        }}
                    />

                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`relative z-10 flex-1 py-2 text-sm font-semibold transition-colors focus:outline-none flex items-center justify-center ${
                                activeTab === tab.key ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                            }`}
                            type="button"
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'publicCollections' ? (
                <div className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-4 px-4 md:w-2/3 md:grid-cols-2">
                    {publicCollections.length === 0 ? (
                        <div className="rounded-3xl  p-8 text-center md:col-span-2">
                            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-[var(--accent-soft)] text-3xl">
                                📖
                            </div>
                            <p className="text-slate-600">Ingen offentlige kokebøker enda.</p>
                            {isOwner ? (
                                <button
                                    onClick={() => router.push('/collections')}
                                    className="confirm-button py-2.5 px-5 rounded-full mt-4 shadow-sm transition active:scale-95"
                                >
                                    Gå til kokebøker
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        publicCollections.map((collection) => (
                            <CollectionCard
                                key={collection.id}
                                href={`/collections/${collection.id}?owner=${id}`}
                                name={collection.name}
                                description={collection.description}
                                previewImage={collection.coverImage?.trim() || collectionSummaries[collection.id]?.previewImage || ''}
                                recipeCount={collectionSummaries[collection.id]?.recipeCount ?? 0}
                            />
                        ))
                    )}
                </div>
            ) : (
                <div className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-4 px-4 md:w-2/3 md:grid-cols-2">
                    {displayedRecipes.length === 0 ? (
                        <div className="rounded-3xl  p-8 text-center md:col-span-2">
                            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-[var(--accent-soft)] text-3xl">
                                🍳
                            </div>
                            <p className="text-slate-600">Ingen oppskrifter funnet.</p>
                            {isOwner && activeTab === 'myRecipes' && (
                                <button
                                    onClick={() => router.push('/create-recipe')}
                                    className="confirm-button py-2.5 px-5 rounded-full mt-4 shadow-sm transition active:scale-95"
                                >
                                    Lag ny oppskrift
                                </button>
                            )}
                        </div>
                    ) : (
                        displayedRecipes.map((recipe) => (
                            <RecipeCard
                                key={recipe.id}
                                recipe={recipe}
                                isOwner={isOwner && activeTab === 'myRecipes'}
                                creator={activeTab === 'myRecipes' ? userData : recipe.creator}
                                onDelete={(rid) => {
                                    setPendingDeleteId(rid);
                                    setShowConfirm(true);
                                }}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Followers modal */}
            {showFollowersModal && (
                <FollowersModal
                    profileUserId={id}
                    profileName={name}
                    onClose={() => setShowFollowersModal(false)}
                />
            )}

            {/* Delete confirmation */}
            {showConfirm && pendingDeleteId && (
                <AppModal
                    onClose={() => {
                        setShowConfirm(false);
                        setPendingDeleteId(null);
                    }}
                >
                    {({ closeWithAnim, closing }) => (
                        <div className="p-6">
                            <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
                                <span className="material-symbols-outlined">delete</span>
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight mb-2 text-slate-900">
                                Vil du slette denne oppskriften?
                            </h1>
                            <p className="text-slate-500">Var den ikke noe god?</p>
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => {
                                        closeWithAnim();
                                    }}
                                    className="px-5 py-2.5 rounded-full font-semibold text-slate-700 hover:bg-slate-100 transition active:scale-95 cursor-pointer"
                                    disabled={closing}
                                >
                                    Avbryt
                                </button>
                                <button
                                    onClick={async () => {
                                        await deleteDoc(doc(firestore, 'recipes', pendingDeleteId));
                                        closeWithAnim();
                                    }}
                                    className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-full font-semibold shadow-sm transition active:scale-95 cursor-pointer"
                                    disabled={closing}
                                >
                                    Slett
                                </button>
                            </div>
                        </div>
                    )}
                </AppModal>
            )}

            {/* Edit profile modal */}
            {isOwner && (
                <EditProfileModal
                    open={showEditProfile}
                    onClose={() => setShowEditProfile(false)}
                    initialName={name}
                    initialBio={bio}
                    initialFavoriteFood={favoriteFood}
                    initialPhotoURL={photoURL}
                    initialBackgroundPhotoURL={backgroundPhotoURL}
                    uid={id}
                    onSaved={(next) => {
                        setUserData((prev) =>
                            prev
                                ? {
                                    ...prev,
                                    bio: next.bio,
                                    favoriteFood: next.favoriteFood,
                                    photoURL: next.photoURL,
                                    backgroundPhotoURL: next.backgroundPhotoURL,
                                }
                                : prev,
                        );
                    }}
                />
            )}
        </div>
    );
};

export default UserProfile;