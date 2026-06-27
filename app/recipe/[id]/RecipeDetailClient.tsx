'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { deleteDoc, doc } from 'firebase/firestore';

import LikeButton from '@/app/components/LikeButton';
import CommentSection from '@/app/components/CommentSection';
import AddToCollectionModal from '@/app/components/AddToCollectionModal';
import AppModal from '@/app/components/AppModal';

import { useRecipe } from '@/hooks/useRecipe';
import { usePublicUserData } from '@/hooks/usePublicUserData';
import { useUserFollowing } from '@/hooks/useUserFollowing';
import { auth, firestore } from '@/firebase';
import RatingStars from '@/app/components/RatingStars';
import { canViewRecipe } from '@/helpers/recipeVisibility';
import { LinkedRecipeReference } from '@/app/types/CookingStep';
import { RecipeCoAuthor } from '@/app/types/Recipe';

type IngredientDetailed = { name: string; amount: string };

type RecipeForDetail = {
    id: string;
    userId: string;
    title: string;
    description?: string;
    coverImage?: string;
    coAuthors?: RecipeCoAuthor[];
    coAuthorIds?: string[];
    cookingSteps: Array<{
        title: string;
        description: string;
        imageUrl?: string;
        linkedRecipe?: LinkedRecipeReference;
    }>;
    temperature?: string;
    cookingTime?: string;
    portions?: string;
    ingredients?: string[];
    ingredientsDetailed?: IngredientDetailed[];
    tags?: string[];
};

type Props = {
    id: string;
};

type WakeLockSentinelLike = {
    release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
    wakeLock?: {
        request: (type: 'screen') => Promise<WakeLockSentinelLike>;
    };
};

const RecipeDetailSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#fbfaf4] pb-20 animate-pulse">
            <div className="mx-auto grid max-w-[1190px] gap-5 px-4 py-4 lg:grid-cols-[438px_minmax(0,1fr)]">
                <div className="space-y-3">
                    <div className="rounded-xl bg-[#f2f1e8] p-8">
                        <div className="flex gap-2">
                            <div className="h-8 w-24 rounded-full bg-slate-200" />
                            <div className="h-8 w-24 rounded-full bg-slate-200" />
                        </div>

                        <div className="mt-8 h-9 w-56 rounded-full bg-slate-200" />
                        <div className="mt-8 h-14 w-72 rounded-xl bg-slate-200" />

                        <div className="mt-6 flex gap-3">
                            <div className="h-8 w-24 rounded-md bg-slate-200" />
                            <div className="h-8 w-32 rounded-md bg-slate-200" />
                        </div>

                        <div className="mt-8 h-5 w-full rounded bg-slate-200" />
                        <div className="mt-2 h-5 w-5/6 rounded bg-slate-200" />
                        <div className="mt-2 h-5 w-4/6 rounded bg-slate-200" />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-[86px] rounded-xl bg-[#f2f1e8]"
                            />
                        ))}
                    </div>

                    <div className="rounded-xl bg-[#f2f1e8] p-8">
                        <div className="h-8 w-44 rounded-xl bg-slate-200" />
                        <div className="mt-8 space-y-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-5 w-52 rounded bg-slate-200"
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <div className="aspect-square rounded-xl bg-slate-200 lg:aspect-[724/724]" />
                    <div className="mt-6 h-8 w-72 rounded-xl bg-slate-200" />
                </div>
            </div>
        </div>
    );
};

