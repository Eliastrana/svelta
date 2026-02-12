'use client';

import React, { useEffect, useState } from 'react';
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

import { useUserRecipes } from '@/hooks/useUserRecipes';
import RecipeCard from '@/app/components/RecipeCard';
import { useUserLikedRecipes } from '@/hooks/useLikedRecipes';
import AppModal from '@/app/components/AppModal';

interface UserData {
    name?: string;
    following?: string[];
    photoURL?: string;
    bio?: string;
    favoriteFood?: string;
}

// Ensure a Firestore doc exists for every signed-in user
const createUserDocumentIfNotExists = async (user: User) => {
    const userDocRef = doc(firestore, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
        await setDoc(userDocRef, {
            name: user.displayName || 'Unnamed User',
            following: [],
            photoURL: user.photoURL || '',
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
        <div className="p-4 md:max-w-5xl md:w-2/3 md:mx-auto md:mb-24">
            <div className="md:flex justify-between items-center">
                <div className="flex items-center">
                    <div className="h-16 w-16 rounded-full bg-slate-100 mr-4" />
                    <div className="space-y-2">
                        <div className="h-7 w-48 rounded-xl bg-slate-100" />
                        <div className="h-4 w-24 rounded-xl bg-slate-100" />
                    </div>
                </div>

                <div className="mt-4 md:mt-0 h-10 w-28 rounded-full bg-slate-100" />
            </div>

            <div className="mt-6 rounded-full bg-slate-100 h-10 w-full max-w-sm" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={`sk-${i}`} className="animate-pulse">
                        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
                            <div className="h-72 bg-slate-100" />
                        </div>

                        <div className="mt-4 space-y-2">
                            <div className="h-7 w-2/3 rounded-xl bg-slate-100" />
                            <div className="h-4 w-full rounded-xl bg-slate-100" />
                            <div className="h-4 w-5/6 rounded-xl bg-slate-100" />
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-10 w-10 rounded-full bg-slate-100" />
                                <div className="space-y-2">
                                    <div className="h-4 w-28 rounded-xl bg-slate-100" />
                                    <div className="h-3 w-36 rounded-xl bg-slate-100" />
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="h-5 w-12 rounded-xl bg-slate-100" />
                                <div className="h-5 w-12 rounded-xl bg-slate-100" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="h-24" />
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
    uid: string;
    onSaved: (next: { bio: string; favoriteFood: string; photoURL: string }) => void;
};

const EditProfileModal: React.FC<EditProfileModalProps> = ({
                                                               open,
                                                               onClose,
                                                               initialName,
                                                               initialBio,
                                                               initialFavoriteFood,
                                                               initialPhotoURL,
                                                               uid,
                                                               onSaved,
                                                           }) => {
    const [bio, setBio] = useState(initialBio);
    const [favoriteFood, setFavoriteFood] = useState(initialFavoriteFood);

    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string>(initialPhotoURL);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // sync when modal opens with new initial values
    useEffect(() => {
        if (!open) return;
        setBio(initialBio);
        setFavoriteFood(initialFavoriteFood);
        setPhotoFile(null);
        setPhotoPreview(initialPhotoURL);
        setError(null);
    }, [open, initialBio, initialFavoriteFood, initialPhotoURL]);

    useEffect(() => {
        return () => {
            if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
        };
    }, [photoPreview]);

    if (!open) return null;

    const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setPhotoFile(file);
        const url = URL.createObjectURL(file);
        setPhotoPreview(url);
    };

    const save = async (closeWithAnim: () => void) => {
        setBusy(true);
        setError(null);

        try {
            let nextPhotoURL = initialPhotoURL;

            if (photoFile) {
                const imageRef = ref(storage, `profile-pictures/${uid}/${Date.now()}-${photoFile.name}`);
                const snap = await uploadBytes(imageRef, photoFile);
                nextPhotoURL = await getDownloadURL(snap.ref);
            }

            const userRef = doc(firestore, 'users', uid);
            await updateDoc(userRef, {
                bio: bio.trim(),
                favoriteFood: favoriteFood.trim(),
                photoURL: nextPhotoURL,
            });

            onSaved({
                bio: bio.trim(),
                favoriteFood: favoriteFood.trim(),
                photoURL: nextPhotoURL,
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
            <div className="w-full p-4 relative">
                <button
                    type="button"
                    onClick={closeWithAnim}
                    className="absolute top-3 right-3 h-9 w-9 rounded-full hover:bg-slate-100 grid place-items-center"
                    aria-label="Lukk"
                    disabled={closing}
                >
                    <span className="material-symbols-outlined ">close</span>
                </button>

                <h2 className="text-xl font-semibold ">Rediger profil</h2>
                <p className="text-sm  mt-1">Oppdater bio, favorittmat og profilbilde.</p>

                <div className="mt-4 flex items-center gap-3">
                    <div className="h-16 w-16 rounded-full overflow-hidden border border-slate-200 bg-slate-50">
                        {photoPreview ? (
                            <img src={photoPreview} alt="Profilbilde" className="w-full h-full object-cover" />
                        ) : null}
                    </div>

                    <div className="flex-1">
                        <p className="text-sm font-semibold ">{initialName}</p>
                        <label className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 hover:bg-slate-200 transition cursor-pointer w-fit">
                            <span className="material-symbols-outlined text-base">photo_camera</span>
                            <span className="text-sm font-semibold">Bytt bilde</span>
                            <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
                        </label>
                    </div>
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Favorittmat</label>
                    <input
                        value={favoriteFood}
                        onChange={(e) => setFavoriteFood(e.target.value)}
                        placeholder="f.eks. carbonara"
                        className="w-full p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Bio</label>
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Skriv litt om deg selv..."
                        className="w-full min-h-[120px] p-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                </div>

                {error ? <p className="text-red-600 text-sm mt-3">{error}</p> : null}

                <div className="mt-4 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={closeWithAnim}
                        className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 font-semibold cursor-pointer"
                        disabled={busy || closing}
                    >
                        Avbryt
                    </button>
                    <button
                        type="button"
                        onClick={() => void save(closeWithAnim)}
                        className=" brown-button px-4 py-2 rounded-full font-semibold hover:opacity-95 disabled:opacity-50"
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

    const [activeTab, setActiveTab] = useState<'myRecipes' | 'likedRecipes'>('myRecipes');
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    const [profileLoading, setProfileLoading] = useState(true);

    const [showEditProfile, setShowEditProfile] = useState(false);

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
    const bio = userData.bio || '';
    const favoriteFood = userData.favoriteFood || '';

    return (
        <div className="p-4 md:max-w-5xl md:w-2/3 md:mx-auto md:mb-24">
            {/* Header */}
            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white/70 backdrop-blur shadow-sm">
                {/* subtle background glow */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl opacity-70 bg-gradient-to-br from-[#d6b38a] via-[#e7d0b7] to-transparent" />
                    <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full blur-3xl opacity-70 bg-gradient-to-tr from-[#b88a63] via-[#e9d7c6] to-transparent" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(2,6,23,0.06)_100%)]" />
                </div>

                {/* ✅ Mobile cover image (full width) */}
                <div className="relative md:hidden">
                    <div className="h-72 w-full overflow-hidden">
                        {photoURL ? (
                            <img src={photoURL} alt="User Avatar" className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full bg-slate-100 grid place-items-center text-slate-500 text-3xl">
                                🧑‍🍳
                            </div>
                        )}
                    </div>

                    {/* soft fade at bottom for readability */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/35" />

                    {/* small “story-like” chip on mobile */}
                    <div className="absolute left-4 bottom-3 inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-3 py-1.5 border border-white/40 shadow-sm">
                        <span className="material-symbols-outlined text-[18px] ">group</span>
                        <span className="text-sm font-semibold text-slate-900">
        {followerCount} følgere
      </span>
                    </div>
                </div>

                <div className="relative p-5 md:p-6">
                    <div className="md:flex md:items-center md:justify-between md:gap-6">
                        {/* Left side */}
                        <div className="flex items-start md:items-center gap-4">
                            {/* ✅ Desktop avatar (unchanged style) */}
                            <div className="relative hidden md:block">
                                <div className="absolute inset-[-4px] rounded-2xl bg-gradient-to-br from-[#c89a6c] via-[#e7d0b7] to-[#9a6a45] opacity-80 blur-[0.2px]" />
                                <div className="relative h-36 w-36 rounded-2xl bg-white p-[2px] shadow-sm">
                                    <div className="h-full w-full overflow-hidden rounded-[14px] bg-slate-100">
                                        {photoURL ? (
                                            <img src={photoURL} alt="User Avatar" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full grid place-items-center text-slate-500 text-3xl">
                                                🧑‍🍳
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* text */}
                            <div className="min-w-0 w-full">
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl md:text-3xl font-semibold  truncate">
                                        {name}
                                    </h1>

                                    {isOwner && (
                                        <button
                                            type="button"
                                            onClick={() => setShowEditProfile(true)}
                                            className="h-10 w-10 rounded-full border border-slate-200 bg-white/70 hover:bg-white transition grid place-items-center shadow-sm active:scale-[0.98]"
                                            aria-label="Rediger profil"
                                            title="Rediger profil"
                                        >
                                            <span className="material-symbols-outlined  hover:cursor-pointer">edit</span>
                                        </button>
                                    )}
                                </div>

                                {/* ✅ On desktop show follower count here; on mobile it’s already on the cover */}
                                <div className="mt-1 hidden md:flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ">
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">group</span>
              <span className="font-medium">{followerCount}</span> følgere
            </span>

                                    {(favoriteFood || bio) ? <span className="text-slate-300">•</span> : null}

                                    {favoriteFood ? (
                                        <span className="inline-flex items-center gap-1 min-w-0">
                <span className="material-symbols-outlined text-[18px]">restaurant</span>
                <span className="truncate">
                  <span className="font-medium ">Favorittmat:</span>{' '}
                    {favoriteFood}
                </span>
              </span>
                                    ) : null}
                                </div>

                                {/* ✅ On mobile show favoriteFood under name */}
                                {favoriteFood ? (
                                    <p className="mt-1 md:hidden text-sm ">
                                        <span className="font-semibold ">Favorittmat:</span>{' '}
                                        {favoriteFood}
                                    </p>
                                ) : null}

                                {bio ? (
                                    <p className="mt-2 text-sm md:text-base  max-w-xl leading-relaxed">
                                        {bio}
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        {/* Right: actions */}
                        <div className="mt-4 md:mt-0 flex items-center gap-2 md:justify-end">
                            {isOwner ? (
                                <button
                                    onClick={logout}
                                    className="rounded-full px-5 py-2 font-semibold brown-button shadow-sm hover:opacity-95 active:scale-[0.99] transition"
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
                                        setIsFollowing(!isFollowing);
                                    }}
                                    className={[
                                        'rounded-full px-5 py-2 font-semibold shadow-sm transition active:scale-[0.99]',
                                        isFollowing
                                            ? 'bg-white border border-slate-200 text-slate-900 hover:bg-slate-50'
                                            : 'brown-button hover:opacity-95',
                                    ].join(' ')}
                                >
                                    {isFollowing ? 'Følger' : 'Følg'}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="relative inline-flex w-full max-w-sm rounded-full border border-slate-200 bg-slate-50 p-1 mt-6">
                <div
                    className="absolute top-0 left-0 h-full w-1/2 rounded-full bg-white shadow-sm transition-transform duration-300"
                    style={{ transform: activeTab === 'likedRecipes' ? 'translateX(100%)' : 'translateX(0)' }}
                />

                <button
                    onClick={() => setActiveTab('myRecipes')}
                    className={`relative w-1/2 py-1 text-sm font-medium focus:outline-none flex items-center justify-center ${
                        activeTab === 'myRecipes' ? 'text-slate-900' : 'text-slate-500'
                    }`}
                    type="button"
                >
                    Oppskrifter
                </button>

                <button
                    onClick={() => setActiveTab('likedRecipes')}
                    className={`relative w-1/2 py-1 text-sm font-medium focus:outline-none flex items-center justify-center ${
                        activeTab === 'likedRecipes' ? 'text-slate-900' : 'text-slate-500'
                    }`}
                    type="button"
                >
                    Likte
                </button>
            </div>

            {/* Recipe list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {displayedRecipes.length === 0 ? (
                    <div>
                        <p className="text-slate-600">Ingen oppskrifter funnet.</p>
                        {isOwner && activeTab === 'myRecipes' && (
                            <button
                                onClick={() => router.push('/create-recipe')}
                                className="confirm-button py-2 px-4 rounded-full mt-4"
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
                        <h1 className="text-2xl font-semibold mb-4 text-slate-900">Vil du slette denne oppskriften?</h1>
                        <p className="text-slate-600">Var den ikke noe god?</p>
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => {
                                    closeWithAnim();
                                }}
                                className=" px-4 py-2 rounded-full hover:bg-neutral-200 cursor-pointer"
                                disabled={closing}
                            >
                                Avbryt
                            </button>
                            <button
                                onClick={async () => {
                                    await deleteDoc(doc(firestore, 'recipes', pendingDeleteId));
                                    closeWithAnim();
                                }}
                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full cursor-pointer"
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
                    uid={id}
                    onSaved={(next) => {
                        setUserData((prev) =>
                            prev
                                ? { ...prev, bio: next.bio, favoriteFood: next.favoriteFood, photoURL: next.photoURL }
                                : prev,
                        );
                    }}
                />
            )}
        </div>
    );
};

export default UserProfile;
