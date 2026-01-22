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

    const save = async () => {
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

            onClose();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-4 relative">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-3 right-3 h-9 w-9 rounded-full hover:bg-slate-100 grid place-items-center"
                    aria-label="Lukk"
                >
                    <span className="material-symbols-outlined text-slate-600">close</span>
                </button>

                <h2 className="text-xl font-semibold text-slate-900">Rediger profil</h2>
                <p className="text-sm text-slate-600 mt-1">Oppdater bio, favorittmat og profilbilde.</p>

                <div className="mt-4 flex items-center gap-3">
                    <div className="h-16 w-16 rounded-full overflow-hidden border border-slate-200 bg-slate-50">
                        {photoPreview ? (
                            <img src={photoPreview} alt="Profilbilde" className="w-full h-full object-cover" />
                        ) : null}
                    </div>

                    <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{initialName}</p>
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
                        onClick={onClose}
                        className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 font-semibold"
                        disabled={busy}
                    >
                        Avbryt
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        className="px-4 py-2 rounded-full bg-cyan-100 font-semibold hover:opacity-95 disabled:opacity-50"
                        disabled={busy}
                    >
                        {busy ? 'Lagrer…' : 'Lagre'}
                    </button>
                </div>
            </div>
        </div>
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
            <div className="md:flex justify-between items-center p-4 rounded-2xl border border-cyan-100 bg-cyan-100">
                <div className="flex items-center">
                    {photoURL ? (
                        <img src={photoURL} alt="User Avatar" className="w-24 h-24 md:h-40 md:w-40 rounded-2xl mr-4 object-cover" />
                    ) : (
                        <div className="h-16 w-16 rounded-full mr-4 bg-slate-100" />
                    )}

                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-semibold ">{name}</h1>

                            {isOwner && (
                                <button
                                    type="button"
                                    onClick={() => setShowEditProfile(true)}
                                    className="h-10 w-10 rounded-full hover:bg-slate-100 grid place-items-center"
                                    aria-label="Rediger profil"
                                    title="Rediger profil"
                                >
                                    <span className="material-symbols-outlined text-slate-700">edit</span>
                                </button>
                            )}
                        </div>

                        <p className="text-sm ">{followerCount} følgere</p>

                        {(favoriteFood || bio) && (
                            <div className="mt-2 space-y-1">
                                {favoriteFood ? (
                                    <p className="text-sm text-slate-700">
                                        <span className="font-semibold">Favorittmat:</span> {favoriteFood}
                                    </p>
                                ) : null}
                                {bio ? <p className="text-sm text-slate-700">{bio}</p> : null}
                            </div>
                        )}
                    </div>
                </div>

                {isOwner && (
                    <button onClick={logout} className="!bg-neutral-50 mt-4 md:mt-0 px-4 py-2 rounded-full ">
                        Logg ut
                    </button>
                )}

                {!isOwner && auth.currentUser && (
                    <button
                        onClick={async () => {
                            const meRef = doc(firestore, 'users', auth.currentUser!.uid);
                            await updateDoc(meRef, {
                                following: isFollowing ? arrayRemove(id) : arrayUnion(id),
                            });
                            setIsFollowing(!isFollowing);
                        }}
                        className="mt-4 md:mt-0 bg-white py-2 px-4 rounded-full"
                    >
                        {isFollowing ? 'Slutt å følge' : 'Følg'}
                    </button>
                )}
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
                <div className="fixed inset-0 bg-slate-900/30 flex justify-center items-center z-50">
                    <div className="p-6 rounded-2xl max-w-sm w-full bg-white border border-slate-200 shadow-xl">
                        <h1 className="text-2xl font-semibold mb-4 text-slate-900">Vil du slette denne oppskriften?</h1>
                        <p className="text-slate-600">Var den ikke noe god?</p>
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => {
                                    setShowConfirm(false);
                                    setPendingDeleteId(null);
                                }}
                                className="confirm-button px-4 py-2 rounded-full"
                            >
                                Avbryt
                            </button>
                            <button
                                onClick={async () => {
                                    await deleteDoc(doc(firestore, 'recipes', pendingDeleteId));
                                    setShowConfirm(false);
                                    setPendingDeleteId(null);
                                }}
                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full"
                            >
                                Slett
                            </button>
                        </div>
                    </div>
                </div>
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