const RecipeDetailClient: React.FC<Props> = ({ id }) => {
    const router = useRouter();

    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [wakeLockEnabled, setWakeLockEnabled] = useState(false);
    const [wakeLockSupported, setWakeLockSupported] = useState(false);
    const [checkedSteps, setCheckedSteps] = useState<boolean[]>([]);

    const [recipeRaw, loading] = useRecipe(id);
    const recipe = recipeRaw as RecipeForDetail | null;

    const creatorDoc = usePublicUserData(recipe?.userId || '');

    const currentUid = auth.currentUser?.uid ?? '';
    const viewerFollowing = useUserFollowing(currentUid);
    const isLoggedIn = Boolean(currentUid);
    const isOwner = Boolean(
        recipe && currentUid && recipe.userId === currentUid
    );

    const goLogin = useCallback(() => {
        const next = window.location.pathname + window.location.search;
        router.push(`/login?next=${encodeURIComponent(next)}`);
    }, [router]);

    const requireAuth = useCallback(
        (fn: () => void) => {
            if (!isLoggedIn) {
                goLogin();
                return;
            }

            fn();
        },
        [isLoggedIn, goLogin]
    );

    const ingredientsToRender: IngredientDetailed[] = useMemo(() => {
        if (!recipe) return [];

        return recipe.ingredientsDetailed &&
            recipe.ingredientsDetailed.length > 0
            ? recipe.ingredientsDetailed
                  .map((i) => ({
                      name: i.name.trim(),
                      amount: i.amount.trim(),
                  }))
                  .filter((i) => i.name.length > 0)
            : (recipe.ingredients ?? [])
                  .map((s) => ({ name: String(s).trim(), amount: '' }))
                  .filter((i) => i.name.length > 0);
    }, [recipe]);

    useEffect(() => {
        if (!recipe) {
            setCheckedSteps([]);
            return;
        }

        const fallback = recipe.cookingSteps.map(() => false);
        if (typeof window === 'undefined') {
            setCheckedSteps(fallback);
            return;
        }

        try {
            const savedValue = window.localStorage.getItem(
                `recipe-step-checks:${id}`
            );
            if (!savedValue) {
                setCheckedSteps(fallback);
                return;
            }

            const parsed = JSON.parse(savedValue);
            if (!Array.isArray(parsed)) {
                setCheckedSteps(fallback);
                return;
            }

            const normalized = recipe.cookingSteps.map((_, index) =>
                Boolean(parsed[index])
            );
            setCheckedSteps(normalized);
        } catch (error) {
            console.debug('Could not read recipe step checks:', error);
            setCheckedSteps(fallback);
        }
    }, [id, recipe]);

    useEffect(() => {
        if (!recipe || typeof window === 'undefined') return;

        try {
            window.localStorage.setItem(
                `recipe-step-checks:${id}`,
                JSON.stringify(checkedSteps)
            );
        } catch (error) {
            console.debug('Could not store recipe step checks:', error);
        }
    }, [checkedSteps, id, recipe]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const wakeLockApi = (navigator as NavigatorWithWakeLock).wakeLock;
        setWakeLockSupported(Boolean(wakeLockApi?.request));

        try {
            const savedPreference = window.localStorage.getItem(
                'recipe-wake-lock-enabled'
            );
            setWakeLockEnabled(savedPreference === 'true');
        } catch (error) {
            console.debug('Could not read wake lock preference:', error);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            window.localStorage.setItem(
                'recipe-wake-lock-enabled',
                String(wakeLockEnabled)
            );
        } catch (error) {
            console.debug('Could not store wake lock preference:', error);
        }
    }, [wakeLockEnabled]);

    useEffect(() => {
        let mounted = true;
        let wakeLock: WakeLockSentinelLike | null = null;

        const requestWakeLock = async () => {
            if (typeof window === 'undefined') return;
            if (!wakeLockEnabled) return;
            if (document.visibilityState !== 'visible') return;

            const wakeLockApi = (navigator as NavigatorWithWakeLock).wakeLock;
            if (!wakeLockApi?.request) return;

            try {
                wakeLock = await wakeLockApi.request('screen');
            } catch (error) {
                console.debug('Wake lock unavailable for recipe page:', error);
            }
        };

        const releaseWakeLock = async () => {
            if (!wakeLock) return;

            try {
                await wakeLock.release();
            } catch (error) {
                console.debug('Wake lock release failed:', error);
            } finally {
                wakeLock = null;
            }
        };

        const handleVisibilityChange = async () => {
            if (!mounted) return;

            if (document.visibilityState === 'visible') {
                await requestWakeLock();
                return;
            }

            await releaseWakeLock();
        };

        if (wakeLockEnabled && wakeLockSupported) {
            void requestWakeLock();
        }
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            mounted = false;
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange
            );
            void releaseWakeLock();
        };
    }, [wakeLockEnabled, wakeLockSupported]);

    if (loading) return <RecipeDetailSkeleton />;

    if (!recipe) {
        return <div className="p-4">Oppskrift ikke funnet.</div>;
    }

    const allowedToView = canViewRecipe(recipe, currentUid, viewerFollowing);

    if (!allowedToView) {
        return (
            <div className="min-h-screen bg-[#fbfaf4] px-4 py-10 text-[#12340d]">
                <div className="mx-auto max-w-xl rounded-2xl bg-[#f2f1e8] p-6 text-center shadow-sm">
                    <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#e5e5d7]">
                        <span className="material-symbols-outlined text-[28px]">
                            lock
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold">
                        Denne oppskriften er privat
                    </h1>
                    <p className="mt-3 text-sm leading-relaxed text-[#496444]">
                        Bare folk som følger kokken kan se denne oppskriften.
                    </p>
                    <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                        {!isLoggedIn ? (
                            <button
                                type="button"
                                onClick={goLogin}
                                className="rounded-full bg-[#12340d] px-5 py-2.5 font-semibold text-white transition hover:opacity-90"
                            >
                                Logg inn
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() =>
                                router.push(`/user/${recipe.userId}`)
                            }
                            className="rounded-full bg-[#e5e5d7] px-5 py-2.5 font-semibold text-[#12340d] transition hover:bg-[#d8d7cb]"
                        >
                            Gå til profil
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const userName = creatorDoc?.name || 'Ukjent brukernavn';
    const userPhoto = creatorDoc?.photoURL || '';
    const authorEntries = [
        {
            uid: recipe.userId,
            name: userName,
            photoURL: userPhoto,
        },
        ...(recipe.coAuthors ?? [])
            .filter((coAuthor) => coAuthor.uid !== recipe.userId)
            .map((coAuthor) => ({
                uid: coAuthor.uid,
                name: coAuthor.name?.trim() || 'Medforfatter',
                photoURL: coAuthor.photoURL?.trim() || '',
            })),
    ];
    const coAuthorNames = (recipe.coAuthors ?? [])
        .map((coAuthor) => coAuthor.name?.trim())
        .filter((name): name is string => Boolean(name));
    const allAuthorNames = [userName, ...coAuthorNames];
    const completedStepCount = checkedSteps.filter(Boolean).length;

    const handleDelete = async () => {
        if (!isOwner) return;

        try {
            setDeleting(true);
            await deleteDoc(doc(firestore, 'recipes', recipe.id));
            router.replace(`/user/${currentUid}`);
        } catch (err) {
            console.error('Error deleting recipe:', err);
        } finally {
            setDeleting(false);
        }
    };

    const toggleStep = (index: number) => {
        setCheckedSteps((prev) =>
            prev.map((value, currentIndex) =>
                currentIndex === index ? !value : value
            )
        );
    };

    const resetCheckedSteps = () => {
        setCheckedSteps(recipe.cookingSteps.map(() => false));
    };

    return (
        <div className="min-h-screen overflow-x-clip bg-[#fbfaf4] pb-20 text-[#12340d]">
            <main className="mx-auto grid max-w-[1190px] min-w-0 gap-5 px-4 py-4 lg:grid-cols-[438px_minmax(0,1fr)] lg:items-start">
                {/* LEFT COLUMN */}
                <div className="min-w-0 space-y-3 lg:sticky lg:top-4 lg:self-start lg:h-fit">
                    {/* Intro card */}
                    <section className="min-w-0 overflow-hidden rounded-xl bg-[#f2f1e8] p-6 md:p-8">
                        {Array.isArray(recipe.tags) &&
                        recipe.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {recipe.tags.map((t) => (
                                    <span
                                        key={t}
                                        className="max-w-full rounded-full bg-[#c7e9c0] px-3 py-2 text-xs font-medium uppercase tracking-wide text-[#12340d] [overflow-wrap:anywhere]"
                                    >
                                        {t}
                                    </span>
                                ))}
                            </div>
                        ) : null}

                        {/* Cleaner rating */}
                        <div className="mt-8">
                            <RatingStars
                                recipeId={recipe.id}
                                variant="compact"
                            />
                        </div>

                        <h1 className="mt-7 text-5xl font-bold leading-none tracking-tight text-[#12340d] [overflow-wrap:anywhere] md:text-[52px]">
                            {recipe.title}
                        </h1>

                        <div className="mt-6 flex flex-wrap gap-2">
                            {recipe.temperature && (
                                <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-[#e5e5d7] px-3 py-1 text-sm [overflow-wrap:anywhere]">
                                    <span className="material-symbols-outlined text-[16px]">
                                        device_thermostat
                                    </span>
                                    {recipe.temperature}
                                </span>
                            )}

                            {recipe.cookingTime && (
                                <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-[#e5e5d7] px-3 py-1 text-sm [overflow-wrap:anywhere]">
                                    <span className="material-symbols-outlined text-[16px]">
                                        schedule
                                    </span>
                                    {recipe.cookingTime}
                                </span>
                            )}
                        </div>

                        {recipe.description && (
                            <p className="mt-8 text-base leading-relaxed text-[#12340d] [overflow-wrap:anywhere]">
                                {recipe.description}
                            </p>
                        )}

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                            <div className="flex -space-x-3">
                                {authorEntries.map((author, index) => (
                                    <div
                                        key={`${author.uid}-${index}`}
                                        className="h-11 w-11 overflow-hidden rounded-full ring-2 ring-[#f2f1e8]"
                                    >
                                        {author.photoURL ? (
                                            <img
                                                src={author.photoURL}
                                                alt={author.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="grid h-full w-full place-items-center bg-[#deded0] text-[18px]">
                                                🧑‍🍳
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#496444]">
                                    Kokker
                                </p>
                                <p className="text-sm font-medium text-[#12340d] [overflow-wrap:anywhere]">
                                    {allAuthorNames.join(', ')}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Mobile image */}
                    {recipe.coverImage && (
                        <section className="lg:hidden">
                            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#f2f1e8]">
                                <Image
                                    src={recipe.coverImage}
                                    alt={`${recipe.title} cover`}
                                    fill
                                    className="object-cover"
                                    priority
                                    sizes="100vw"
                                    quality={75}
                                />
                            </div>
                        </section>
                    )}

                    {/* Creator / Like / Save cards */}
                    <section className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                router.push(`/user/${recipe.userId}`)
                            }
                            className="flex h-[86px] flex-col items-center justify-center rounded-xl bg-[#f2f1e8] px-2 text-center text-xs transition hover:bg-[#e8e7dc]"
                        >
                            <div className="mb-1 flex -space-x-2">
                                {authorEntries.slice(0, 2).map((author, index) => (
                                    <div
                                        key={`${author.uid}-${index}`}
                                        className="h-8 w-8 overflow-hidden rounded-full ring-2 ring-[#f2f1e8] bg-[#deded0]"
                                    >
                                        {author.photoURL ? (
                                            <img
                                                src={author.photoURL}
                                                alt={author.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-[18px]">
                                                person
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <span className="text-[10px] uppercase tracking-wide text-[#496444]">
                                {authorEntries.length > 1 ? 'Kokker' : 'Laget av'}
                            </span>

                            <span className="max-w-full line-clamp-2 font-medium leading-tight">
                                {allAuthorNames.join(', ')}
                            </span>
                        </button>

                        <div className="flex h-[86px] items-center justify-center rounded-xl bg-[#f2f1e8] px-2 text-xs transition hover:bg-[#e8e7dc]">
                            <LikeButton
                                recipeId={recipe.id}
                                variant="compact"
                                onRequireLogin={() => {
                                    const next =
                                        window.location.pathname +
                                        window.location.search;
                                    router.push(
                                        `/login?next=${encodeURIComponent(next)}`
                                    );
                                }}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                requireAuth(() => setShowAddModal(true))
                            }
                            className="flex h-[86px] flex-col items-center justify-center rounded-xl bg-[#f2f1e8] text-xs transition hover:bg-[#e8e7dc]"
                        >
                            <span className="material-symbols-outlined mb-1 text-[28px]">
                                bookmark_add
                            </span>
                            Lagre
                        </button>
                    </section>

                    <section className="rounded-xl bg-[#f2f1e8] px-5 py-4">
                        <label className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold text-[#12340d]">
                                    Hold skjermen våken
                                </p>
                                <p className="mt-1 text-xs text-[#496444]">
                                    {wakeLockSupported
                                        ? 'Skjermen holdes på mens du følger oppskriften.'
                                        : 'Ikke støttet i denne nettleseren.'}
                                </p>
                            </div>

                            <span className="relative inline-flex items-center">
                                <input
                                    type="checkbox"
                                    checked={wakeLockEnabled}
                                    onChange={(e) =>
                                        setWakeLockEnabled(e.target.checked)
                                    }
                                    className="peer sr-only"
                                    disabled={!wakeLockSupported}
                                />
                                <span className="h-7 w-12 rounded-full bg-slate-300 transition-colors duration-200 peer-checked:bg-[#12340d] peer-disabled:opacity-50" />
                                <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5 peer-disabled:opacity-80" />
                            </span>
                        </label>
                    </section>

                    {/* Ingredients card */}
                    <section className="min-w-0 overflow-hidden rounded-xl bg-[#f2f1e8] p-6 md:p-8">
                        <h2 className="text-3xl font-bold tracking-tight">
                            Ingredienser
                        </h2>

                        <div className="my-7 h-px bg-[#d8d7cb]" />

                        {ingredientsToRender.length > 0 ? (
                            <ul className="space-y-3 text-base leading-relaxed">
                                {ingredientsToRender.map((ing, idx) => (
                                    <li
                                        key={`ing-${idx}`}
                                        className="flex min-w-0 gap-2"
                                    >
                                        {ing.amount ? (
                                            <span className="shrink-0 font-medium">
                                                {ing.amount}
                                            </span>
                                        ) : null}

                                        <span className="min-w-0 [overflow-wrap:anywhere]">
                                            {ing.name}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-neutral-600">
                                Ingen ingredienser lagt til.
                            </p>
                        )}
                    </section>
                </div>

                {/* RIGHT COLUMN */}
                <div className="min-w-0 space-y-5">
                    {recipe.coverImage && (
                        <section className="hidden lg:block">
                            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#f2f1e8]">
                                <Image
                                    src={recipe.coverImage}
                                    alt={`${recipe.title} cover`}
                                    fill
                                    className="object-cover"
                                    priority
                                    sizes="724px"
                                    quality={90}
                                />
                            </div>
                        </section>
                    )}

                    {/* Steps */}
                    <section className="min-w-0 overflow-hidden rounded-xl bg-[#f2f1e8] p-6 md:p-8">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="text-3xl font-bold tracking-tight">
                                    Fremgangsmåte
                                </h2>
                                {/*<p className="mt-2 text-sm text-[#496444]">*/}
                                {/*    {completedStepCount}/{recipe.cookingSteps.length} fullført*/}
                                {/*</p>*/}
                            </div>

                            {completedStepCount > 0 ? (
                                <button
                                    type="button"
                                    onClick={resetCheckedSteps}
                                    className="inline-flex items-center gap-2 self-start rounded-full bg-[#e5e5d7] px-4 py-2 text-sm font-semibold text-[#12340d] transition hover:bg-[#d8d7cb] active:scale-[0.99]"
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        restart_alt
                                    </span>
                                    Nullstill
                                </button>
                            ) : null}
                        </div>

                        <div className="mt-6 space-y-5">
                            {recipe.cookingSteps.map((step, i) => (
                                <div
                                    key={`step-${i}`}
                                    className={[
                                        'border-t border-[#d8d7cb] pt-5 transition-opacity',
                                        checkedSteps[i]
                                            ? 'opacity-70'
                                            : 'opacity-100',
                                    ].join(' ')}
                                >
                                    <div className="flex items-start gap-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleStep(i)}
                                            className={[
                                                'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition active:scale-95',
                                                checkedSteps[i]
                                                    ? 'border-[#12340d] bg-[#12340d] text-white'
                                                    : 'border-[#c7c6b8] bg-[#fbfaf4] text-[#496444] hover:border-[#12340d]',
                                            ].join(' ')}
                                            aria-label={
                                                checkedSteps[i]
                                                    ? `Marker steg ${i + 1} som ikke fullført`
                                                    : `Marker steg ${i + 1} som fullført`
                                            }
                                            aria-pressed={checkedSteps[i]}
                                        >
                                            {checkedSteps[i] ? (
                                                <span className="material-symbols-outlined text-[16px]">
                                                    check
                                                </span>
                                            ) : null}
                                        </button>

                                        <div className="min-w-0 flex-1">
                                            <h3
                                                className={[
                                                    'text-xl font-bold [overflow-wrap:anywhere]',
                                                    checkedSteps[i]
                                                        ? 'line-through decoration-2'
                                                        : '',
                                                ].join(' ')}
                                            >
                                                {i + 1}. {step.title}
                                            </h3>

                                            <p className="mt-2 text-base leading-relaxed [overflow-wrap:anywhere]">
                                                {step.description}
                                            </p>

                                            {step.linkedRecipe?.id ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.push(
                                                            `/recipe/${step.linkedRecipe?.id}`
                                                        )
                                                    }
                                                    className="mt-4 flex w-full items-center gap-3 rounded-xl border border-[#d8d7cb] bg-[#fbfaf4] p-3 text-left transition hover:bg-[#efeee2]"
                                                >
                                                    <div className="flex h-12 w-12 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#e5e5d7]">
                                                        {step.linkedRecipe.coverImage ? (
                                                            <img
                                                                src={
                                                                    step
                                                                        .linkedRecipe
                                                                        .coverImage
                                                                }
                                                                alt={
                                                                    step
                                                                        .linkedRecipe
                                                                        .title
                                                                }
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="material-symbols-outlined text-[#496444]">
                                                                menu_book
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-semibold text-[#496444]">
                                                            Se oppskrift
                                                        </p>
                                                        <p className="truncate text-sm font-semibold text-[#12340d]">
                                                            {
                                                                step
                                                                    .linkedRecipe
                                                                    .title
                                                            }
                                                        </p>
                                                    </div>

                                                    <span className="material-symbols-outlined text-[#496444]">
                                                        open_in_new
                                                    </span>
                                                </button>
                                            ) : null}

                                            {step.imageUrl ? (
                                                <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#e5e5d7]">
                                                    <Image
                                                        src={step.imageUrl}
                                                        alt={`Stegbilde ${i + 1}`}
                                                        fill
                                                        className="object-cover"
                                                        sizes="(max-width: 1024px) 100vw, 724px"
                                                        quality={80}
                                                    />
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Owner controls */}
                    {isOwner && (
                        <section className="flex flex-wrap gap-2 rounded-xl bg-[#f2f1e8] p-5">
                            <button
                                type="button"
                                onClick={() =>
                                    router.push(`/recipe/edit/${recipe.id}`)
                                }
                                className="rounded-full border border-[#12340d] px-4 py-2 text-sm hover:bg-[#12340d] hover:text-white"
                            >
                                Rediger
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="rounded-full bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
                            >
                                Slett
                            </button>
                        </section>
                    )}

                    {/* Comments */}
                    <section className="rounded-xl bg-[#f2f1e8] p-5">
                        {isLoggedIn ? (
                            <CommentSection recipeId={recipe.id} />
                        ) : (
                            <div>
                                <p>
                                    Logg inn for å lese og skrive kommentarer.
                                </p>

                                <button
                                    type="button"
                                    onClick={goLogin}
                                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#12340d] px-5 py-2 text-white transition hover:opacity-90"
                                >
                                    <span className="material-symbols-outlined">
                                        login
                                    </span>
                                    Logg inn
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            </main>

            {showAddModal && (
                <AddToCollectionModal
                    recipeId={recipe.id}
                    onClose={() => setShowAddModal(false)}
                />
            )}

            {showDeleteConfirm && (
                <AppModal onClose={() => setShowDeleteConfirm(false)}>
                    {({ closeWithAnim, closing }) => (
                        <div className="p-6">
                            <h2 className="text-xl font-semibold text-slate-900">
                                Slette oppskriften?
                            </h2>

                            <p className="mt-2 text-slate-600">
                                Dette kan ikke angres.
                            </p>

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeWithAnim}
                                    className="cursor-pointer rounded-full px-4 py-2 hover:bg-neutral-200"
                                    disabled={deleting || closing}
                                >
                                    Avbryt
                                </button>

                                <button
                                    type="button"
                                    onClick={async () => {
                                        await handleDelete();
                                        closeWithAnim();
                                    }}
                                    className="cursor-pointer rounded-full bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:opacity-60"
                                    disabled={deleting || closing}
                                >
                                    {deleting ? 'Sletter…' : 'Slett'}
                                </button>
                            </div>
                        </div>
                    )}
                </AppModal>
            )}
        </div>
    );
};

export default RecipeDetailClient;
