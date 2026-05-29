'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    doc,
    getDoc,
    updateDoc,
    collection,
    deleteDoc,
    getDocs,
} from 'firebase/firestore';
import { auth, firestore, storage } from '@/firebase';
import { signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useQuery } from '@tanstack/react-query';

import { useUserRecipes } from '@/hooks/useUserRecipes';
import RecipeCard from '@/app/components/RecipeCard';
import { useUserLikedRecipes } from '@/hooks/useLikedRecipes';
import AppModal from '@/app/components/AppModal';
import CollectionCard from '@/app/components/CollectionCard';
import { CollectionDoc, fetchPublicCollections } from '@/helpers/collectionHelpers';
import { useCollectionSummaries } from '@/hooks/collections/useCollectionSummaries';
import { deleteUserAccountAndActivityWithOptions } from '@/helpers/deleteUserAccount';
import { ensureUserDocument } from '@/helpers/ensureUserDocument';
import { FollowState, getFollowState, toggleFollowAction } from '@/helpers/followRequests';
import { DEFAULT_PROFILE_THEME_ID, PROFILE_FONTS, PROFILE_THEMES, getProfileFont, getProfileTheme } from '@/helpers/profileAppearance';
import { syncPublicUserProfile } from '@/helpers/publicUserProfile';
import { filterVisibleRecipes } from '@/helpers/recipeVisibility';
import { useUserFollowing } from '@/hooks/useUserFollowing';

