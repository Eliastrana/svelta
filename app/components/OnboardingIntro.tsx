'use client';

import React, { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { firestore, storage } from '@/firebase';
import {
    PROFILE_FONTS,
    PROFILE_THEMES,
    getProfileFont,
    getProfileTheme,
} from '@/helpers/profileAppearance';
import { syncPublicUserProfile } from '@/helpers/publicUserProfile';

type OnboardingIntroProps = {
    open: boolean;
    uid: string;
    initialName: string;
    initialBio: string;
    initialFavoriteFood: string;
    initialPhotoURL: string;
    initialBackgroundPhotoURL: string;
    initialProfileThemeId: string;
    initialProfileFontId: string;
    initialIsProfilePrivate: boolean;
    onComplete: (next: {
        bio: string;
        favoriteFood: string;
        photoURL: string;
        backgroundPhotoURL: string;
        profileThemeId: string;
        profileFontId: string;
        isProfilePrivate: boolean;
        hasCompletedOnboarding: boolean;
    }) => void;
};

type IntroStep = 'welcome' | 'features' | 'profile' | 'formatting';

const STEPS: Array<{
    id: IntroStep;
    eyebrow: string;
    title: string;
    text: string;
}> = [
    {
        id: 'welcome',
        eyebrow: 'Velkommen til',
        title: 'Svelta',
        text: 'Del oppskrifter og finn noe godt.',
    },
    {
        id: 'profile',
        eyebrow: 'Profil',
        title: 'Legg inn det viktigste',
        text: 'Bio, bilder og privat profil.',
    },
    {
        id: 'formatting',
        eyebrow: 'Utseende',
        title: 'Velg tema og font',
        text: 'Bare for profilsiden din.',
    },
];

const OnboardingIntro: React.FC<OnboardingIntroProps> = ({
    open,
    uid,
    initialName,
    initialBio,
    initialFavoriteFood,
    initialPhotoURL,
    initialBackgroundPhotoURL,
    initialProfileThemeId,
    initialProfileFontId,
    initialIsProfilePrivate,
    onComplete,
}) => {
    const [step, setStep] = useState(0);
    const [bio, setBio] = useState(initialBio);
    const [favoriteFood, setFavoriteFood] = useState(initialFavoriteFood);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState(initialPhotoURL);
    const [backgroundPhotoFile, setBackgroundPhotoFile] = useState<File | null>(
        null
    );
    const [backgroundPhotoPreview, setBackgroundPhotoPreview] = useState(
        initialBackgroundPhotoURL
    );
    const [profileThemeId, setProfileThemeId] = useState(initialProfileThemeId);
    const [profileFontId, setProfileFontId] = useState(initialProfileFontId);
    const [isProfilePrivate, setIsProfilePrivate] = useState(
        initialIsProfilePrivate
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setStep(0);
        setBio(initialBio);
        setFavoriteFood(initialFavoriteFood);
        setPhotoFile(null);
        setPhotoPreview(initialPhotoURL);
        setBackgroundPhotoFile(null);
        setBackgroundPhotoPreview(initialBackgroundPhotoURL);
        setProfileThemeId(initialProfileThemeId);
        setProfileFontId(initialProfileFontId);
        setIsProfilePrivate(initialIsProfilePrivate);
        setSaving(false);
        setError(null);
    }, [
        open,
        initialBio,
        initialFavoriteFood,
        initialPhotoURL,
        initialBackgroundPhotoURL,
        initialProfileThemeId,
        initialProfileFontId,
        initialIsProfilePrivate,
    ]);

    useEffect(() => {
        return () => {
            if (photoPreview.startsWith('blob:'))
                URL.revokeObjectURL(photoPreview);
            if (backgroundPhotoPreview.startsWith('blob:'))
                URL.revokeObjectURL(backgroundPhotoPreview);
        };
    }, [photoPreview, backgroundPhotoPreview]);

    if (!open) return null;

    const activeStep = STEPS[step];
    const activeTheme = getProfileTheme(profileThemeId);
    const activeFont = getProfileFont(profileFontId);
    const isLastStep = step === STEPS.length - 1;

    const handlePickPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    const handlePickBackground = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (backgroundPhotoPreview.startsWith('blob:'))
            URL.revokeObjectURL(backgroundPhotoPreview);
        setBackgroundPhotoFile(file);
        setBackgroundPhotoPreview(URL.createObjectURL(file));
    };

    const finishOnboarding = async (skipCustomizations = false) => {
        if (saving) return;

        setSaving(true);
        setError(null);

        try {
            let nextPhotoURL = initialPhotoURL;
            let nextBackgroundPhotoURL = initialBackgroundPhotoURL;

            if (!skipCustomizations && photoFile) {
                const imageRef = ref(
                    storage,
                    `profile-pictures/${uid}/${Date.now()}-${photoFile.name}`
                );
                const snap = await uploadBytes(imageRef, photoFile);
                nextPhotoURL = await getDownloadURL(snap.ref);
            }

            if (!skipCustomizations && backgroundPhotoFile) {
                const imageRef = ref(
                    storage,
                    `profile-backgrounds/${uid}/${Date.now()}-${backgroundPhotoFile.name}`
                );
                const snap = await uploadBytes(imageRef, backgroundPhotoFile);
                nextBackgroundPhotoURL = await getDownloadURL(snap.ref);
            }

            const payload = {
                bio: skipCustomizations ? initialBio : bio.trim(),
                favoriteFood: skipCustomizations
                    ? initialFavoriteFood
                    : favoriteFood.trim(),
                photoURL: skipCustomizations ? initialPhotoURL : nextPhotoURL,
                backgroundPhotoURL: skipCustomizations
                    ? initialBackgroundPhotoURL
                    : nextBackgroundPhotoURL,
                profileThemeId: skipCustomizations
                    ? initialProfileThemeId
                    : profileThemeId,
                profileFontId: skipCustomizations
                    ? initialProfileFontId
                    : profileFontId,
                isProfilePrivate: skipCustomizations
                    ? initialIsProfilePrivate
                    : isProfilePrivate,
                hasCompletedOnboarding: true,
            };

            await updateDoc(doc(firestore, 'users', uid), payload);
            await syncPublicUserProfile(uid, {
                name: initialName,
                photoURL: payload.photoURL,
                favoriteFood: payload.favoriteFood,
            });
            onComplete(payload);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Kunne ikke fullføre introduksjonen.'
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[140] overflow-y-auto bg-[#fbfaf4] px-4 py-4 sm:px-5 sm:py-6">
            <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-2xl items-center justify-center">
                <div className="w-full rounded-[24px] border border-[#e8e3d7] bg-white p-5 shadow-sm sm:rounded-[28px] sm:p-6 md:p-8">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            {STEPS.map((_, index) => (
                                <span
                                    key={`step-${index}`}
                                    className="h-2.5 rounded-full transition-all duration-200"
                                    style={{
                                        width: index === step ? 28 : 10,
                                        backgroundColor:
                                            index <= step
                                                ? activeTheme.main
                                                : '#d8dfd0',
                                    }}
                                />
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => void finishOnboarding(true)}
                            className="rounded-full bg-[#f5f3e8] px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-[#ece8da]"
                            disabled={saving}
                        >
                            Hopp over
                        </button>
                    </div>

                    <div
                        className="text-center"
                        style={
                            activeStep.id === 'formatting'
                                ? { fontFamily: activeFont.family }
                                : undefined
                        }
                    >
                        <p
                            className="text-xs font-semibold uppercase"
                            style={{ color: activeTheme.accent }}
                        >
                            {activeStep.eyebrow}
                        </p>
                        <h1 className="mt-3 text-2xl font-semibold text-neutral-900 sm:text-3xl md:text-4xl">
                            {activeStep.title}
                        </h1>
                        <p className="mx-auto mt-3 max-w-md text-sm text-neutral-800 sm:text-base">
                            {activeStep.text}
                        </p>
                    </div>

                    {activeStep.id === 'welcome' ? (
                        <div className="mt-8 space-y-3 text-center md:grid md:grid-cols-3 md:gap-3 md:space-y-0 md:place-items-center md:text-md">
                            <div className="flex items-center justify-center rounded-2xl bg-[#f8f6ed] px-4 py-4 text-neutral-800 md:h-32 md:w-full">
                                Del oppskrifter
                            </div>
                            <div className="flex items-center justify-center rounded-2xl bg-[#f8f6ed] px-4 py-4 text-neutral-800 md:h-32 md:w-full">
                                Finn nye favoritter
                            </div>
                            <div className="flex items-center justify-center rounded-2xl bg-[#f8f6ed] px-4 py-4 text-neutral-800 md:h-32 md:w-full">
                                Bygg egne kokebøker
                            </div>
                        </div>
                    ) : null}

                    {activeStep.id === 'features' ? (
                        <div className="mt-8 space-y-3 text-center">
                            <div className="rounded-2xl border border-[#ece8da] px-4 py-4 text-slate-700">
                                Følg kokker
                            </div>
                            <div className="rounded-2xl border border-[#ece8da] px-4 py-4 text-slate-700">
                                Lagre oppskrifter
                            </div>
                            <div className="rounded-2xl border border-[#ece8da] px-4 py-4 text-slate-700">
                                Se populære retter
                            </div>
                        </div>
                    ) : null}

                    {activeStep.id === 'profile' ? (
                        <div className="mt-8 space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left transition hover:border-slate-300">
                                    <div className="relative aspect-[4/3] w-full bg-[#f1eee4]">
                                        {photoPreview ? (
                                            <img
                                                src={photoPreview}
                                                alt="Valgt profilbilde"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="grid h-full w-full place-items-center text-slate-400">
                                                <span className="material-symbols-outlined text-4xl">
                                                    photo_camera
                                                </span>
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 bg-white/90 px-4 py-3">
                                            <span className="block text-sm font-semibold text-slate-900">
                                                Profilbilde
                                            </span>
                                            <span className="mt-1 block text-sm text-slate-500">
                                                {photoPreview
                                                    ? 'Trykk for å bytte'
                                                    : 'Trykk for å legge til'}
                                            </span>
                                        </div>
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handlePickPhoto}
                                    />
                                </label>

                                <label className="cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left transition hover:border-slate-300">
                                    <div className="relative aspect-[4/3] w-full bg-[#f1eee4]">
                                        {backgroundPhotoPreview ? (
                                            <img
                                                src={backgroundPhotoPreview}
                                                alt="Valgt bakgrunnsbilde"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="grid h-full w-full place-items-center text-slate-400">
                                                <span className="material-symbols-outlined text-4xl">
                                                    image
                                                </span>
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 bg-white/90 px-4 py-3">
                                            <span className="block text-sm font-semibold text-slate-900">
                                                Bakgrunnsbilde
                                            </span>
                                            <span className="mt-1 block text-sm text-slate-500">
                                                {backgroundPhotoPreview
                                                    ? 'Trykk for å bytte'
                                                    : 'Trykk for å legge til'}
                                            </span>
                                        </div>
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handlePickBackground}
                                    />
                                </label>
                            </div>

                            <input
                                value={favoriteFood}
                                onChange={(e) =>
                                    setFavoriteFood(e.target.value)
                                }
                                placeholder="Favorittmat"
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            />

                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="Bio"
                                className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            />

                            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                        Privat profil
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Godkjenn nye følgere
                                    </p>
                                </div>
                                <span className="relative inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={isProfilePrivate}
                                        onChange={(e) =>
                                            setIsProfilePrivate(
                                                e.target.checked
                                            )
                                        }
                                        className="peer sr-only"
                                    />
                                    <span className="h-7 w-12 rounded-full bg-slate-300 transition-colors duration-200 peer-checked:bg-[var(--accent)]" />
                                    <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
                                </span>
                            </label>
                        </div>
                    ) : null}

                    {activeStep.id === 'formatting' ? (
                        <div className="mt-8 space-y-5">
                            <div className="grid gap-2 sm:grid-cols-2">
                                {PROFILE_THEMES.map((theme) => (
                                    <button
                                        key={theme.id}
                                        type="button"
                                        onClick={() =>
                                            setProfileThemeId(theme.id)
                                        }
                                        className={[
                                            'overflow-hidden rounded-2xl border text-left transition',
                                            profileThemeId === theme.id
                                                ? 'border-slate-900 ring-2 ring-slate-900/10'
                                                : 'border-slate-200 hover:border-slate-300',
                                        ].join(' ')}
                                    >
                                        <div
                                            className="h-10"
                                            style={{
                                                backgroundColor: theme.main,
                                            }}
                                        />
                                        <div
                                            className="px-3 py-2 text-sm font-semibold"
                                            style={{
                                                backgroundColor: theme.soft,
                                                color: theme.text,
                                            }}
                                        >
                                            {theme.label}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                                {PROFILE_FONTS.map((font) => (
                                    <button
                                        key={font.id}
                                        type="button"
                                        onClick={() =>
                                            setProfileFontId(font.id)
                                        }
                                        className={[
                                            'rounded-2xl border px-4 py-3 text-center transition',
                                            profileFontId === font.id
                                                ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10'
                                                : 'border-slate-200 hover:border-slate-300',
                                        ].join(' ')}
                                        style={{ fontFamily: font.family }}
                                    >
                                        <span className="font-semibold">
                                            {font.label}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <div
                                className="overflow-hidden rounded-[24px] border border-slate-200"
                                style={{
                                    backgroundColor: activeTheme.soft,
                                    color: activeTheme.text,
                                    fontFamily: activeFont.family,
                                }}
                            >
                                <div
                                    className="h-28"
                                    style={{
                                        backgroundColor: activeTheme.soft,
                                    }}
                                >
                                    {backgroundPhotoPreview ? (
                                        <img
                                            src={backgroundPhotoPreview}
                                            alt="Bakgrunn"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : null}
                                </div>
                                <div
                                    className="px-4 py-4"
                                    style={{
                                        backgroundColor: activeTheme.main,
                                        color: activeTheme.text,
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="h-14 w-14 overflow-hidden rounded-2xl"
                                            style={{
                                                backgroundColor: `${activeTheme.text}14`,
                                            }}
                                        >
                                            {photoPreview ? (
                                                <img
                                                    src={photoPreview}
                                                    alt="Profil"
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="grid h-full w-full place-items-center text-2xl">
                                                    🧑‍🍳
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 text-left">
                                            <p className="truncate text-lg font-semibold">
                                                {initialName}
                                            </p>
                                            <p
                                                className="truncate text-sm"
                                                style={{
                                                    color: `${activeTheme.text}d9`,
                                                }}
                                            >
                                                {favoriteFood.trim() ||
                                                    'Favorittmat'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {error ? (
                        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    ) : null}

                    <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <button
                            type="button"
                            onClick={() =>
                                setStep((prev) => Math.max(0, prev - 1))
                            }
                            className="rounded-full bg-slate-100 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-40"
                            disabled={step === 0 || saving}
                        >
                            Tilbake
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (isLastStep) {
                                    void finishOnboarding(false);
                                    return;
                                }
                                setStep((prev) =>
                                    Math.min(STEPS.length - 1, prev + 1)
                                );
                            }}
                            className="rounded-full px-5 py-3 font-semibold transition hover:opacity-95 disabled:opacity-60"
                            style={{ backgroundColor: activeTheme.main }}
                            disabled={saving}
                        >
                            {isLastStep
                                ? saving
                                    ? 'Gjør klart…'
                                    : 'Start'
                                : 'Fortsett'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingIntro;
