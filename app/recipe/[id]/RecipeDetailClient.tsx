'use client';

import React, { useMemo, useState, useCallback } from 'react';
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

type IngredientDetailed = { name: string; amount: string };

type RecipeForDetail = {
    id: string;
    userId: string;
    title: string;
    description?: string;
    coverImage?: string;
    cookingSteps: Array<{ title: string; description: string; imageUrl?: string }>;
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
                            <div key={i} className="h-[86px] rounded-xl bg-[#f2f1e8]" />
                        ))}
                    </div>

                    <div className="rounded-xl bg-[#f2f1e8] p-8">
                        <div className="h-8 w-44 rounded-xl bg-slate-200" />
                        <div className="mt-8 space-y-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-5 w-52 rounded bg-slate-200" />
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

    const [recipeRaw, loading] = useRecipe(id);
    const recipe = recipeRaw as RecipeForDetail | null;

    const creatorDoc = usePublicUserData(recipe?.userId || '');

    const currentUid = auth.currentUser?.uid ?? '';
    const viewerFollowing = useUserFollowing(currentUid);
    const isLoggedIn = Boolean(currentUid);
    const isOwner = Boolean(recipe && currentUid && recipe.userId === currentUid);

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
        [isLoggedIn, goLogin],
    );

    const ingredientsToRender: IngredientDetailed[] = useMemo(() => {
        if (!recipe) return [];

        return recipe.ingredientsDetailed && recipe.ingredientsDetailed.length > 0
            ? recipe.ingredientsDetailed
                .map((i) => ({ name: i.name.trim(), amount: i.amount.trim() }))
                .filter((i) => i.name.length > 0)
            : (recipe.ingredients ?? [])
                .map((s) => ({ name: String(s).trim(), amount: '' }))
                .filter((i) => i.name.length > 0);
    }, [recipe]);

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
                        <span className="material-symbols-outlined text-[28px]">lock</span>
                    </div>
                    <h1 className="text-2xl font-bold">Denne oppskriften er privat</h1>
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
                            onClick={() => router.push(`/user/${recipe.userId}`)}
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

    return (
        <div className="min-h-screen overflow-x-clip bg-[#fbfaf4] pb-20 text-[#12340d]">
            <main className="mx-auto grid max-w-[1190px] min-w-0 gap-5 px-4 py-4 lg:grid-cols-[438px_minmax(0,1fr)] lg:items-start">
                {/* LEFT COLUMN */}
                <div className="min-w-0 space-y-3 lg:sticky lg:top-4 lg:self-start lg:h-fit">
                    {/* Intro card */}
                    <section className="min-w-0 overflow-hidden rounded-xl bg-[#f2f1e8] p-6 md:p-8">
                        {Array.isArray(recipe.tags) && recipe.tags.length > 0 ? (
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
                            <RatingStars recipeId={recipe.id} variant="compact" />
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
                            onClick={() => router.push(`/user/${recipe.userId}`)}
                            className="flex h-[86px] flex-col items-center justify-center rounded-xl bg-[#f2f1e8] px-2 text-center text-xs transition hover:bg-[#e8e7dc]"
                        >
                            <div className="mb-1 h-8 w-8 overflow-hidden rounded-full bg-[#deded0]">
                                {userPhoto ? (
                                    <img
                                        src={userPhoto}
                                        alt="Creator"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-[20px]">
                                        person
                                    </span>
                                )}
                            </div>

                            <span className="text-[10px] uppercase tracking-wide text-[#496444]">
                                Laget av
                            </span>

                            <span className="max-w-full truncate font-medium">
                                {userName}
                            </span>
                        </button>

                        <div className="flex h-[86px] items-center justify-center rounded-xl bg-[#f2f1e8] px-2 text-xs transition hover:bg-[#e8e7dc]">
                            <LikeButton
                                recipeId={recipe.id}
                                variant="compact"
                                onRequireLogin={() => {
                                    const next = window.location.pathname + window.location.search;
                                    router.push(`/login?next=${encodeURIComponent(next)}`);
                                }}
                            />
                        </div>



                        <button
                            type="button"
                            onClick={() => requireAuth(() => setShowAddModal(true))}
                            className="flex h-[86px] flex-col items-center justify-center rounded-xl bg-[#f2f1e8] text-xs transition hover:bg-[#e8e7dc]"
                        >
                            <span className="material-symbols-outlined mb-1 text-[28px]">
                                bookmark_add
                            </span>
                            Lagre
                        </button>
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
                                    <li key={`ing-${idx}`} className="flex min-w-0 gap-2">
                                        {ing.amount ? (
                                            <span className="shrink-0 font-medium">
                                                {ing.amount}
                                            </span>
                                        ) : null}

                                        <span className="min-w-0 [overflow-wrap:anywhere]">{ing.name}</span>
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
                        <h2 className="text-3xl font-bold tracking-tight">
                            Fremgangsmåte
                        </h2>

                        <div className="mt-6 space-y-5">
                            {recipe.cookingSteps.map((step, i) => (
                                <div
                                    key={`step-${i}`}
                                    className="border-t border-[#d8d7cb] pt-5"
                                >
                                    <h3 className="text-xl font-bold [overflow-wrap:anywhere]">
                                        {i + 1}. {step.title}
                                    </h3>

                                    <p className="mt-2 text-base leading-relaxed [overflow-wrap:anywhere]">
                                        {step.description}
                                    </p>

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
                            ))}
                        </div>
                    </section>

                    {/* Owner controls */}
                    {isOwner && (
                        <section className="flex flex-wrap gap-2 rounded-xl bg-[#f2f1e8] p-5">
                            <button
                                type="button"
                                onClick={() => router.push(`/recipe/edit/${recipe.id}`)}
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
                                <p>Logg inn for å lese og skrive kommentarer.</p>

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