interface UserData {
    name?: string;
    following?: string[];
    incomingFollowRequests?: string[];
    outgoingFollowRequests?: string[];
    isProfilePrivate?: boolean;
    photoURL?: string;
    backgroundPhotoURL?: string;
    bio?: string;
    favoriteFood?: string;
    profileThemeId?: string;
    profileFontId?: string;
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

// Run on every auth-state change to bootstrap user data
auth.onAuthStateChanged(async (user) => {
    if (user) {
        await ensureUserDocument(user);
    }
});

const ProfileSkeleton: React.FC = () => {
    return (
        <div className="pb-24">
            <div className="relative h-[34vh] min-h-[220px] w-full overflow-hidden bg-[var(--accent-soft)]">
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/15" />
            </div>

            <div className="relative z-10 mx-auto -mt-16 max-w-5xl px-4 md:-mt-20 md:w-2/3">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[32px] sm:p-6 md:p-8">
                    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:gap-6 sm:text-left md:gap-8">
                        <div className="h-24 w-24 shrink-0 rounded-[24px] bg-white p-1.5 shadow-xl ring-1 ring-slate-200/70 sm:h-28 sm:w-28 sm:rounded-[28px] md:h-40 md:w-40">
                            <div className="h-full w-full rounded-[20px] bg-slate-200/70 animate-pulse sm:rounded-[22px]" />
                        </div>
                        <div className="w-full space-y-3 sm:pb-2">
                            <div className="mx-auto h-9 w-52 rounded-2xl bg-slate-200/70 animate-pulse sm:mx-0" />
                            <div className="mx-auto h-7 w-32 rounded-full bg-slate-200/60 animate-pulse sm:mx-0" />
                            <div className="mx-auto h-4 w-64 rounded-full bg-slate-200/40 animate-pulse sm:mx-0" />
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

type AppearanceModalProps = {
    open: boolean;
    onClose: () => void;
    themeId: string;
    fontId: string;
    onThemeChange: (themeId: string) => void;
    onFontChange: (fontId: string) => void;
};

const AppearanceModal: React.FC<AppearanceModalProps> = ({
    open,
    onClose,
    themeId,
    fontId,
    onThemeChange,
    onFontChange,
}) => {
    if (!open) return null;

    return (
        <AppModal onClose={onClose} panelClassName="max-h-[85vh] overflow-hidden">
            {({ closeWithAnim }) => (
                <div className="max-h-[85vh] overflow-y-auto p-5">
                    <h2 className="text-xl font-semibold tracking-tight text-slate-900">Rediger utseende</h2>
                    <p className="mt-1 text-sm text-slate-500">Velg et tema og en font for profilsiden din.</p>

                    <div className="mt-5">
                        <h3 className="text-sm font-semibold text-slate-900">Tema</h3>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {PROFILE_THEMES.map((theme) => (
                                <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => onThemeChange(theme.id)}
                                    className={[
                                        'overflow-hidden rounded-2xl border text-left transition',
                                        themeId === theme.id ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-300',
                                    ].join(' ')}
                                >
                                    <div className="h-20 w-full" style={{ backgroundColor: theme.main }} />
                                    <div className="p-3" style={{ backgroundColor: theme.soft, color: theme.text }}>
                                        <p className="font-semibold">{theme.label}</p>
                                        <p className="mt-1 text-xs">Mørkt kort, lys bakgrunn</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6">
                        <h3 className="text-sm font-semibold text-slate-900">Font</h3>
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {PROFILE_FONTS.map((font) => (
                                <button
                                    key={font.id}
                                    type="button"
                                    onClick={() => onFontChange(font.id)}
                                    className={[
                                        'rounded-2xl border px-4 py-3 text-left transition',
                                        fontId === font.id ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-300',
                                    ].join(' ')}
                                    style={{ fontFamily: font.family }}
                                >
                                    <p className="font-semibold">{font.label}</p>
                                    <p className="mt-1 text-sm text-slate-500">Svelta profilside</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={closeWithAnim}
                        className="mt-6 w-full rounded-full confirm-button py-2.5 font-semibold"
                    >
                        Ferdig
                    </button>
                </div>
            )}
        </AppModal>
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
    initialProfileThemeId: string;
    initialProfileFontId: string;
    initialIsProfilePrivate: boolean;
    uid: string;
    onSaved: (next: { bio: string; favoriteFood: string; photoURL: string; backgroundPhotoURL: string; profileThemeId: string; profileFontId: string; isProfilePrivate: boolean }) => void;
    onLogout: () => void;
};

const EditProfileModal: React.FC<EditProfileModalProps> = ({
                                                               open,
                                                               onClose,
                                                               initialName,
                                                               initialBio,
                                                               initialFavoriteFood,
                                                               initialPhotoURL,
                                                               initialBackgroundPhotoURL,
                                                               initialProfileThemeId,
                                                               initialProfileFontId,
                                                               initialIsProfilePrivate,
                                                               uid,
                                                           onSaved,
                                                           onLogout,
                                                           }) => {
    const router = useRouter();
    const [bio, setBio] = useState(initialBio);
    const [favoriteFood, setFavoriteFood] = useState(initialFavoriteFood);

    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string>(initialPhotoURL);
    const [backgroundPhotoFile, setBackgroundPhotoFile] = useState<File | null>(null);
    const [backgroundPhotoPreview, setBackgroundPhotoPreview] = useState<string>(initialBackgroundPhotoURL);
    const [profileThemeId, setProfileThemeId] = useState(initialProfileThemeId);
    const [profileFontId, setProfileFontId] = useState(initialProfileFontId);
    const [isProfilePrivate, setIsProfilePrivate] = useState(initialIsProfilePrivate);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [showAppearanceModal, setShowAppearanceModal] = useState(false);
    const currentUser = auth.currentUser;
    const requiresPasswordForDeletion = currentUser?.providerData.some((p) => p.providerId === 'password') ?? false;

    // sync when modal opens with new initial values
    useEffect(() => {
        if (!open) return;
        setBio(initialBio);
        setFavoriteFood(initialFavoriteFood);
        setPhotoFile(null);
        setPhotoPreview(initialPhotoURL);
        setBackgroundPhotoFile(null);
        setBackgroundPhotoPreview(initialBackgroundPhotoURL);
        setProfileThemeId(initialProfileThemeId);
        setProfileFontId(initialProfileFontId);
        setIsProfilePrivate(initialIsProfilePrivate);
        setError(null);
        setDeleteError(null);
        setDeleteConfirmText('');
        setDeletePassword('');
        setShowDeleteConfirm(false);
        setShowAppearanceModal(false);
        setDeletingAccount(false);
    }, [open, initialBio, initialFavoriteFood, initialPhotoURL, initialBackgroundPhotoURL, initialProfileThemeId, initialProfileFontId, initialIsProfilePrivate]);

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
                profileThemeId,
                profileFontId,
                isProfilePrivate,
            });

            await syncPublicUserProfile(uid, {
                name: initialName,
                photoURL: nextPhotoURL,
                favoriteFood: favoriteFood.trim(),
            });

            onSaved({
                bio: bio.trim(),
                favoriteFood: favoriteFood.trim(),
                photoURL: nextPhotoURL,
                backgroundPhotoURL: nextBackgroundPhotoURL,
                profileThemeId,
                profileFontId,
                isProfilePrivate,
            });

            closeWithAnim();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteAccount = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser || currentUser.uid !== uid) {
            setDeleteError('Du må være logget inn på kontoen du prøver å slette.');
            return;
        }

        if (deleteConfirmText.trim().toLowerCase() !== 'slett') {
            setDeleteError('Skriv "slett" for å bekrefte.');
            return;
        }

        try {
            setDeletingAccount(true);
            setDeleteError(null);
            await deleteUserAccountAndActivityWithOptions(currentUser, {
                password: requiresPasswordForDeletion ? deletePassword : undefined,
            });
            setShowDeleteConfirm(false);
            onClose();
            router.replace('/');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Kunne ikke slette kontoen.';
            setDeleteError(msg);
        } finally {
            setDeletingAccount(false);
        }
    };

    return (
        <>
            <AppModal onClose={onClose} panelClassName="max-h-[85vh] overflow-hidden">
                {({ closeWithAnim, closing }) => (
                    <div className="flex max-h-[85vh] w-full flex-col">
                        <div className="relative border-b border-slate-100 px-5 pb-4 pt-5">
                            <button
                                type="button"
                                onClick={closeWithAnim}
                                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90"
                                aria-label="Lukk"
                                disabled={closing || deletingAccount}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>

                            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Rediger profil</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Oppdater bio, favorittmat, profilbilde og bakgrunnsbilde.
                            </p>

                            <button
                                type="button"
                                onClick={onLogout}
                                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 font-semibold text-slate-800 transition hover:bg-slate-200 active:scale-95"
                                disabled={busy || closing || deletingAccount}
                            >
                                <span className="material-symbols-outlined text-[20px]">logout</span>
                                Logg ut
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-5">
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-900">Bakgrunnsbilde</label>
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
                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-[var(--accent-soft)] shadow-sm">
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="Profilbilde" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="grid h-full w-full place-items-center text-2xl text-slate-400">🧑‍🍳</div>
                                    )}
                                </div>

                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-slate-900">{initialName}</p>
                                    <label className="mt-2 inline-flex w-fit cursor-pointer items-center gap-2 rounded-full bg-slate-100 px-3 py-2 transition hover:bg-slate-200 active:scale-95">
                                        <span className="material-symbols-outlined text-base">photo_camera</span>
                                        <span className="text-sm font-semibold">Bytt bilde</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
                                    </label>
                                </div>
                            </div>

                            <div className="mt-5">
                                <label className="mb-2 block text-sm font-semibold text-slate-900">Favorittmat</label>
                                <input
                                    value={favoriteFood}
                                    onChange={(e) => setFavoriteFood(e.target.value)}
                                    placeholder="f.eks. carbonara"
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-3 transition focus:border-[var(--accent)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--accent-soft)]"
                                />
                            </div>

                            <div className="mt-4">
                                <label className="mb-2 block text-sm font-semibold text-slate-900">Bio</label>
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    placeholder="Skriv litt om deg selv..."
                                    className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-3 transition focus:border-[var(--accent)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--accent-soft)]"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowAppearanceModal(true)}
                                className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 font-semibold text-slate-800 transition hover:bg-slate-200 active:scale-95"
                                disabled={busy || closing || deletingAccount}
                            >
                                <span className="material-symbols-outlined text-[18px]">palette</span>
                                Rediger utseende
                            </button>

                            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                <label className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Privat profil</p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Nye følgere må godkjennes før de kan følge deg.
                                        </p>
                                    </div>
                                    <span className="relative inline-flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={isProfilePrivate}
                                            onChange={(e) => setIsProfilePrivate(e.target.checked)}
                                            className="peer sr-only"
                                        />
                                        <span className="h-7 w-12 rounded-full bg-slate-300 transition-colors duration-200 peer-checked:bg-[var(--accent)]" />
                                        <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
                                    </span>
                                </label>
                            </div>

                            <div className="mt-8 border-t border-slate-200 pt-6">
                                <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-red-700">Slett konto</h3>
                                            <p className="mt-1 text-sm text-red-600">
                                                Dette er permanent og kan ikke angres.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDeleteError(null);
                                                setDeleteConfirmText('');
                                                setDeletePassword('');
                                                setShowDeleteConfirm(true);
                                            }}
                                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 active:scale-95"
                                            disabled={busy || closing || deletingAccount}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                            Slett konto
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {error ? (
                                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 p-3">
                                    <span className="material-symbols-outlined text-[20px] text-red-500">error</span>
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                            ) : null}
                        </div>

                        <div className="border-t border-slate-100 bg-white px-5 py-4">
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeWithAnim}
                                    className="w-full cursor-pointer rounded-full bg-slate-100 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-95 sm:w-auto"
                                    disabled={busy || closing || deletingAccount}
                                >
                                    Avbryt
                                </button>

                                <button
                                    type="button"
                                    onClick={() => void save(closeWithAnim)}
                                    className="brown-button w-full rounded-full px-5 py-2.5 font-semibold shadow-sm transition hover:opacity-95 active:scale-95 disabled:opacity-50 sm:w-auto"
                                    disabled={busy || closing || deletingAccount}
                                >
                                    {busy ? 'Lagrer…' : 'Lagre'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </AppModal>

            {showDeleteConfirm ? (
                <AppModal onClose={() => setShowDeleteConfirm(false)}>
                    {({ closeWithAnim, closing }) => (
                        <div className="p-6">
                            <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
                                <span className="material-symbols-outlined">warning</span>
                            </div>

                            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                                Slette kontoen permanent?
                            </h2>

                            <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                Dette kan ikke angres. Vi sletter profilen din og fjerner aktiviteten din fra appen.
                            </p>

                            <div className="mt-4">
                                <label className="mb-2 block text-sm font-semibold text-slate-900">
                                    Skriv <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold">slett</span> for å bekrefte
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => {
                                        setDeleteConfirmText(e.target.value);
                                        if (deleteError) setDeleteError(null);
                                    }}
                                    placeholder="slett"
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-3 transition focus:bg-white focus:outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100"
                                    autoComplete="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    disabled={deletingAccount}
                                />
                            </div>

                            {requiresPasswordForDeletion ? (
                                <div className="mt-4">
                                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                                        Skriv inn passordet ditt
                                    </label>
                                    <input
                                        type="password"
                                        value={deletePassword}
                                        onChange={(e) => {
                                            setDeletePassword(e.target.value);
                                            if (deleteError) setDeleteError(null);
                                        }}
                                        placeholder="Passord"
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-3 transition focus:bg-white focus:outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100"
                                        autoComplete="current-password"
                                        disabled={deletingAccount}
                                    />
                                </div>
                            ) : null}

                            {deleteError ? (
                                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 p-3">
                                    <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>
                                    <p className="text-sm text-red-600">{deleteError}</p>
                                </div>
                            ) : null}

                            <div className="mt-6 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeWithAnim}
                                    className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 transition active:scale-95"
                                    disabled={closing || deletingAccount}
                                >
                                    Avbryt
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleDeleteAccount()}
                                    className="inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-red-600 active:scale-95 disabled:opacity-60"
                                    disabled={closing || deletingAccount || deleteConfirmText.trim().toLowerCase() !== 'slett'}
                                >
                                    <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                                    {deletingAccount ? 'Sletter konto…' : 'Slett konto'}
                                </button>
                            </div>
                        </div>
                    )}
                </AppModal>
            ) : null}

            <AppearanceModal
                open={showAppearanceModal}
                onClose={() => setShowAppearanceModal(false)}
                themeId={profileThemeId}
                fontId={profileFontId}
                onThemeChange={setProfileThemeId}
                onFontChange={setProfileFontId}
            />
        </>
    );
};

const UserProfile: React.FC = () => {
    const params = useParams();
    const router = useRouter();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const viewerUid = auth.currentUser?.uid ?? '';
    const viewerFollowing = useUserFollowing(viewerUid);

    const userRecipes = useUserRecipes(id || '');
    const userLikedRecipes = useUserLikedRecipes(id || '');

    const [activeTab, setActiveTab] = useState<'myRecipes' | 'likedRecipes' | 'publicCollections'>('myRecipes');
    const [userData, setUserData] = useState<UserData | null>(null);
    const [followState, setFollowState] = useState<FollowState>('not_following');
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

    const isOwner = viewerUid === id;
    const displayedRecipes = filterVisibleRecipes(
        activeTab === 'myRecipes' ? userRecipes : userLikedRecipes,
        viewerUid,
        viewerFollowing,
    );

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
                    const meData = meSnap.exists() ? (meSnap.data() as UserData) : null;
                    setFollowState(getFollowState(auth.currentUser.uid, id, meData, snap.exists() ? (snap.data() as UserData) : null));
                } else {
                    setFollowState('not_following');
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

    const name = userData.name || 'User Profile';
    const photoURL = userData.photoURL || '';
    const backgroundPhotoURL = userData.backgroundPhotoURL || '';
    const bio = userData.bio || '';
    const favoriteFood = userData.favoriteFood || '';
    const profileTheme = getProfileTheme(userData.profileThemeId);
    const profileFont = getProfileFont(userData.profileFontId);
    const tabs: Array<{ key: 'myRecipes' | 'likedRecipes' | 'publicCollections'; label: string }> = [
        { key: 'myRecipes', label: 'Oppskrifter' },
        { key: 'likedRecipes', label: 'Likte' },
        { key: 'publicCollections', label: 'Kokebøker' },
    ];
    const activeTabIndex = tabs.findIndex((tab) => tab.key === activeTab);
    const isPrivateProfile = Boolean(userData.isProfilePrivate);

    return (
        <div className="pb-24" style={{ backgroundColor: profileTheme.soft, fontFamily: profileFont.family }}>
            {/* Banner */}
            <div className="relative h-[34vh] min-h-[220px] w-full overflow-hidden" style={{ backgroundColor: profileTheme.soft }}>
                {backgroundPhotoURL ? (
                    <img src={backgroundPhotoURL} alt={`${name} bakgrunnsbilde`} className="absolute inset-0 h-full w-full scale-105 object-cover" />
                ) : (
                    <div className="absolute inset-0 h-full w-full" style={{ backgroundColor: profileTheme.soft }} />
                )}
                {/* layered depth: soft vignette */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/25" />
                <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            </div>

            {/* Profile card — below the banner, solid background, avatar overlaps up */}
            <div className="relative z-10 mx-auto -mt-16 max-w-5xl px-4 md:-mt-20 md:w-2/3">
                <div
                    className="rounded-xl p-5 shadow-sm sm:rounded-xl sm:p-6 md:p-8"
                    style={{ backgroundColor: profileTheme.main, color: profileTheme.text }}
                >
                    <div className="md:flex md:items-end md:justify-between md:gap-10">
                        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:gap-6 sm:text-left md:gap-8">
                            <div className="relative shrink-0">
                                <div className="h-24 w-24 rounded-xl shadow-sm sm:h-28 sm:w-28 sm:rounded-xl md:h-40 md:w-40">
                                    <div className="h-full w-full overflow-hidden rounded-lg sm:rounded-lg" style={{ backgroundColor: profileTheme.soft }}>
                                        {photoURL ? (
                                            <img src={photoURL} alt="User Avatar" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="grid h-full w-full place-items-center text-4xl" style={{ color: profileTheme.accent }}>
                                                🧑‍🍳
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="min-w-0 w-full sm:pt-2 md:pb-2">
                                <div className="flex items-center justify-center gap-3 sm:justify-start">
                                    <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl md:text-5xl">
                                        {name}
                                    </h1>

                                    {isOwner ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowEditProfile(true)}
                                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border transition active:scale-90 sm:h-11 sm:w-11"
                                            style={{
                                                borderColor: `${profileTheme.text}40`,
                                                backgroundColor: `${profileTheme.text}14`,
                                                color: profileTheme.text,
                                            }}
                                            aria-label="Rediger profil"
                                            title="Rediger profil"
                                        >
                                            <span className="material-symbols-outlined">edit</span>
                                        </button>
                                    ) : null}
                                </div>

                                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm  sm:justify-start md:text-base">
                                    <button
                                        type="button"
                                        onClick={() => setShowFollowersModal(true)}
                                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition active:scale-95"
                                        style={{
                                            border: `1px solid ${profileTheme.text}38`,
                                            backgroundColor: `${profileTheme.text}14`,
                                            color: profileTheme.text,
                                        }}
                                        aria-label="Se følgere"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">group</span>
                                        <span>
                                            <span className="font-semibold">{followerCount}</span> følgere
                                        </span>
                                    </button>

                                    {favoriteFood ? (
                                        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full   px-3 py-1.5">
                                            <span className="material-symbols-outlined text-[20px]">restaurant</span>
                                            <span className="truncate">
                                                <span className="font-semibold ">Favorittmat:</span> {favoriteFood}
                                            </span>
                                        </span>
                                    ) : null}
                                </div>

                                {bio ? (
                                    <p className="mt-4 max-w-2xl text-base leading-relaxed md:text-lg" style={{ color: `${profileTheme.text}d9` }}>
                                        {bio}
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        {!isOwner && auth.currentUser ? (
                            <div className="mt-5 flex items-center justify-center md:mt-0 md:justify-end md:pb-2 shrink-0">
                                <button
                                    onClick={async () => {
                                        const result = await toggleFollowAction(auth.currentUser!.uid, id);
                                        if (result === 'followed') {
                                            setFollowerCount((prevCount) => prevCount + 1);
                                        } else if (result === 'unfollowed') {
                                            setFollowerCount((prevCount) => Math.max(0, prevCount - 1));
                                        }

                                        setUserData((prev) => {
                                            if (!prev) return prev;
                                            const incoming = new Set(prev.incomingFollowRequests ?? []);
                                            if (result === 'requested') incoming.add(auth.currentUser!.uid);
                                            if (result === 'request_cancelled' || result === 'unfollowed' || result === 'followed') {
                                                incoming.delete(auth.currentUser!.uid);
                                            }
                                            return { ...prev, incomingFollowRequests: Array.from(incoming) };
                                        });

                                        setFollowState((prev) => {
                                            if (result === 'followed') return 'following';
                                            if (result === 'unfollowed' || result === 'request_cancelled') return 'not_following';
                                            if (result === 'requested') return 'requested';
                                            return prev;
                                        });
                                    }}
                                    className={[
                                        'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition active:scale-95 sm:text-base',
                                        followState === 'following'
                                            ? 'border bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                                            : 'border',
                                    ].join(' ')}
                                    style={
                                        followState === 'following'
                                            ? undefined
                                            : {
                                                borderColor: `${profileTheme.text}40`,
                                                backgroundColor: `${profileTheme.text}14`,
                                                color: profileTheme.text,
                                            }
                                    }
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {followState === 'following' ? 'check' : followState === 'requested' ? 'schedule' : isPrivateProfile ? 'person_add' : 'add'}
                                    </span>
                                    {followState === 'following'
                                        ? 'Følger'
                                        : followState === 'requested'
                                            ? 'Forespurt'
                                            : isPrivateProfile
                                                ? 'Be om å følge'
                                                : 'Følg'}
                                </button>
                            </div>
                        ) : null}
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
                                theme={profileTheme}
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
                    initialProfileThemeId={userData.profileThemeId || DEFAULT_PROFILE_THEME_ID}
                    initialProfileFontId={userData.profileFontId || 'urbanist'}
                    initialIsProfilePrivate={Boolean(userData.isProfilePrivate)}
                    uid={id}
                    onLogout={logout}
                    onSaved={(next) => {
                        setUserData((prev) =>
                            prev
                                ? {
                                    ...prev,
                                    bio: next.bio,
                                    favoriteFood: next.favoriteFood,
                                    photoURL: next.photoURL,
                                    backgroundPhotoURL: next.backgroundPhotoURL,
                                    profileThemeId: next.profileThemeId,
                                    profileFontId: next.profileFontId,
                                    isProfilePrivate: next.isProfilePrivate,
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
